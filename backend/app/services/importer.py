import io
import re
import unicodedata
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
from sqlalchemy.orm import Session
from app.models.epi import EPI, EntregaEPI
from app.models.funcionario_epi import FuncionarioEPI


def _normalizar_coluna(nome: str) -> str:
    """Normaliza nome de coluna para comparação insensível a acentos e caracteres especiais."""
    if not nome:
        return ""
    s = unicodedata.normalize("NFKD", str(nome).strip().lower())
    s = "".join(char for char in s if not unicodedata.combining(char))
    s = re.sub(r'[áàãâä]', 'a', s)
    s = re.sub(r'[éèêë]', 'e', s)
    s = re.sub(r'[íìîï]', 'i', s)
    s = re.sub(r'[óòõôö]', 'o', s)
    s = re.sub(r'[úùûü]', 'u', s)
    s = re.sub(r'[ç]', 'c', s)
    s = re.sub(r'[^a-z0-9]', '_', s)
    s = re.sub(r'_+', '_', s).strip('_')
    return s


def _limpar_valor_texto(val: Any) -> Optional[str]:
    """Trata valores de texto, transformando N/A, nan, -, etc. em None."""
    if val is None:
        return None
    s = str(val).strip()
    if s.lower() in ("nan", "none", "n/a", "na", "-", "--", "null", ""):
        return None
    # Trata datas com timestamp que pandas costuma gerar
    if " 00:00:00" in s:
        s = s.replace(" 00:00:00", "")
    return s


