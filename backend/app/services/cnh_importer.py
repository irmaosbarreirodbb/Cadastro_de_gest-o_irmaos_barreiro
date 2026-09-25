import io
import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.models.cnh import CNHFuncionario
from app.core.encryption import encrypt_val


def _normalizar_coluna(nome: str) -> str:
    """Normaliza nome de coluna: minúsculas, sem acentos, underscores."""
    if not nome:
        return ""
    s = str(nome).strip().replace("№", "no").replace("Nº", "no").replace("nº", "no").replace("N°", "no").replace("n°", "no").replace("º", "o").replace("°", "o")
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[áàãâä]", "a", s)
    s = re.sub(r"[éèêë]", "e", s)
    s = re.sub(r"[íìîï]", "i", s)
    s = re.sub(r"[óòõôö]", "o", s)
    s = re.sub(r"[úùûü]", "u", s)
    s = re.sub(r"[ç]", "c", s)
    s = re.sub(r"[^a-z0-9]", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def _limpar_texto(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if s.lower() in ("nan", "none", "n/a", "na", "-", "--", "null", ""):
        return None
    if " 00:00:00" in s:
        s = s.replace(" 00:00:00", "")
    return s


def _parsear_data(val: Any) -> Optional[str]:
    """
    Recebe data em qualquer formato e devolve DD/MM/AAAA.
    Suporta: DD/MM/AAAA, AAAA-MM-DD, Timestamp pandas, número serial Excel.
    """
    if val is None:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%d/%m/%Y")
    texto = _limpar_texto(val)
    if not texto:
        return None

    # Tenta conversão se for float/int representando número serial do Excel
    try:
        if isinstance(val, (int, float)) or (isinstance(texto, str) and texto.replace(".", "", 1).isdigit() and len(texto) in (5, 6)):
            dt_excel = pd.to_datetime(float(val), unit="D", origin="1899-12-30")
            return dt_excel.strftime("%d/%m/%Y")
    except Exception:
        pass

    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(texto, fmt).strftime("%d/%m/%Y")
        except ValueError:
            continue

    partes = texto.split(" ")[0]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(partes, fmt).strftime("%d/%m/%Y")
        except ValueError:
            continue

    return texto


def _mapear_colunas_cnh(colunas: List[str]) -> Dict[str, str]:
    """
    Identifica as colunas da planilha para o modelo CNH.
    Retorna: {campo_modelo: nome_coluna_original}
    """
    mapa: Dict[str, str] = {}
    regras = {
        "nome": [
            "funcionarios", "funcionario", "nome_funcionario", "motorista", "nome_motorista",
            "nome", "colaborador", "condutor", "nome_do_motorista"
        ],
        "cnh_validade": [
            "cnh_validade", "validade_cnh", "validade", "data_validade", "vencimento",
            "dt_vencimento", "vencimento_cnh", "vence_em"
        ],
        "cnh_numero": [
            "no_cnh", "n_cnh", "num_cnh", "numero_cnh", "cnh", "n_de_cnh", "no_de_cnh",
            "registro_cnh", "o_cnh", "numero", "cnh_num"
        ],
        "observacao": [
            "observacao", "observacoes", "obs", "nota", "comentario"
        ],
        "setor": [
            "setor", "departamento", "area", "tipo", "categoria"
        ]
    }
    cols_norm = {_normalizar_coluna(c): c for c in colunas}

    for campo, aliases in regras.items():
        for alias in aliases:
            if alias in cols_norm:
                mapa[campo] = cols_norm[alias]
                break

    # Fallback por ordem se não encontrou nomes óbvios (Ex: Nº | Funcionário | Validade | Nº CNH | Obs)
    if "nome" not in mapa:
        candidatos_nome = [c for c in colunas if _normalizar_coluna(c) not in ("no", "n", "item", "id")]
        if candidatos_nome:
            mapa["nome"] = candidatos_nome[0]
            if len(candidatos_nome) > 1 and "cnh_validade" not in mapa:
                mapa["cnh_validade"] = candidatos_nome[1]
            if len(candidatos_nome) > 2 and "cnh_numero" not in mapa:
                mapa["cnh_numero"] = candidatos_nome[2]
            if len(candidatos_nome) > 3 and "observacao" not in mapa:
                mapa["observacao"] = candidatos_nome[3]

    return mapa


def _processar_dataframe(
    df: pd.DataFrame,
    setor_atual: str,
    db: Session,
    erros: List[str]
) -> Tuple[int, int, int]:
    """Processa um DataFrame individual e persiste no banco."""
    inseridos = 0
    atualizados = 0
    ignorados = 0

    if df.empty:
        return inseridos, atualizados, ignorados

    # Limpar linhas totalmente vazias
    df = df.dropna(how="all")
    colunas = list(df.columns)
    mapa = _mapear_colunas_cnh([str(c) for c in colunas])

    col_nome = mapa.get("nome")
    col_validade = mapa.get("cnh_validade")
    col_numero = mapa.get("cnh_numero")
    col_obs = mapa.get("observacao")
    col_setor = mapa.get("setor")

    if not col_nome or not col_validade:
        erros.append(f"Aba ou seção não possui colunas reconhecíveis de 'Funcionário' e 'Validade'.")
        return inseridos, atualizados, len(df)

    setor_dinamico = setor_atual

    for idx, row in df.iterrows():
        linha_num = idx + 2  # Aproximação da linha na planilha física

        val_nome_raw = row.get(col_nome)
        val_validade_raw = row.get(col_validade)
        val_numero_raw = row.get(col_numero) if col_numero else None
        val_obs_raw = row.get(col_obs) if col_obs else None
        val_setor_raw = row.get(col_setor) if col_setor else None

        # Verifica se esta linha é na verdade um cabeçalho de setor (ex: "Frota" ou "Adm" escrito numa linha)
        texto_linha_completa = " ".join([str(v) for v in row.values if pd.notna(v)]).strip().lower()
        if texto_linha_completa in ("frota", "setor frota", "motoristas"):
            setor_dinamico = "FROTA"
            continue
        elif texto_linha_completa in ("adm", "administracao", "setor adm", "setor administracao"):
            setor_dinamico = "ADM"
            continue

        nome = _limpar_texto(val_nome_raw)
        if not nome:
            ignorados += 1
            continue

        # Ignora cabeçalhos repetidos
        norm_nome = _normalizar_coluna(nome)
        if norm_nome in ("funcionarios", "funcionario", "nome", "motorista", "condutor", "none"):
            continue

        validade = _parsear_data(val_validade_raw)
        if not validade:
            erros.append(f"Linha {linha_num}: '{nome}' ignorado por falta de data de validade válida.")
            ignorados += 1
            continue

        numero = _limpar_texto(val_numero_raw)
        # Formata número para string limpa
        if numero and numero.endswith(".0"):
            numero = numero[:-2]

        obs = _limpar_texto(val_obs_raw)

        # Determina o setor final deste registro
        if val_setor_raw:
            s_raw = str(val_setor_raw).strip().upper()
            if "ADM" in s_raw:
                setor_registro = "ADM"
            else:
                setor_registro = "FROTA"
        else:
            setor_registro = setor_dinamico

        # Normaliza maiúsculo para salvar
        setor_registro = "ADM" if setor_registro == "ADM" else "FROTA"

        # Verifica duplicata no banco de dados pelo nome do funcionário
        registro_existente = (
            db.query(CNHFuncionario)
            .filter(sqlfunc.upper(CNHFuncionario.nome) == nome.upper())
            .first()
        )

        if registro_existente:
            registro_existente.setor = setor_registro
            registro_existente.cnh_validade = validade
            if numero:
                # Criptografa o nº da CNH antes de atualizar
                registro_existente.cnh_numero = encrypt_val(numero)
            if obs:
                registro_existente.observacao = obs
            registro_existente.updated_at = datetime.utcnow()
            atualizados += 1
        else:
            novo = CNHFuncionario(
                setor=setor_registro,
                nome=nome,
                cnh_numero=encrypt_val(numero) if numero else None,  # Criptografado!
                cnh_validade=validade,
                observacao=obs
            )
            db.add(novo)
            inseridos += 1

    return inseridos, atualizados, ignorados


def importar_planilha_cnh(
    file_bytes: bytes,
    filename: str,
    db: Session,
    setor_padrao: Optional[str] = "FROTA"
) -> Tuple[int, int, int, List[str]]:
    """
    Importa arquivo Excel ou CSV com dados de CNHs de funcionários.
    Suporta abas separadas ('Frota', 'Adm') ou setor indicado no dropdown / coluna.
    """
    fname = filename.lower()
    inseridos = 0
    atualizados = 0
    ignorados = 0
    erros: List[str] = []

    setor_base = "ADM" if (setor_padrao or "").upper() == "ADM" else "FROTA"

    if fname.endswith(".csv"):
        # Tenta múltiplos separadores
        df = None
        for sep in [";", ",", "\t"]:
            try:
                temp_df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, dtype=str)
                if len(temp_df.columns) >= 2:
                    df = temp_df
                    break
            except Exception:
                continue

        if df is None:
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)

        ins, atu, ign = _processar_dataframe(df, setor_base, db, erros)
        inseridos += ins
        atualizados += atu
        ignorados += ign

    else:
        # Excel (.xlsx, .xls)
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        sheet_names = excel_file.sheet_names

        # Se houver abas explicitamente nomeadas 'frota' ou 'adm', lê cada uma com o setor correto
        abas_reconhecidas = False
        for sname in sheet_names:
            sname_norm = _normalizar_coluna(sname)
            if "adm" in sname_norm or "frota" in sname_norm:
                abas_reconhecidas = True
                setor_aba = "ADM" if "adm" in sname_norm else "FROTA"
                df_aba = excel_file.parse(sname, dtype=str)
                ins, atu, ign = _processar_dataframe(df_aba, setor_aba, db, erros)
                inseridos += ins
                atualizados += atu
                ignorados += ign

        # Se nenhuma aba específica foi reconhecida pelo nome, processa a primeira aba
        if not abas_reconhecidas:
            primeira_aba = sheet_names[0]
            # Tenta encontrar cabeçalho em uma das primeiras 10 linhas
            df = None
            for h in range(8):
                try:
                    temp_df = excel_file.parse(primeira_aba, header=h, dtype=str)
                    cols_norm = [_normalizar_coluna(str(c)) for c in temp_df.columns]
                    if any(p in cols_norm for p in ("funcionarios", "funcionario", "motorista", "nome", "validade", "cnh")):
                        df = temp_df
                        break
                except Exception:
                    continue

            if df is None:
                df = excel_file.parse(primeira_aba, dtype=str)

            ins, atu, ign = _processar_dataframe(df, setor_base, db, erros)
            inseridos += ins
            atualizados += atu
            ignorados += ign

    db.commit()
    return inseridos, atualizados, ignorados, erros
