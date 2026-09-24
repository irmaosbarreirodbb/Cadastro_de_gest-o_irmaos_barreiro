import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Text
from app.core.database import Base

class ColaboradorCadastro(Base):
    __tablename__ = "pessoas_fisicas_cadastros"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    protocolo = Column(String(50), unique=True, index=True, nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=True)

    # Etapa 1: Dados Pessoais
    nome_completo = Column(String(150), nullable=False)
    cpf = Column(Text, index=True, nullable=False)
    rg = Column(Text, nullable=False)
    data_nascimento = Column(String(20), nullable=True)
    cnh_numero = Column(String(50), nullable=True)
    cnh_validade = Column(String(20), nullable=True)
    exame_toxicologico_emissao = Column(String(20), nullable=True)
    exame_toxicologico_vencimento = Column(String(20), nullable=True)

    # Etapa 2: Endereço & Contato
    email = Column(String(255), nullable=False)
    telefone = Column(Text, nullable=False)
    cep = Column(String(9), nullable=False)
    logradouro = Column(String(150), nullable=False)
    numero = Column(String(20), nullable=False)
    complemento = Column(String(100), nullable=True)
    bairro = Column(String(100), nullable=False)
    cidade = Column(String(100), default="Cascavel")
    estado = Column(String(2), default="CE")

    # Etapa 3: Dados Bancários
    banco = Column(String(100), nullable=False)
    outro_banco = Column(String(100), nullable=True)
    tipo_conta = Column(String(50), nullable=False)
    agencia = Column(Text, nullable=True)
    conta = Column(Text, nullable=True)
    tipo_pix = Column(String(30), nullable=False)
    chave_pix = Column(Text, nullable=False)

    # Etapa 4: Dados Profissionais
    cargo = Column(String(100), nullable=False)
    outro_cargo = Column(String(100), nullable=True)
    unidade = Column(String(150), default="Distrito Industrial de Cascavel - CE")
    turno = Column(String(100), default="Diurno (Comercial / Rota)")
    sede = Column(String(255), default="Rua João Damasceno Fontenele, nº 5003 - Cascavel/CE")

    # Status & Consentimento
    aceitou_termos = Column(Boolean, default=True)
    status = Column(String(30), default="PENDENTE")  # PENDENTE, VALIDADO, REVISAO_SOLICITADA
    data_emissao = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
