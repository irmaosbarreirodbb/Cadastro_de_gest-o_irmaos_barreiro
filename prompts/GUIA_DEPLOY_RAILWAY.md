# 🚂 Guia Rápido de Deploy no Railway — Distribuidora Irmãos Barreiro

> ⚡ **Status do Repositório:** O código já está sincronizado e publicado no GitHub em:  
> 🔗 **[`iarleymarques/Barreiros-Teste`](https://github.com/iarleymarques/Barreiros-Teste)** (Branch: `main`)

---

## ⏱️ Roteiro Expresso (Deploy em 5 Passos)

```text
┌─────────────────────────────────────────────────────────────┐
│                 PROJETO NO RAILWAY (Mesmo Canvas)           │
│                                                             │
│   ┌──────────────────┐               ┌──────────────────┐   │
│   │   PostgreSQL     │◄──────────────┤ Backend FastAPI  │   │
│   │  (Plugin Nativo) │ DATABASE_URL  │  /backend        │   │
│   └──────────────────┘               └────────▲─────────┘   │
│                                               │             │
│                                          VITE_API_URL       │
│                                               │             │
│                                      ┌────────┴─────────┐   │
│                                      │  Frontend React  │   │
│                                      │ /frontend/meu-...│   │
│                                      └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Passo 1: Criar o Projeto e o PostgreSQL

1. Acesse **[railway.com](https://railway.com)** e faça login com seu GitHub (`iarleymarques`).
2. Clique em **"New Project"** (ou **"Create a New Project"**).
3. Selecione **"Provision PostgreSQL"**.
4. O banco de dados iniciará em segundos.

---

## 🐍 Passo 2: Subir o Backend (FastAPI)

1. No mesmo painel do projeto, clique no botão **"+ New"** (ou `Ctrl + K`).
2. Selecione **"GitHub Repo"** -> Escolha **`iarleymarques/Barreiros-Teste`**.
3. Clique no card gerado e abra a aba **"Settings"**:
   - **Service Name:** Mude para `backend` (opcional, para organização).
   - **Root Directory:** Clique em **Edit**, digite: `/backend` e clique em **Save**.
4. Vá para a aba **"Variables"** e clique em **"Raw Editor"** (ou adicione uma a uma):
   ```env
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   SECRET_KEY=<gere uma chave aleatória longa — ex.: python -c "import secrets; print(secrets.token_urlsafe(64))">
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=480
   ALLOWED_ORIGINS=http://localhost:5173
   ```
   *(No Railway, `${{Postgres.DATABASE_URL}}` puxa automaticamente a conexão do banco que você criou no Passo 1).*

5. Gere a URL pública do Backend:
   - Vá em **"Settings"** -> role até a seção **"Networking"**.
   - Clique em **"Generate Domain"**.
   - Copie o domínio gerado (ex: `https://backend-production-xxxx.up.railway.app`).

---

## ⚛️ Passo 3: Subir o Frontend (React / Vite)

1. No mesmo projeto, clique novamente no botão **"+ New"**.
2. Selecione **"GitHub Repo"** -> Escolha novamente **`iarleymarques/Barreiros-Teste`**.
3. Clique no card gerado e vá na aba **"Settings"**:
   - **Service Name:** Mude para `frontend`.
   - **Root Directory:** Clique em **Edit**, digite: `/frontend/meu-projeto` e clique em **Save**.
   - **Build Command:** O Railway detecta `npm run build` automaticamente.
   - **Start Command:** Digite: `npm run start` (ou `vite preview --host 0.0.0.0 --port $PORT`).
4. Vá para a aba **"Variables"** e adicione:
   ```env
   VITE_API_URL=https://backend-production-xxxx.up.railway.app/api/v1

   > Essa variável é lida durante o build do Vite. Depois de salvar, faça **Redeploy** no serviço do frontend.
   ```
   > ⚠️ **ATENÇÃO:** Substitua pelo link real do seu Backend gerado no Passo 2 e **mantenha `/api/v1` no final**.

5. Gere a URL pública do Frontend:
   - Vá em **"Settings"** -> **"Networking"** -> Clique em **"Generate Domain"**.
   - Copie o link gerado (ex: `https://frontend-production-yyyy.up.railway.app`).

---

## 🔗 Passo 4: Liberar o CORS do Backend

Agora que o frontend tem um endereço oficial:

1. Clique no card do **`backend`** -> aba **"Variables"**.
2. Atualize a variável **`ALLOWED_ORIGINS`** com a URL do seu frontend:
   ```env
   ALLOWED_ORIGINS=https://frontend-production-yyyy.up.railway.app
   ```
3. O Railway fará o redeploy automático do backend em cerca de 10 a 15 segundos.

---

## 🔑 Passo 5: Testar e Acessar o Sistema

O backend executa migrações automáticas e cria o usuário de primeiro acesso no boot:

1. Abra a URL do frontend no seu navegador (`https://frontend-production-yyyy.up.railway.app`).
2. Acesse com as credenciais padrão do sistema:
   - **E-mail:** `colaborador@irmaosbarreiro.com.br`
   - **Senha:** `123`
3. Teste os recursos:
   - [x] Cadastro e Edição de Colaboradores (com máscaras e criptografia)
   - [x] Lançamento de Diaristas & Geração de Recibos
   - [x] Relatório Solar Diário e Mensal (com exportação em PDF)
   - [x] Verificação de saúde da API: acesse `https://backend-production-xxxx.up.railway.app/docs` (Swagger interativo).

---

## 📋 Tabela Resumo de Variáveis

| Serviço | Variável | Valor Exemplo / Configuração |
|---|---|---|
| **backend** | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| **backend** | `SECRET_KEY` | `chave_jwt_longa_e_aleatoria` |
| **backend** | `ALGORITHM` | `HS256` |
| **backend** | `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` |
| **backend** | `ALLOWED_ORIGINS` | `https://frontend-production-yyyy.up.railway.app` |
| **frontend** | `VITE_API_URL` | `https://backend-production-xxxx.up.railway.app/api/v1` |

---

## 💡 Dicas e Soluções Rápidas

- **Deploy automático a cada `git push`:** Sempre que você der `git push origin main`, o Railway atualizará backend e frontend automaticamente.
- **Domínio Próprio:** Se desejar usar seu próprio domínio (ex: `app.irmaosbarreiro.com.br`), basta ir em **"Settings" -> "Custom Domain"** no card do frontend e apontar o `CNAME` no seu provedor de DNS.
- **Logs em tempo real:** Para acompanhar a inicialização, clique em qualquer serviço e abra a aba **"Deployments" -> "View Logs"**.