def _limpar_valor_numero(val: Any, default: float = 0.0) -> float:
    """Converte valores variados para float com segurança."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val) if not pd.isna(val) else default
    s = str(val).strip().replace("R$", "").replace(" ", "")
    if s.lower() in ("nan", "none", "n/a", "na", "-", "", "null"):
        return default
    try:
        # Troca separador brasileiro de milhar e decimal se necessário
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        return float(s)
    except Exception:
        return default


def _mapear_colunas(colunas_originais: List[str]) -> Dict[str, str]:
    """
    Identifica as colunas da planilha e mapeia para os campos do modelo EPI e entregas.
    Retorna dicionário {campo_modelo: nome_coluna_original}.
    """
    mapa: Dict[str, str] = {}
    
    # Ordem prioritária de casamento
    regras = {
        "colaborador_nome": ["nome_funcionario", "funcionario", "colaborador", "nome_colaborador", "destinatario", "recebedor"],
        "funcao": ["funcao", "cargo", "ocupacao"],
        "setor": ["setor", "departamento", "area"],
        "local": ["local", "unidade_local", "filial", "cidade"],
        "registro": ["matricula", "registro", "cpf"],
        "data_entrega": ["data_entrega", "dt_entrega", "data_distribuicao", "dt_distribuicao", "entrega"],
        "motivo": ["motivo", "tipo_entrega", "motivo_entrega"],
        "tamanho": ["tamanho", "tam", "numeracao"],
        "quantidade_entregue": ["qtd_entregue", "quantidade_entregue", "entregue"],
        "descricao": ["descricao_do_epi", "descricao", "desc", "produto", "equipamento", "item_descricao", "especificacao", "epi"],
        "fabricante": ["fabricante", "marca", "fornecedor"],
        "data_fabricacao": ["data_fabricacao", "dt_fabricacao", "fabricacao", "data_de_fabricacao", "dt_fab"],
        "validade_epi": ["validade_epi", "validade_produto", "val_epi", "validade"],
        "numero_ca": ["numero_ca", "n_ca", "no_ca", "ca", "certificado", "certificado_aprovacao", "cert_aprovacao"],
        "validade_ca": ["validade_ca", "vencimento_ca", "val_ca", "data_validade_ca", "validade_do_ca"],
        "estoque_real": ["estoque_real", "estoque_atual", "estoque", "saldo", "qtd", "quantidade", "real"],
        "estoque_minimo": ["estoque_minimo", "est_minimo", "minimo", "est_min", "seguranca"],
        "unidade": ["unidade", "un", "und", "medida", "tipo_unidade"],
        "categoria": ["categoria", "cat", "tipo_categoria", "grupo"]
    }

    # 1. Tenta correspondência exata primeiro
    for campo, sinonimos in regras.items():
        for col in colunas_originais:
            norm = _normalizar_coluna(col)
            if campo not in mapa and norm in sinonimos:
                mapa[campo] = col
                break

    # 2. Se não encontrou, tenta correspondência por substring
    for campo, sinonimos in regras.items():
        if campo not in mapa:
            for col in colunas_originais:
                norm = _normalizar_coluna(col)
                for sin in sinonimos:
                    if sin in norm:
                        mapa[campo] = col
                        break
                if campo in mapa:
                    break

    return mapa


def _linha_cabecalho(df_bruto: pd.DataFrame) -> Optional[int]:
    """Localiza o cabeçalho em planilhas que possuem título antes da tabela."""
    for indice, row in df_bruto.head(30).iterrows():
        colunas = {
            _normalizar_coluna(valor)
            for valor in row.tolist()
            if _limpar_valor_texto(valor)
        }
        tem_descricao = any(
            "descricao" in coluna or coluna in {"produto", "equipamento", "epi"}
            for coluna in colunas
        )
        tem_estoque = any(
            "estoque" in coluna or coluna in {"saldo", "qtd", "quantidade"}
            for coluna in colunas
        )
        if tem_descricao and tem_estoque:
            return indice
    return None


def _preparar_dataframe(df_bruto: pd.DataFrame) -> pd.DataFrame:
    """Usa o cabeçalho detectado e remove títulos e linhas vazias acima da tabela."""
    indice_cabecalho = _linha_cabecalho(df_bruto)
    if indice_cabecalho is None:
        return df_bruto

    colunas: List[str] = []
    usados: Dict[str, int] = {}
    for indice, valor in enumerate(df_bruto.iloc[indice_cabecalho].tolist(), start=1):
        nome = _limpar_valor_texto(valor) or f"coluna_{indice}"
        contador = usados.get(nome, 0)
        usados[nome] = contador + 1
        colunas.append(nome if contador == 0 else f"{nome}_{contador + 1}")

    df = df_bruto.iloc[indice_cabecalho + 1:].copy()
    df.columns = colunas
    return df.dropna(how="all").reset_index(drop=True)


def carregar_dataframe(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Lê bytes de arquivo Excel ou CSV em um DataFrame do Pandas."""
    nome_lower = filename.lower()
    bio = io.BytesIO(file_bytes)
    
    if nome_lower.endswith(".csv"):
        # Tenta detectar separador (; ou ,)
        try:
            df = pd.read_csv(bio, sep=";", encoding="utf-8-sig", header=None)
            if len(df.columns) <= 1:
                bio.seek(0)
                df = pd.read_csv(bio, sep=",", encoding="utf-8-sig", header=None)
        except Exception:
            bio.seek(0)
            df = pd.read_csv(bio, sep=",", encoding="latin-1", header=None)
    else:
        # Excel (.xlsx, .xls)
        df = pd.read_excel(bio, header=None)
    
    return _preparar_dataframe(df)


def preview_planilha(file_bytes: bytes, filename: str, max_linhas: int = 10) -> Dict[str, Any]:
    """
    Gera uma prévia das primeiras linhas da planilha sem persistir dados,
    incluindo colunas mapeadas e dados brutos para exibição no frontend.
    """
    df = carregar_dataframe(file_bytes, filename)
    colunas_originais = [str(c).strip() for c in df.columns]
    mapa = _mapear_colunas(colunas_originais)
    
    total_linhas = len(df)
    preview_df = df.head(max_linhas).fillna("")
    
    linhas_preview = []
    for _, row in preview_df.iterrows():
        linha_dict = {}
        for c in colunas_originais:
            val = row.get(c, "")
            linha_dict[c] = str(val) if not pd.isna(val) else ""
        linhas_preview.append(linha_dict)

    return {
        "total_linhas": total_linhas,
        "colunas": colunas_originais,
        "linhas": linhas_preview,
        "mapa_detectado": mapa
    }


