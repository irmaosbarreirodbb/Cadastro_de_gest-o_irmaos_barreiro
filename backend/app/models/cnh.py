from datetime import datetime, date
from zoneinfo import ZoneInfo
from sqlalchemy import Column, Integer, String, DateTime, Date, LargeBinary
from app.core.database import Base


class CNHFuncionario(Base):
    """
    Modelo para Controle de Vencimentos de CNH dos Funcionários (Frota e Adm).
    Campos: id, setor (FROTA | ADM), nome do funcionário, cnh_numero, cnh_validade, observacao,
    além do documento PDF criptografado no banco.
    """
    __tablename__ = "cnhs_funcionarios"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    setor = Column(String(50), nullable=False, default="FROTA", index=True)  # FROTA | ADM
    nome = Column(String(150), nullable=False, index=True)                   # Nome do Funcionário
    cnh_numero = Column(String(255), nullable=True)                         # Nº CNH (criptografado com Fernet)
    cnh_validade = Column(String(30), nullable=False)                       # CNH Validade (DD/MM/AAAA)
    observacao = Column(String(255), nullable=True)                         # Observação

    # Documento PDF da CNH (armazenado com criptografia no banco)
    pdf_arquivo = Column(LargeBinary, nullable=True)
    pdf_nome = Column(String(255), nullable=True)
    pdf_content_type = Column(String(100), nullable=True)
    pdf_tamanho = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @property
    def tem_pdf(self) -> bool:
        return self.pdf_arquivo is not None

    @staticmethod
    def hoje_local():
        """Data oficial do sistema no fuso horário de Brasília."""
        return datetime.now(ZoneInfo("America/Sao_Paulo")).date()

    @property
    def dias_para_vencer(self) -> int:
        """Retorna quantos dias faltam para o vencimento. Negativo = já vencido."""
        try:
            venc = datetime.strptime(self.cnh_validade.strip(), "%d/%m/%Y")
        except ValueError:
            try:
                venc = datetime.strptime(self.cnh_validade.strip(), "%Y-%m-%d")
            except ValueError:
                return 9999
        return (venc.date() - self.hoje_local()).days

    @property
    def status(self) -> str:
        """VENCIDO | VENCENDO | OK"""
        dias = self.dias_para_vencer
        if dias < 0:
            return "VENCIDO"
        if dias <= 30:
            return "VENCENDO"
        return "OK"


class AlertaCNHEnviado(Base):
    """
    Tabela de controle para evitar envio duplicado de alertas de e-mail de CNH.
    Cada linha representa um alerta enviado para um funcionário em uma data específica.
    """
    __tablename__ = "alertas_cnh_enviados"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cnh_id = Column(Integer, nullable=False, index=True)
    nome_motorista = Column(String(150), nullable=False)
    setor = Column(String(50), nullable=False, default="FROTA")
    data_envio = Column(Date, nullable=False, default=date.today)
    tipo = Column(String(20), nullable=False, default="VENCENDO")  # VENCENDO | VENCIDO
    created_at = Column(DateTime, default=datetime.utcnow)
