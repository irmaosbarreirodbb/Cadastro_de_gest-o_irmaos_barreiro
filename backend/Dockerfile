FROM python:3.11-slim

WORKDIR /app

# Instala dependências do sistema para compilação do psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Usuário sem privilégios de administrador para rodar a API.
# A aplicação não grava arquivos em disco (PDFs e anexos ficam no banco).
RUN useradd --create-home --uid 1000 appuser

COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