def importar_planilha_para_banco(file_bytes: bytes, filename: str, db: Session) -> Dict[str, Any]:
    """
    Importa linhas da planilha com lógica de UPSERT:
    - Se encontrar item com mesmo número de CA ou mesma Descrição (case-insensitive),
      atualiza estoques, validades e informações complementares.
    - Se for item novo, insere na tabela `epis`.
    Retorna relatório completo com quantidades e erros se houver.
    """
    try:
        df = carregar_dataframe(file_bytes, filename)
    except Exception as e:
        return {
            "total_linhas": 0,
            "inseridos": 0,
            "atualizados": 0,
            "falhas": 1,
            "erros": [f"Falha ao abrir o arquivo: {str(e)}"],
            "mensagem": "Não foi possível carregar a planilha."
        }

    colunas = [str(c).strip() for c in df.columns]
    mapa = _mapear_colunas(colunas)

    col_desc = mapa.get("descricao")
    if not col_desc:
        # Tenta pegar a primeira coluna de texto como descrição se não encontrar
        col_desc = colunas[0] if colunas else None

    if not col_desc:
        return {
            "total_linhas": len(df),
            "inseridos": 0,
            "atualizados": 0,
            "falhas": len(df),
            "erros": ["Nenhuma coluna de Descrição do EPI foi identificada."],
            "mensagem": "Não foi possível identificar as colunas de EPI na planilha."
        }

    inseridos = 0
    atualizados = 0
    entregas_registradas = 0
    falhas = 0
    erros: List[str] = []

    for index, row in df.iterrows():
        linha_num = index + 2  # Cabeçalho na linha 1
        try:
            descricao = _limpar_valor_texto(row.get(col_desc))
            if not descricao:
                # Linha em branco ignorada
                continue

            fabricante = _limpar_valor_texto(row.get(mapa.get("fabricante"))) if mapa.get("fabricante") else None
            data_fabricacao = _limpar_valor_texto(row.get(mapa.get("data_fabricacao"))) if mapa.get("data_fabricacao") else None
            validade_epi = _limpar_valor_texto(row.get(mapa.get("validade_epi"))) if mapa.get("validade_epi") else None
            numero_ca = _limpar_valor_texto(row.get(mapa.get("numero_ca"))) if mapa.get("numero_ca") else None
            validade_ca = _limpar_valor_texto(row.get(mapa.get("validade_ca"))) if mapa.get("validade_ca") else None
            unidade = _limpar_valor_texto(row.get(mapa.get("unidade"))) or "UN"
            categoria = _limpar_valor_texto(row.get(mapa.get("categoria"))) if mapa.get("categoria") else None
            
            estoque_real = _limpar_valor_numero(row.get(mapa.get("estoque_real"))) if mapa.get("estoque_real") else 0.0
            estoque_minimo = _limpar_valor_numero(row.get(mapa.get("estoque_minimo"))) if mapa.get("estoque_minimo") else 0.0

            # LÓGICA DE UPSERT:
            # 1. Tenta buscar por CA se fornecido
            epi_existente = None
            if numero_ca:
                epi_existente = db.query(EPI).filter(EPI.numero_ca == numero_ca).first()
            
            # 2. Se não encontrou por CA, busca por Descrição exata / case-insensitive
            if not epi_existente:
                epi_existente = db.query(EPI).filter(EPI.descricao.ilike(descricao.strip())).first()

            if epi_existente:
                # Atualização (Upsert)
                epi_existente.descricao = descricao
                if fabricante:
                    epi_existente.fabricante = fabricante
                if data_fabricacao:
                    epi_existente.data_fabricacao = data_fabricacao
                if validade_epi:
                    epi_existente.validade_epi = validade_epi
                if numero_ca:
                    epi_existente.numero_ca = numero_ca
                if validade_ca:
                    epi_existente.validade_ca = validade_ca
                if unidade:
                    epi_existente.unidade = unidade
                if categoria:
                    epi_existente.categoria = categoria
                
                # Se a planilha tem estoque, atualiza com o novo saldo
                epi_existente.estoque_real = estoque_real
                epi_existente.estoque_minimo = estoque_minimo
                
                atualizados += 1
                epi_ativo = epi_existente
            else:
                # Inserção de novo registro
                novo_epi = EPI(
                    descricao=descricao,
                    fabricante=fabricante,
                    data_fabricacao=data_fabricacao,
                    validade_epi=validade_epi,
                    numero_ca=numero_ca,
                    validade_ca=validade_ca,
                    estoque_real=estoque_real,
                    estoque_minimo=estoque_minimo,
                    unidade=unidade,
                    categoria=categoria or "OUTROS"
                )
                db.add(novo_epi)
                db.flush()
                inseridos += 1
                epi_ativo = novo_epi

            # 3. LÓGICA DE ENTREGA / FUNCIONÁRIO (SE HOUVER NA PLANILHA)
            colaborador_nome_val = _limpar_valor_texto(row.get(mapa.get("colaborador_nome"))) if mapa.get("colaborador_nome") else None
            if colaborador_nome_val:
                nome_colab = colaborador_nome_val.strip()
                func_existente = db.query(FuncionarioEPI).filter(FuncionarioEPI.nome.ilike(nome_colab)).first()
                funcao_val = (_limpar_valor_texto(row.get(mapa.get("funcao"))) if mapa.get("funcao") else None) or "Ajudante de Motorista"
                setor_val = (_limpar_valor_texto(row.get(mapa.get("setor"))) if mapa.get("setor") else None) or "Distribuição"
                local_val = (_limpar_valor_texto(row.get(mapa.get("local"))) if mapa.get("local") else None) or "Cascavel"
                registro_val = _limpar_valor_texto(row.get(mapa.get("registro"))) if mapa.get("registro") else None
                data_ent_val = (_limpar_valor_texto(row.get(mapa.get("data_entrega"))) if mapa.get("data_entrega") else None) or datetime.utcnow().strftime("%d/%m/%Y")

                if not func_existente:
                    func_existente = FuncionarioEPI(
                        nome=nome_colab,
                        funcao=funcao_val,
                        setor=setor_val,
                        local=local_val,
                        registro=registro_val,
                        data_entrada=data_ent_val
                    )
                    db.add(func_existente)
                    db.flush()
                else:
                    if registro_val and not func_existente.registro:
                        func_existente.registro = registro_val
                    if funcao_val and func_existente.funcao == "Ajudante de Motorista":
                        func_existente.funcao = funcao_val

                qtd_entregue = _limpar_valor_numero(row.get(mapa.get("quantidade_entregue")), default=1.0) if mapa.get("quantidade_entregue") else 1.0
                motivo_val = (_limpar_valor_texto(row.get(mapa.get("motivo"))) if mapa.get("motivo") else None) or "A"
                if "-" in motivo_val:
                    motivo_val = motivo_val.split("-")[0].strip()
                tamanho_val = _limpar_valor_texto(row.get(mapa.get("tamanho"))) if mapa.get("tamanho") else None

                nova_entrega = EntregaEPI(
                    epi_id=epi_ativo.id,
                    colaborador_nome=nome_colab,
                    colaborador_registro=func_existente.registro,
                    setor=func_existente.setor,
                    funcao=func_existente.funcao,
                    local=func_existente.local,
                    quantidade=qtd_entregue,
                    data_entrega=data_ent_val,
                    motivo=motivo_val,
                    tamanho=tamanho_val,
                    termo_assinado=True
                )
                db.add(nova_entrega)
                entregas_registradas += 1

            # Commit em lotes ou ao final
            if (index + 1) % 50 == 0:
                db.commit()

        except Exception as err:
            falhas += 1
            if len(erros) < 15:
                erros.append(f"Linha {linha_num}: {str(err)}")

    db.commit()

    total = inseridos + atualizados + falhas
    msg = f"Migração concluída com sucesso: {inseridos} novos EPIs inseridos e {atualizados} atualizados no banco de dados."
    if entregas_registradas > 0:
        msg += f" {entregas_registradas} entregas vinculadas a funcionários foram criadas."
    if falhas > 0:
        msg += f" ({falhas} linhas com falhas ignoradas)"

    return {
        "total_linhas": total,
        "inseridos": inseridos,
        "atualizados": atualizados,
        "falhas": falhas,
        "erros": erros,
        "mensagem": msg
    }
