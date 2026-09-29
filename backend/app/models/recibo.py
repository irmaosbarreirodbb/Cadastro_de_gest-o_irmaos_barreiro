import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey
from app.core.database import Base

class Recibo(Base):
    __tablename__ = "recibos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    numero_recibo = Column(String(50), unique=True, index=True, nullable=False)
    diarista_id = Column(String, ForeignKey("diaristas_lancamentos.id", ondelete="SET NULL"), nullable=True)
    nome_diarista = Column(String(150), nullable=False)
    cpf_diarista = Column(Text, nullable=True)
    funcao = Column(String(100), nullable=True)
    valor_unitario = Column(Float, nullable=True)
    dias_trabalhados = Column(Integer, default=1)
    tem_almoco = Column(Boolean, default=True)
    valor_almoco = Column(Float, default=0.0)
    valor_total = Column(Float, nullable=False)
    valor_extenso = Column(Text, nullable=False)
    tipo_pix = Column(String(30), nullable=True)
    chave_pix = Column(Text, nullable=True)
    data_referencia = Column(String(10), nullable=False)  # ISO Date YYYY-MM-DD
    status_pagamento = Column(Boolean, default=True)
    observacoes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
