from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import Column, Integer, String, DateTime, LargeBinary
from app.core.database import Base


class ExameToxicologico(Base):
    """
    Modelo para Controle de Exames Toxicológicos de Motoristas.
    Campos: id, nome do motorista, data do exame, data de vencimento, pdf_arquivo, pdf_nome.
    """
    __tablename__ = "exames_toxicologicos"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    nome = Column(String(150), nullable=False, index=True)           # Nome do motorista
    data_exame = Column(String(30), nullable=False)                  # Data de realização (DD/MM/AAAA)
    data_vencimento = Column(String(30), nullable=False)             # Data de vencimento (DD/MM/AAAA)

    # Documento PDF do exame toxicológico (armazenado no banco)
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
        """Data oficial do sistema para vencimentos e alertas."""
        return datetime.now(ZoneInfo("America/Sao_Paulo")).date()

    @property
    def dias_para_vencer(self) -> int:
        """Retorna quantos dias faltam para o vencimento. Negativo = já vencido."""
        try:
            # Tenta DD/MM/AAAA
            venc = datetime.strptime(self.data_vencimento, "%d/%m/%Y")
        except ValueError:
            try:
                venc = datetime.strptime(self.data_vencimento, "%Y-%m-%d")
            except ValueError:
                return 9999
        return (venc.date() - self.hoje_local()).days

    @property
    def status(self) -> str:
        """VENCIDO | VENCENDO | OK"""
        dias = self.dias_para_vencer
        if dias < 0:
            return "VENCIDO"
        if dias <= 10:
            return "VENCENDO"
        return "OK"
