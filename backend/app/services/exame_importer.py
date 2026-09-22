import io
import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from app.models.exame_toxicologico import ExameToxicologico


def _normalizar_coluna(nome: str) -> str:
    """Normaliza nome de coluna: minúsculas, sem acentos, underscores."""
    if not nome:
        return ""
    s = unicodedata.normalize("NFKD", str(nome).strip().lower())
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
    Suporta: DD/MM/AAAA, AAAA-MM-DD, DD-MM-AAAA, Timestamp pandas.
    """
    if val is None:
        return None
    # Pandas Timestamp
    if hasattr(val, "strftime"):
        return val.strftime("%d/%m/%Y")
    texto = _limpar_texto(val)
    if not texto:
        return None
    # Tenta múltiplos formatos
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(texto, fmt).strftime("%d/%m/%Y")
        except ValueError:
            continue
    # Tenta apenas com os números (ex: "07/06/2025 00:00:00")
    partes = texto.split(" ")[0]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(partes, fmt).strftime("%d/%m/%Y")
        except ValueError:
            continue
    return texto  # Devolve o texto original se não conseguir parsear


def _mapear_colunas(colunas: List[str]) -> Dict[str, str]:
    """
    Tenta identificar as colunas da planilha e mapeia para os campos do modelo.
    Retorna: {campo_modelo: nome_coluna_original}
    """
    mapa: Dict[str, str] = {}
    regras = {
        "nome": ["motorista", "nome_motorista", "nome", "funcionario", "colaborador", "condutor"],
        "data_exame": [
            "exame_toxicologico", "exame", "data_exame", "dt_exame",
            "data_realizacao", "realizacao", "data_do_exame"
        ],
        "data_vencimento": [
            "vencimento", "data_vencimento", "validade", "dt_vencimento",
            "vence_em", "expiracao", "data_validade"
        ],
    }
    cols_norm = {_normalizar_coluna(c): c for c in colunas}
    for campo, aliases in regras.items():
        for alias in aliases:
            if alias in cols_norm:
                mapa[campo] = cols_norm[alias]
                break
    # Fallback por posição se apenas 3 colunas (Motorista | Exame | Vencimento)
    if len(colunas) >= 3 and "nome" not in mapa:
        mapa.setdefault("nome", colunas[0])
        mapa.setdefault("data_exame", colunas[1])
        mapa.setdefault("data_vencimento", colunas[2])
    return mapa


def _ler_planilha(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Lê o arquivo e retorna um DataFrame, detectando automaticamente a linha de cabeçalho."""
    fname = filename.lower()
    if fname.endswith(".csv"):
        for sep in [";", ",", "\t"]:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, dtype=str)
                if len(df.columns) >= 2:
                    return df
            except Exception:
                continue
        return pd.read_csv(io.BytesIO(file_bytes), dtype=str)
    else:
        # Excel — tenta achar a linha de cabeçalho nas primeiras 10 linhas
        for header_row in range(10):
            try:
                df = pd.read_excel(io.BytesIO(file_bytes), header=header_row, dtype=str)
                cols_norm = [_normalizar_coluna(str(c)) for c in df.columns]
                palavras_chave = {"motorista", "nome", "exame", "vencimento", "validade"}
                if any(p in cols_norm for p in palavras_chave):
                    return df
            except Exception:
                continue
        # Sem cabeçalho detectado — usa header=0
        return pd.read_excel(io.BytesIO(file_bytes), header=0, dtype=str)


def importar_planilha_exames(
    file_bytes: bytes, filename: str, db: Session
) -> Tuple[int, int, int, List[str]]:
    """
    Importa planilha de exames toxicológicos para o banco via UPSERT por nome.
    Retorna: (inseridos, atualizados, ignorados, lista_erros)
    """
    df = _ler_planilha(file_bytes, filename)
    df.columns = [str(c).strip() for c in df.columns]
    mapa = _mapear_colunas(list(df.columns))

    inseridos = 0
    atualizados = 0
    ignorados = 0
    erros: List[str] = []

    if "nome" not in mapa:
        erros.append(
            "Não foi possível identificar a coluna de nome do motorista. "
            "Certifique-se que a planilha tem colunas: Motorista, Exame Toxicológico, Vencimento."
        )
        return inseridos, atualizados, ignorados, erros

    for idx, row in df.iterrows():
        linha = idx + 2  # 1-indexed, considerando cabeçalho
        try:
            nome = _limpar_texto(row.get(mapa.get("nome", ""), None))
            data_exame = _parsear_data(row.get(mapa.get("data_exame", ""), None))
            data_vencimento = _parsear_data(row.get(mapa.get("data_vencimento", ""), None))

            if not nome:
                ignorados += 1
                continue
            if not data_exame or not data_vencimento:
                erros.append(f"Linha {linha}: '{nome}' — datas não identificadas. Ignorado.")
                ignorados += 1
                continue

            # UPSERT por nome (case-insensitive)
            existente = db.query(ExameToxicologico).filter(
                sqlfunc.upper(ExameToxicologico.nome) == nome.upper()
            ).first()

            if existente:
                existente.data_exame = data_exame
                existente.data_vencimento = data_vencimento
                existente.updated_at = datetime.utcnow()
                atualizados += 1
            else:
                novo = ExameToxicologico(
                    nome=nome,
                    data_exame=data_exame,
                    data_vencimento=data_vencimento,
                )
                db.add(novo)
                inseridos += 1

        except Exception as e:
            erros.append(f"Linha {linha}: erro inesperado — {str(e)}")
            ignorados += 1
            continue

    db.commit()
    return inseridos, atualizados, ignorados, erros
