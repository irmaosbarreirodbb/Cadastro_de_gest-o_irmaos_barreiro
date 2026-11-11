# Relatório de Auditoria de Segurança e Mapeamento de Vulnerabilidades
**Projeto**: Distribuidora Irmãos Barreiro  
**Data da Auditoria**: 04 de Setembro de 2026  
**Escopo**: Backend (FastAPI / SQLAlchemy / PostgreSQL) e Frontend (React / Vite)  
**Status**: Análise Concluída

---

## 1. Sumário Executivo

Esta auditoria técnica analisou a arquitetura, o fluxo de dados, os endpoints de API e os componentes frontend do sistema da **Distribuidora Irmãos Barreiro**. 

Foram identificadas **16 vulnerabilidades e fragilidades de segurança**, categorizadas de acordo com o padrão **OWASP Top 10 API Security Risks** e a legislação de proteção de dados (**LGPD - Lei nº 13.709/2018**):

| Severidade | Quantidade | Principais Riscos |
| :--- | :---: | :--- |
| **Crítica (Critical)** | **5** | Acesso irrestrito a dados pessoais/bancários, exclusão em massa sem autenticação, chaves hardcoded e rotas desprotegidas |
| **Alta (High)** | **4** | Bypass de hash de senhas, credencial fraca padrão, injeção de identidade em `/me` e scripts de teste no código |
| **Média (Medium)** | **5** | CORS permissivo, ausência de rate limiting, enumeração de usuários, frontend sem envio de JWT, fail-open em criptografia |
| **Baixa / Qualidade (Low)** | **2** | Ausência de migrações estruturadas via Alembic e tempo de expiração de token sem revogação |

---

## 2. Detalhamento das Vulnerabilidades Críticas

### VULN-01: Ausência Total de Autenticação e Autorização nos Endpoints da API (BOLA / BFLA)
- **Classificação OWASP**: API1:2023 - Broken Object Level Authorization / API5:2023 - Broken Function Level Authorization
- **Arquivos**:
  - `backend/app/api/v1/endpoints/colaboradores.py`
  - `backend/app/api/v1/endpoints/diaristas.py`
  - `backend/app/api/v1/endpoints/recibos.py`
  - `backend/app/api/v1/endpoints/funcionarios.py`
- **Mecânica da Falha**: As funções dos endpoints recebem apenas `db: Session = Depends(get_db)`. Não há dependência de validação de token JWT (`Depends(get_current_active_user)`).
- **Impacto**: Qualquer requisição HTTP externa direta (via cURL, Postman ou script) consegue listar, criar, alterar status de pagamento ou excluir registros sem fornecer nenhuma credencial ou token de acesso.
- **Remediação Recomendada**: Implementar middleware ou dependência FastAPI em todas as rotas protegidas:
  ```python
  from app.api.deps import get_current_user
  @router.get("", dependencies=[Depends(get_current_user)])
  ```

---

### VULN-02: Exposição Irrestrita de Dados Pessoais e Bancários Sensíveis (LGPD / PII Leakage)
- **Classificação OWASP**: API3:2023 - Broken Object Property Level Authorization
- **Legislação**: Art. 46 e 52 da LGPD (Lei nº 13.709/2018)
- **Arquivo**: `backend/app/api/v1/endpoints/colaboradores.py` (linhas 48-69)
- **Mecânica da Falha**: A rota `GET /api/v1/colaboradores` chama a função `_descriptografar_colaborador()` em todos os itens retornados. Os campos sensíveis (**CPF, RG, Telefone, Agência, Conta Corrente, Chave PIX e Endereço Completo**) são expostos em texto claro em uma rota desprotegida.
- **Impacto**: Vazamento em massa de dados protegidos por lei, sujeitando a empresa a sanções administrativas pela ANPD, multas e processos trabalhistas/civis.
- **Remediação Recomendada**:
  - Exigir autenticação administrativa estrita.
  - No schema de resposta pública ou listagem geral, mascarar dados sensíveis (ex: CPF: `***.456.789-**`, Conta: `*****-2`).
  - Implementar logs de auditoria para cada acesso aos dados descriptografados.

---

### VULN-03: Endpoint de Exclusão em Massa sem Validação ou Autenticação (Mass Deletion)
- **Classificação OWASP**: API5:2023 - Broken Function Level Authorization
- **Arquivo**: `backend/app/api/v1/endpoints/diaristas.py` (linhas 108-115)
- **Mecânica da Falha**:
  ```python
  @router.delete("/reset/dia")
  def resetar_diaristas(data: Optional[str] = Query(None), db: Session = Depends(get_db)):
      query = db.query(DiaristaLancamento)
      if data:
          query = query.filter(DiaristaLancamento.data == data)
      query.delete(synchronize_session=False)
      db.commit()
  ```
  Caso a requisição `DELETE /api/v1/diaristas/reset/dia` seja disparada sem o parâmetro `data`, a instrução `query.delete()` apaga **todas as linhas** de toda a tabela histórica de diárias da empresa.
