import os
import sys
from pathlib import Path

# Valores falsos só para os testes importarem a aplicação sem um .env real.
# Nenhuma conexão com o banco é aberta pelos testes atuais.
os.environ.setdefault("DATABASE_URL", "postgresql://teste:teste@localhost:5432/teste")
os.environ.setdefault("SECRET_KEY", "chave-apenas-para-testes")
os.environ.setdefault("ENVIRONMENT", "development")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
