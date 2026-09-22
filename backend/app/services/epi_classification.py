import re
import unicodedata
from typing import Optional


def classificar_categoria(descricao: Optional[str], categoria: Optional[str] = None) -> str:
    """Classifica itens de forma consistente entre fardamento e EPI."""
    categoria_normalizada = str(categoria or "").strip().upper()
    if categoria_normalizada == "FARDAMENTO":
        return "FARDAMENTO"

    texto = unicodedata.normalize("NFKD", str(descricao or "")).encode("ascii", "ignore").decode().lower()
    if re.search(r"fardamento|uniforme|camisa|camiseta|calca|bermuda|jaqueta|blusa|colete\s+uniforme|vestimenta", texto):
        return "FARDAMENTO"
    return categoria_normalizada or "OUTROS"