- **Impacto**: Negação de serviço e destruição total dos dados operacionais e financeiros da distribuidora.
- **Remediação Recomendada**:
  - Exigir autenticação e papel de administrador (`role == "admin"`).
  - Tornar o parâmetro `data` obrigatório ou proibir exclusão sem data explícita.
  - Implementar *soft-delete* (`deleted_at = datetime.utcnow()`) com rotinas de backup.

---

### VULN-04: Chaves Criptográficas e Segredos Hardcoded no Código (Hardcoded Secrets)
- **Classificação OWASP**: API8:2023 - Security Misconfiguration
- **Arquivos**:
  - `backend/app/core/config.py` (linhas 9, 12)
  - `backend/app/core/encryption.py` (linhas 6-11)
  - `backend/.env` (linhas 2, 5)
- **Mecânica da Falha**:
  - `SECRET_KEY = "<valor removido>"` está gravada estaticamente no código.
  - A mesma chave é usada para assinar tokens JWT e para gerar a chave simétrica AES/Fernet que protege os dados dos colaboradores.
  - A senha do banco de dados (`<valor removido>`) também consta no arquivo de configuração padrão.
- **Impacto**: Qualquer pessoa com acesso ao repositório ou com capacidade de leitura do arquivo pode:
  1. Forjar tokens JWT válidos para qualquer identidade de usuário.
  2. Descriptografar offline todos os CPFs, RGs, contas bancárias e PIX salvos no banco.
- **Remediação Recomendada**:
  - Separar a chave de assinatura JWT da chave de criptografia de dados (usar chaves distintas: `JWT_SECRET_KEY` e `FIELD_ENCRYPTION_KEY`).
  - Carregar chaves exclusivamente via variáveis de ambiente seguras (sem valores default em código).
  - Gerar chaves criptográficas fortes usando geradores criptográficos (`openssl rand -hex 32` ou `secrets.token_urlsafe(32)`).

---

### VULN-05: Rota Frontend `/portal` sem Proteção de Acesso (Client-Side Unprotected Route)
- **Classificação OWASP**: Broken Access Control
- **Arquivo**: `frontend/meu-projeto/src/App.jsx` (linhas 82-91)
- **Mecânica da Falha**: O componente `<PortalColaborador>` é renderizado diretamente ao acessar a URL `/portal`, sem checar se `isLoggedIn === true`.
- **Impacto**: Qualquer pessoa acessando o navegador entra na área restrita administrativa diretamente sem passar pela autenticação do modal.
- **Remediação Recomendada**: Implementar um componente de Rota Protegida (`<ProtectedRoute>`):
  ```jsx
  <Route
    path="/portal"
    element={
      isLoggedIn ? (
        <PortalColaborador user={user} onLogout={handleLogout} />
      ) : (
        <Navigate to="/" replace />
      )
    }
  />
  ```

---

## 3. Detalhamento das Vulnerabilidades de Severidade Alta

### VULN-06: Bypass de Hash de Senha com Comparação em Plaintext
- **Arquivo**: `backend/app/core/security.py` (linhas 9-13)
- **Mecânica da Falha**:
  ```python
  def verify_password(plain_password: str, hashed_password: str) -> bool:
      if not hashed_password.startswith("$2b$") and not hashed_password.startswith("$2a$"):
          return plain_password == hashed_password
      return pwd_context.verify(plain_password, hashed_password)
  ```
  Se uma senha for inserida no banco em texto puro por engano ou durante testes, a função aceita login direto sem exigir BCrypt.
- **Remediação**: Remover o fallback em texto plano e forçar estritamente a validação por BCrypt.

---

### VULN-07: Usuário Padrão com Credenciais Fracas Criado Automaticamente
- **Arquivo**: `backend/main.py` (linhas 41-48)
- **Mecânica da Falha**: Na inicialização (`init_db`), se a tabela de usuários estiver vazia, é inserido automaticamente o usuário `colaborador@irmaosbarreiro.com.br` com a senha `"123"`.
- **Remediação**: Exigir configuração de credenciais administrativas fortes via variáveis de ambiente na primeira implantação, ou script interativo de primeiro acesso que force a troca de senha.

---

### VULN-08: Injeção de Identidade e Falta de Validação em `/auth/me`
- **Arquivo**: `backend/app/api/v1/endpoints/auth.py` (linhas 36-44)
- **Mecânica da Falha**:
  ```python
  @router.get("/me", response_model=UserOut)
  def get_current_user(email: str = "colaborador@irmaosbarreiro.com.br", db: Session = Depends(get_db)):
  ```
  O endpoint aceita um parâmetro de query string `email` em vez de inspecionar o token JWT no cabeçalho `Authorization`.
- **Remediação**: Extrair a identidade (`user_id` ou `sub`) diretamente do payload verificado do token JWT da requisição.

---

