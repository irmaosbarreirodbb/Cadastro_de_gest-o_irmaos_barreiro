# Especificação e Planejamento do Backend
**Distribuidora Irmãos Barreiro**

Consulte o arquivo principal na raiz do projeto: [PLANO_DESENVOLVIMENTO_BACKEND.md](../PLANO_DESENVOLVIMENTO_BACKEND.md)

## Resumo Rápido de Instalação e Configuração

### Stack Recomendada (FastAPI / Python)
1. **Ativar o Ambiente Virtual**:
   ```bash
   # Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   ```

2. **Instalar Dependências**:
   ```bash
   pip install fastapi "uvicorn[standard]" sqlalchemy alembic pydantic pydantic-settings python-jose[cryptography] passlib[bcrypt] num2words python-multipart
   ```

3. **Estrutura de Pastas Esperada**:
   - `app/api/v1/endpoints/`: Controladores/Rotas da API (`auth.py`, `colaboradores.py`, `diaristas.py`, `funcionarios.py`, `recibos.py`)
   - `app/models/`: Entidades relacionais SQLAlchemy (`usuario`, `colaborador`, `funcionario`, `diarista`, `recibo`)
   - `app/schemas/`: Schemas de entrada e saída Pydantic
   - `app/main.py`: Ponto de entrada do servidor ASGI com suporte a CORS (`http://localhost:5173`)

4. **Execução em Desenvolvimento**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

## Deploy no Railway

Configure o serviço do backend com a raiz apontando para `backend/`. O projeto já possui `Dockerfile` e `Procfile`, e o comando de inicialização usa a porta fornecida pelo Railway.

No Railway, abra `Backend > Variables` e cadastre:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Referência ao PostgreSQL do Railway, normalmente `${{Postgres.DATABASE_URL}}` |
| `SECRET_KEY` | Chave aleatória longa e exclusiva do backend |
| `ENCRYPTION_KEY` | Chave Fernet exclusiva para dados sensíveis |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` |
| `ENVIRONMENT` | `production` |
| `BREVO_API_KEY` | Chave da API transacional da Brevo (`xkeysib-...`) |
| `ALERT_EMAIL_TO` | E-mail que receberá os alertas |
| `ALERT_EMAIL_FROM` | Remetente validado na Brevo |
| `ALERT_EMAIL_FROM_NAME` | `Irmaos Barreiro - Alertas` |
| `ALLOWED_ORIGINS` | Domínio público do frontend, com `https://` |

Na Brevo, valide o endereço usado em `ALERT_EMAIL_FROM`. Depois de salvar as variáveis, faça um novo deploy ou restart do backend. Sem `BREVO_API_KEY` ou `ALERT_EMAIL_TO`, o sistema não envia mensagens.

Para testar sem esperar até 08:00, cadastre ou edite um exame dentro da janela de 10 dias. O backend executa uma verificação em segundo plano após a alteração.
