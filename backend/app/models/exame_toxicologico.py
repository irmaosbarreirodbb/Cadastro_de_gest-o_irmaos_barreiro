from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base


class ExameToxicologico(Base):
    """
    Modelo para Controle de Exames Toxicológicos de Motoristas.
    Campos: id, nome do motorista, data do exame, data de vencimento.
    """
    __tablename__ = "exames_toxicologicos"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    nome = Column(String(150), nullable=False, index=True)           # Nome do motorista
    data_exame = Column(String(30), nullable=False)                  # Data de realização (DD/MM/AAAA)
    data_vencimento = Column(String(30), nullable=False)             # Data de vencimento (DD/MM/AAAA)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

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
        return (venc.date() - datetime.utcnow().date()).days

    @property
    def status(self) -> str:
        """VENCIDO | VENCENDO | OK"""
        dias = self.dias_para_vencer
        if dias < 0:
            return "VENCIDO"
        if dias <= 10:
            return "VENCENDO"
        return "OK"