### VULN-09: Scripts de Ataque/Teste de Força Bruta Presentes no Código Fonte
- **Arquivo**: `backend/test_pwds.py`
- **Mecânica da Falha**: O arquivo contém um dicionário de senhas e um loop de força-bruta contra o PostgreSQL local que sobrescreve o `.env`.
- **Remediação**: Remover arquivos de teste locais (`test_pwds.py`, `test_conn.py`) do repositório ou adicioná-los ao `.gitignore`.

---

## 4. Detalhamento das Vulnerabilidades de Severidade Média

### VULN-10: Configuração Permissiva de CORS (Wildcard + Credentials)
- **Arquivo**: `backend/main.py` (linhas 64-70)
- **Mecânica da Falha**: Configura `allow_origins=["...", "*"]` com `allow_credentials=True`. Pelo padrão W3C/Fetch, essa combinação é insegura e pode gerar comportamentos anômalos em navegadores modernos.
- **Remediação**: Especificar explicitamente apenas as origens permitidas (ex: domínios oficiais da empresa e portas de desenvolvimento autorizadas).

---

### VULN-11: Ausência de Rate Limiting (Proteção contra Brute Force)
- **Arquivo**: `backend/app/api/v1/endpoints/auth.py`
- **Mecânica da Falha**: Não há limite de tentativas de login por IP ou por conta.
- **Remediação**: Integrar bibliotecas como `slowapi` limitando tentativas (ex: máximo 5 tentativas por minuto por IP).

---

### VULN-12: Enumeração de Contas por Diferenciação de Erro no Login
- **Arquivo**: `backend/app/api/v1/endpoints/auth.py` (linhas 16-27)
- **Mecânica da Falha**: O sistema retorna "Usuário não encontrado" se o e-mail não existir e "Senha incorreta" se o e-mail existir.
- **Remediação**: Unificar a resposta de erro para: *"E-mail ou senha incorretos."* com código HTTP 401.

---

### VULN-13: Comunicação Frontend sem Token de Autenticação (`api.js`)
- **Arquivo**: `frontend/meu-projeto/src/services/api.js`
- **Mecânica da Falha**: As funções que chamam a API (`getDiaristasApi`, `createDiaristaApi`, `deleteDiaristaApi`, etc.) utilizam `fetch` simples sem incluir o cabeçalho `Authorization: Bearer <token>`.
- **Remediação**: Armazenar o token em local seguro (`sessionStorage` ou cookie `HttpOnly`) e criar um interceptador que injete o header `Authorization` em todas as chamadas.

---

### VULN-14: Criptografia com Tratamento Silencioso de Erros (*Fail-Open*)
- **Arquivo**: `backend/app/core/encryption.py` (linhas 24-26)
- **Mecânica da Falha**: Se ocorrer um erro durante a criptografia de um campo sensível, a exceção é capturada e o valor original em texto puro é retornado e gravado no banco.
- **Remediação**: Adotar princípio *Fail-Closed*: disparar exceção explícita (`raise ValueError(...)`) para impedir a gravação de dados não criptografados no banco de dados.

---

## 5. Vulnerabilidades de Baixa Severidade e Qualidade de Código

### VULN-15: Migrações SQL Executadas sem Controle de Versão (Sem Alembic)
- **Arquivo**: `backend/main.py` (linhas 18-35)
- **Descrição**: O script executa comandos `ALTER TABLE` diretamente na inicialização ignorando exceções.
- **Remediação**: Utilizar migrações formais com **Alembic** (`alembic upgrade head`).

### VULN-16: Token JWT com Validade Longa sem Mecanismo de Revogação
- **Arquivo**: `backend/app/core/config.py` (linha 14: 480 minutos / 8 horas)
- **Descrição**: Tokens emitidos permanecem válidos por 8 horas mesmo se o usuário for desativado.
- **Remediação**: Reduzir validade do access token (ex: 30 a 60 minutos), implementar refresh token e verificação de usuário ativo no banco a cada requisição.

---

## 6. Plano de Ação e Recomendações Prioritárias

| Prioridade | Ação de Correção | Impacto |
| :---: | :--- | :--- |
| **1** | Implementar `Depends(get_current_user)` em todos os endpoints de `/api/v1` | Bloqueia acesso externo anônimo a dados pessoais e operacionais |
| **2** | Proteger a rota `/portal` no React com `<ProtectedRoute>` | Impede que qualquer visitante acesse a área interna |
| **3** | Exigir confirmação/autenticação no `DELETE /reset/dia` e remover exclusão total sem data | Elimina o risco de perda catastrófica do banco de dados |
| **4** | Separar e externalizar `SECRET_KEY` e `DATABASE_URL` via variáveis de ambiente reais | Impede forjamento de tokens e quebra offline de criptografia |
| **5** | Enviar `Authorization: Bearer <token>` em todas as chamadas no `api.js` | Fecha o ciclo de segurança entre frontend e backend |
| **6** | Unificar mensagens de erro no login e adicionar rate limiting com `slowapi` | Neutraliza ataques de força-bruta e enumeração de e-mails |
