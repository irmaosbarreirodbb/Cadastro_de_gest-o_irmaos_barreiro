from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class CNHBase(BaseModel):
    setor: str = "FROTA"          # FROTA | ADM
    nome: str
    cnh_numero: Optional[str] = None
    cnh_validade: str
    observacao: Optional[str] = None


class CNHCreate(CNHBase):
    pass


class CNHUpdate(BaseModel):
    setor: Optional[str] = None
    nome: Optional[str] = None
    cnh_numero: Optional[str] = None
    cnh_validade: Optional[str] = None
    observacao: Optional[str] = None


class CNHOut(CNHBase):
    id: int
    status: str
    dias_para_vencer: int
    tem_pdf: bool = False
    pdf_nome: Optional[str] = None
    pdf_tamanho: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ImportacaoCNHResultadoOut(BaseModel):
    total_importados: int
    total_atualizados: int
    total_ignorados: int
    mensagem: str
    erros: List[str] = []
