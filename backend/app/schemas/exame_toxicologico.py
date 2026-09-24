from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class ExameToxicologicoBase(BaseModel):
    nome: str
    data_exame: str
    data_vencimento: str


class ExameToxicologicoCreate(ExameToxicologicoBase):
    pass


class ExameToxicologicoUpdate(BaseModel):
    nome: Optional[str] = None
    data_exame: Optional[str] = None
    data_vencimento: Optional[str] = None


class ExameToxicologicoOut(ExameToxicologicoBase):
    id: int
    status: str
    dias_para_vencer: int
    tem_pdf: bool = False
    pdf_nome: Optional[str] = None
    pdf_tamanho: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ImportacaoExameResultadoOut(BaseModel):
    total_importados: int
    total_atualizados: int
    total_ignorados: int
    mensagem: str
    erros: list[str] = []
