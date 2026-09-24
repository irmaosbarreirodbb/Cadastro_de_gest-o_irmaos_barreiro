from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class ColaboradorCreate(BaseModel):
    nome_completo: str
    cpf: str
    rg: str
    data_nascimento: Optional[str] = None
    cnh_numero: Optional[str] = None
    cnh_validade: Optional[str] = None
    exame_toxicologico_emissao: Optional[str] = None
    exame_toxicologico_vencimento: Optional[str] = None
    email: str
    telefone: str
    cep: str
    logradouro: str
    numero: str
    complemento: Optional[str] = None
    bairro: str
    cidade: Optional[str] = "Cascavel"
    estado: Optional[str] = "CE"
    banco: str
    outro_banco: Optional[str] = None
    tipo_conta: str
    agencia: Optional[str] = None
    conta: Optional[str] = None
    tipo_pix: str
    chave_pix: str
    cargo: str
    outro_cargo: Optional[str] = None
    unidade: Optional[str] = "Distrito Industrial de Cascavel - CE"
    turno: Optional[str] = "Diurno (Comercial / Rota)"
    sede: Optional[str] = "Rua João Damasceno Fontenele, nº 5003 - Cascavel/CE"
    aceitou_termos: bool = True

class StatusUpdate(BaseModel):
    status: str

class ColaboradorOut(ColaboradorCreate):
    id: str
    protocolo: str
    status: str
    data_emissao: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
