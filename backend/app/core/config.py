import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Distribuidora Irmãos Barreiro - Backend API"
    API_V1_STR: str = "/api/v1"
    
    # URL do Banco de Dados PostgreSQL (pgAdmin 4 - Banco 'Barreiro')
    DATABASE_URL: str
    
    # Autenticação JWT — exclusiva para assinatura de tokens
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas
    ENVIRONMENT: str = "production"

    # Chave Fernet para criptografia de dados sensíveis (CPF, RG, PIX, contas).
    # DEVE ser diferente da SECRET_KEY. Se não definida, cai para a SECRET_KEY
    # por compatibilidade com ambientes antigos — defina-a explicitamente em produção.
    ENCRYPTION_KEY: str = ""
    
    # Chaves legadas opcionais (separadas por vírgula) para descriptografar dados históricos
    # sem embutir senhas ou chaves fixas no código fonte.
    LEGACY_ENCRYPTION_KEYS: str = ""
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
