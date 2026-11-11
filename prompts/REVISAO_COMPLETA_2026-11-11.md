# Revisão Completa do Projeto — Portal Irmãos Barreiro

**Data:** 11/11/2026
**Branch analisada:** `feature/saber` (commit `c283d9e`)
**Escopo:** backend (FastAPI), frontend (React/Vite), configuração de deploy, repositório Git e histórico.

> Nenhum valor de segredo aparece neste documento. Onde um segredo foi encontrado, mostramos só o arquivo, a linha e uma versão mascarada.

---

## 1. Visão geral do projeto

| Item | Detalhe |
|---|---|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2, PostgreSQL, JWT (`python-jose`), bcrypt, Fernet (`cryptography`), pandas/openpyxl (importação), reportlab (PDF), Brevo (e-mail) |
| **Frontend** | React 19, Vite 8, Tailwind 4, React Router 7, jsPDF, html2canvas, pdfjs |
| **Deploy** | Railway (backend via `Dockerfile`/`Procfile`; frontend via `vite preview`) |
| **Autenticação** | Login por e-mail/senha → JWT em cookie HttpOnly **e** no corpo da resposta (guardado no `sessionStorage`) |
| **Dados sensíveis** | CPF, RG, telefone, agência, conta, chave PIX, CNPJ, nº de CNH, PDFs de exames toxicológicos e CNH, documentos pessoais (identidade, comprovantes) |
| **Módulos** | Fichas de colaboradores (PF/PJ), documentos anexos, diaristas, recibos, permissões de trabalho (PTs), EPIs (estoque, entregas, fichas PDF, importação NF-e XML), exames toxicológicos, CNHs, alertas automáticos por e-mail |
| **Tamanho** | ~28 mil linhas (backend ~8 mil, frontend ~20 mil); 182 arquivos versionados; 118 commits |
| **Testes automatizados** | **Nenhum** |

### Pontos positivos (o que já está bem feito)

- Todas as rotas de dados exigem autenticação (`get_current_user`); só `/auth/login`, `/auth/logout`, `/recibos/extenso`, `/` e `/health` são públicas.
- Senhas com bcrypt; mensagem de erro de login idêntica para usuário inexistente e senha errada.
- Dados pessoais e anexos criptografados no banco (Fernet / `MultiFernet` com suporte a rotação).
- Uploads com lista de tipos permitidos, limite de 10 MB e checagem da assinatura do arquivo (magic bytes).
- Nenhuma query SQL montada com concatenação de strings (sem SQL injection encontrada).
- E-mails de alerta escapam o HTML (`html.escape`).
- Swagger/ReDoc desativados em produção; headers de segurança (HSTS, CSP, X-Frame-Options) na API.
- `.gitignore` cobre `.env`, `.venv`, `node_modules`, `credenciais*.txt` e a pasta `COISAS IMPORTANTES/`.
- `npm run build` conclui sem erros.

---

## 2. Resumo dos problemas

| Severidade | Quantidade |
|---|---|
| 🔴 Crítico | 2 |
| 🟠 Alto | 6 |
| 🟡 Médio | 11 |
| 🔵 Baixo | 12 |

**Ordem sugerida de correção:** C1 → C2 → A1 → A2 → A3 → A4 → A5 → A6 → médios → baixos.

---

## 3. 🔴 Críticos

### 🔴 [C1] `SECRET_KEY` de produção versionada no Git
- **Onde:**
  - `prompts/GUIA_DEPLOY_RAILWAY.md`, linha 49 — `SECRET_KEY=irmao****`
  - `prompts/RELATORIO_DE_VULNERABILIDADES.md`, linha 85 — `SECRET_KEY = "irmao****"`
  - Histórico: commits `ff293c8` ("Primeiro commit") e `2da7262`.
  - Também no histórico: senha do PostgreSQL local (`postgresql://postgres:qwe****@localhost`) em `backend/app/core/config.py`, do commit `ff293c8` até `b81523f`.
- **O que está acontecendo:** a chave que assina os tokens de login (JWT) foi escrita em dois documentos do repositório. Remover só do arquivo não resolve, porque ela continua no histórico do Git e em qualquer clone já feito.
- **Por que é perigoso:**
  1. Quem tem a `SECRET_KEY` consegue **fabricar um token de login válido** para qualquer usuário, sem saber a senha. O token só precisa do `id` do usuário, e esses ids estão no arquivo `backend/seeds/inserir_usuarios.sql` (ver A1). Ou seja: o repositório sozinho entrega acesso total ao sistema.
  2. A `SECRET_KEY` também é usada como chave de criptografia de reserva (`backend/app/core/encryption.py`, linhas 21 e 28). Se a `ENCRYPTION_KEY` não estiver definida em produção, ou se houver dados antigos criptografados com a `SECRET_KEY`, quem tiver um dump do banco consegue ler CPF, RG, PIX e contas bancárias.
- **Como corrigir:**
  1. **Gerar uma nova `SECRET_KEY`** no Railway (ex.: `python -c "import secrets; print(secrets.token_urlsafe(64))"`). Isso derruba todas as sessões ativas, o que é o desejado.
  2. Antes de trocar, **confirmar que `ENCRYPTION_KEY` está definida** em produção. Se houver dados criptografados com a chave antiga, colocar a chave antiga em `LEGACY_ENCRYPTION_KEYS` (variável de ambiente, nunca no código), recriptografar os dados com a nova chave e depois remover a antiga.
  3. Apagar as linhas com a chave dos dois arquivos `.md`.
  4. Se o repositório for (ou já foi) público, considerar limpar o histórico com `git filter-repo` — só com autorização do responsável, pois reescreve o histórico de todos.
  5. Se a senha `qwe****` do Postgres local for usada em qualquer outro lugar, trocá-la.
- 🟡 **Parcialmente corrigido em 11/11/2026:** chave e senha removidas de `GUIA_DEPLOY_RAILWAY.md` e `RELATORIO_DE_VULNERABILIDADES.md`. **Pendente (responsável):** gerar nova `SECRET_KEY` no Railway e confirmar `ENCRYPTION_KEY`. Os valores continuam no histórico do Git.

### 🔴 [C2] CORS aceita **qualquer** site hospedado no Railway, com cookies
- **Onde:** `backend/main.py`, linha 446 — `allow_origin_regex=r"https://.*\.up\.railway\.app"` junto com `allow_credentials=True`; cookie de sessão com `SameSite=None` em `backend/app/api/v1/endpoints/auth.py`, linha 44.
- **O que está acontecendo:** o backend diz ao navegador "pode confiar em qualquer endereço que termine em `.up.railway.app` e pode mandar o cookie de login junto". Qualquer pessoa cria uma conta grátis no Railway e ganha um endereço desses.
- **Por que é perigoso:** um atacante publica uma página em `qualquercoisa.up.railway.app` e manda o link para alguém do RH. Se essa pessoa estiver logada no portal, a página do atacante consegue chamar a API **em nome dela** e **ler as respostas**: lista de colaboradores com CPF, RG, conta, PIX, documentos anexados, exames toxicológicos — e também apagar dados (rotas `limpar-todos`).
- **Como corrigir:** remover o `allow_origin_regex` e deixar apenas a lista explícita de domínios (`production_origins` + `ALLOWED_ORIGINS`). Adicionar um teste que garanta que uma origem desconhecida não recebe `Access-Control-Allow-Origin`.
- ✅ **Corrigido em 11/11/2026:** `allow_origin_regex` removido. Teste: `backend/tests/test_cors.py`.

---

## 4. 🟠 Altos

### 🟠 [A1] E-mails, ids e hashes de senha dos usuários reais versionados
- **Onde:** `backend/seeds/inserir_usuarios.sql`
- **O que está acontecendo:** o arquivo tem `INSERT`s com o id, o e-mail e o hash bcrypt da senha de usuários do sistema.
- **Por que é perigoso:** os hashes podem ser quebrados offline por força bruta (senhas fracas caem rápido), e os ids permitem forjar tokens se a `SECRET_KEY` vazar (C1).
- **Como corrigir:** remover o arquivo do repositório (`git rm --cached` e mover para fora do projeto); **trocar a senha desses usuários**; criar usuários por um script que lê e-mail/senha do terminal ou de variável de ambiente.
- 🟡 **Parcialmente corrigido em 11/11/2026:** arquivo removido do Git e movido para `COISAS IMPORTANTES/seeds/` (ignorado); `backend/seeds/*.sql` e `*.dump` adicionados ao `.gitignore`. As senhas **não serão trocadas** (decisão do responsável); o risco restante depende da força das senhas (bcrypt custo 12) e de o histórico do Git não ser público. A troca da `SECRET_KEY` (C1) neutraliza o uso dos ids para forjar tokens. Sugestão futura: criar a função "trocar minha senha".

### 🟠 [A2] Limite de tentativas usa o IP do proxy do Railway — um atacante bloqueia o login de todo mundo
- **Onde:** `backend/app/core/rate_limit.py`, linha 17 (`request.client.host`); comando de start em `backend/Dockerfile`, linha 18, e `backend/Procfile`.
- **O que está acontecendo:** no Railway, as requisições chegam através de um proxy. Como o Uvicorn não está configurado para confiar nesse proxy (`--forwarded-allow-ips`), é muito provável que todos os usuários apareçam com o **mesmo IP**. O limite é de 5 logins a cada 15 min e 10 cadastros por hora.
- **Por que é perigoso:** qualquer pessoa na internet erra a senha 5 vezes e **ninguém da empresa consegue logar por 15 minutos**; dá para repetir isso sem parar. O RH também fica travado depois de 10 cadastros por hora (somando todos os usuários). Além disso, o contador fica em memória: reiniciou o servidor, zerou; com mais de uma instância, cada uma conta separado.
- **Como corrigir:** iniciar com `uvicorn main:app --proxy-headers --forwarded-allow-ips="*"` (o Railway só aceita tráfego pelo proxy dele); limitar o login também por e-mail, não só por IP; confirmar nos logs que os IPs reais aparecem.
- ✅ **Corrigido em 11/11/2026:** `rate_limit.py` usa o cabeçalho `X-Real-IP`, que o Railway preenche com o IP do visitante (só fora de desenvolvimento). Teste: `backend/tests/test_rate_limit.py`. Pendente: o contador continua em memória (zera no restart; com várias réplicas cada uma conta separado).

### 🟠 [A3] "Migrações" rodam em toda inicialização, numa única transação, com erros engolidos
- **Onde:** `backend/main.py`, linhas 30–218.
- **O que está acontecendo:** a cada boot, o servidor executa ~50 comandos SQL (`ALTER TABLE`, `CREATE TABLE`, cópia de dados) dentro de **uma só transação**. Cada erro é apenas impresso (`print`) e o próximo comando é tentado.
- **Por que é perigoso:**
  - No PostgreSQL, depois que um comando falha dentro de uma transação, **todos os seguintes falham** ("current transaction is aborted") e o `commit` final vira `rollback`. Ou seja, um erro em um comando desfaz **silenciosamente** todas as alterações de estrutura seguintes, e funcionalidades podem quebrar sem explicação.
  - Há uma cópia de dados escrita para uma pessoa específica (`WHERE nome_completo ILIKE '%PEDRO ALCANTRA%'`, linhas 67–87) que roda em todo boot — é dado pessoal no código e uma correção pontual que nunca foi retirada.
  - Não há como saber qual versão do banco está em produção nem como voltar uma alteração.
- **Como corrigir:** adotar **Alembic** (versões numeradas, `upgrade`/`downgrade`); criar uma migração inicial com o estado atual; remover o bloco do código; se for necessário manter temporariamente, executar cada comando em sua própria transação e falhar de forma visível.

### 🟠 [A4] Listagens carregam todos os PDFs do banco para a memória
- **Onde:** `backend/app/api/v1/endpoints/exames.py`, linha 52 (`listar_exames`); `backend/app/api/v1/endpoints/cnhs.py`, linhas 74–116 (`listar_cnhs` — com busca, a tabela é carregada **duas vezes**); exportação de PDF; scheduler (`email_service.py`, linha 343).
- **O que está acontecendo:** as tabelas `exames_toxicologicos` e `cnhs_funcionarios` guardam o PDF (até 10 MB cada) numa coluna `BYTEA`. As consultas usam `db.query(Modelo).all()`, que traz **o arquivo inteiro de cada linha** só para montar uma lista de nomes e datas.
- **Por que é perigoso:** com 50 motoristas e PDFs de 2 MB, cada abertura da tela move ~100 MB do banco para a memória. O container do Railway pode estourar memória e reiniciar, a tela fica lenta e o custo de tráfego sobe.
- **Como corrigir:** marcar as colunas de PDF como `deferred()` no modelo (ou usar `load_only`) e só carregar o arquivo nas rotas de download. A longo prazo, guardar arquivos em storage de objetos (S3/R2/bucket do Railway) e manter só a referência no banco.

### 🟠 [A5] Dependências com vulnerabilidades conhecidas
- **Onde:** `frontend/meu-projeto/package-lock.json` e `backend/requirements.txt`.
- **O que está acontecendo:**
  - `npm audit`: **1 crítica** (`dompurify` ≤ 3.4.16 — várias falhas de XSS, vem como dependência de `jspdf`), **2 altas** (`vite` 8.2.0–8.2.2 e `source-map-js`).
  - `pip-audit`: `python-jose` 3.5.0 (PYSEC-2026-4298) e `ecdsa` 0.19.2 (PYSEC-2026-1325). O `python-jose` está praticamente sem manutenção.
  - `requirements.txt` usa só `>=` (sem versão fixa): cada deploy pode instalar versões diferentes, inclusive com quebras.
- **Como corrigir:** `npm audit fix` e testar a geração de PDFs; trocar `python-jose` por **PyJWT** (a API é quase igual: `jwt.encode`/`jwt.decode`); fixar versões (`pip freeze > requirements.txt` ou `pip-tools`); remover `psycopg[binary]` se só o `psycopg2` é usado (hoje os dois são instalados).

### 🟠 [A6] Qualquer usuário logado pode ver tudo e apagar tudo
- **Onde:** todo o backend — não existe perfil/papel em `backend/app/models/usuario.py`. Rotas destrutivas: `DELETE /epis/limpar-todos`, `DELETE /epis/funcionarios/limpar-todos`, `DELETE /diaristas/reset/dia`, `DELETE /cnhs/limpar-todos`, `DELETE /exames/limpar-todos`.
- **O que está acontecendo:** todo usuário autenticado tem acesso total: lê CPF, contas e PIX de todos, baixa exames toxicológicos e documentos, e pode apagar tabelas inteiras com uma chamada. Não há registro de quem fez o quê (log de auditoria).
- **Por que é perigoso:** uma conta comprometida, um clique errado ou um ex-funcionário com sessão ativa apaga dados sem possibilidade de saber quem foi. Para dados de saúde (exame toxicológico) e bancários, a LGPD exige controle de acesso e rastreabilidade.
- **Como corrigir:** adicionar campo `perfil` (ex.: `ADMIN`, `RH`, `OPERACIONAL`) e checar nas rotas sensíveis; restringir as rotas `limpar-todos` a admin (ou removê-las); criar tabela de auditoria (usuário, ação, registro, data) para leituras de documentos e todas as exclusões.

---

## 5. 🟡 Médios

### 🟡 [M1] Rotas `DELETE /cnhs/limpar-todos` e `DELETE /exames/limpar-todos` nunca funcionam (confirmado)
- **Onde:** `backend/app/api/v1/endpoints/cnhs.py`, linhas 220 e 245; `backend/app/api/v1/endpoints/exames.py`, linhas 141 e 160.
- **O que está acontecendo:** a rota `/{cnh_id}` foi declarada **antes** de `/limpar-todos`. O FastAPI testa na ordem, então `limpar-todos` é tratado como um id, falha na conversão para número e devolve erro 422. Verificado executando o roteador: `DELETE /cnhs/limpar-todos -> /{cnh_id} (deletar_cnh)`.
- **Impacto:** funcionalidade morta hoje (o frontend não chama essas rotas). Se alguém mudar o tipo do id para `str`, vira um bug pior.
- **Como corrigir:** mover as rotas fixas para cima das rotas com `{id}` (ou decidir removê-las, ver A6).
- ✅ **Corrigido em 11/11/2026:** rotas `limpar-todos` declaradas antes de `/{id}`. Teste: `backend/tests/test_rotas_limpar_todos.py`.

### 🟡 [M2] Alerta de exame "vencendo" nunca é reenviado depois de uma renovação
- **Onde:** `backend/app/services/email_service.py`, linhas 365–381.
- **O que está acontecendo:** o comentário diz "não reenvia enquanto o vencimento não mudar", mas o código só verifica se **já existiu algum alerta** para aquele `exame_id`. Quando o exame é renovado (a data de vencimento é atualizada no mesmo registro), o alerta antigo continua lá e, no próximo ciclo de vencimento, o aviso de "vencendo" **não sai**. Só sai depois que o exame já venceu.
- **Por que é perigoso:** motorista com exame toxicológico vencido rodando é risco legal (CTB) — o sistema existe justamente para avisar antes.
- **Como corrigir:** gravar a `data_vencimento` junto com o alerta em `alertas_exames_enviados` e só considerar alertas daquela mesma data de vencimento.
- ✅ **Corrigido em 11/11/2026 (sem mudar o banco):** só conta como "já alertado" o alerta enviado a partir do início da janela do vencimento atual (vencimento − 10 dias). Funciona também para os registros antigos. Regra em `_deve_alertar_vencendo` (`email_service.py`); teste: `backend/tests/test_alertas_exames.py`.

### 🟡 [M3] Data inválida faz o exame/CNH aparecer como "OK" para sempre
- **Onde:** `backend/app/models/exame_toxicologico.py`, linhas 38–48; mesmo padrão em `backend/app/models/cnh.py`, linhas 41–50.
- **O que está acontecendo:** as datas são guardadas como texto. Se não estiverem em `DD/MM/AAAA` ou `AAAA-MM-DD` (ex.: `5/3/26`, `05-03-2026`, espaço extra), a função devolve **9999 dias** e o status vira `OK`, sem alerta.
- **Como corrigir:** validar o formato na entrada (schemas e importadores) e migrar as colunas para o tipo `DATE`; tratar data inválida como status `INVÁLIDO`, visível na tela.

### 🟡 [M4] Token de login acessível pelo JavaScript, apesar do cookie HttpOnly
- **Onde:** `backend/app/api/v1/endpoints/auth.py`, linha 49 (token no corpo da resposta); `frontend/meu-projeto/src/services/api.js`, linhas 31–75 (token no `sessionStorage`).
- **O que está acontecendo:** o sistema usa dois mecanismos ao mesmo tempo. O cookie HttpOnly protege o token contra roubo por XSS, mas como o mesmo token também fica no `sessionStorage`, essa proteção é anulada. O logout só apaga o cookie: o token continua válido por 8 horas.
- **Como corrigir:** escolher um mecanismo. Recomendado: só cookie HttpOnly (com proteção CSRF, já que o cookie é `SameSite=None`). Considerar expiração menor e lista de tokens revogados (ou `token_version` no usuário).

### 🟡 [M5] Agendadores de e-mail rodam como threads dentro do servidor web
- **Onde:** `backend/main.py`, linhas 238–409.
- **O que está acontecendo:** ao importar `main.py`, duas threads começam a rodar. Com mais de um worker/réplica, cada uma dispara seu próprio agendador (o controle anti-duplicata no banco tem condição de corrida). Os logs imprimem **nomes de motoristas** com alertas de exame toxicológico (linhas 296 e 381; `email_service.py`, linha 417) — dado de saúde em log.
- **Como corrigir:** mover para um job agendado separado (Cron do Railway chamando um script) ou usar um lock no banco (`pg_advisory_lock`); trocar `print` por `logging` sem nomes, só contagens.

### 🟡 [M6] Autocomplete de funcionários devolve a chave PIX de todo mundo
- **Onde:** `backend/app/api/v1/endpoints/funcionarios.py`, linhas 266–386 (`GET /funcionarios-base`).
- **O que está acontecendo:** a cada busca, a rota carrega **todas** as fichas de colaboradores, registros, diaristas e funcionários, descriptografa as chaves PIX e devolve tudo.
- **Por que é perigoso:** viola o princípio de minimização da LGPD (o autocomplete precisa de nome e função, não de PIX) e fica lento conforme a base cresce.
- **Como corrigir:** filtrar no banco (`ILIKE`, `LIMIT 20`) e só devolver a chave PIX quando um funcionário específico for selecionado.

### 🟡 [M7] Nenhuma listagem tem paginação
- **Onde:** 32 chamadas `.all()` em `backend/app/api/` e nenhum `.limit()`/`.offset()`.
- **Impacto:** colaboradores, recibos, diaristas, PTs e entregas de EPI crescem sem limite; cada abertura de tela traz a tabela inteira e descriptografa campo a campo.
- **Como corrigir:** parâmetros `limit`/`offset` (ou cursor) nas rotas de listagem e paginação no frontend.

### 🟡 [M8] Detalhes da criptografia que podem causar perda ou vazamento silencioso
- **Onde:** `backend/app/core/encryption.py`.
- **O que está acontecendo:**
  - Linha 21: se `ENCRYPTION_KEY` estiver vazia, a `SECRET_KEY` vira a chave de criptografia (ver C1). Em produção isso deveria impedir o servidor de subir.
  - Linhas 53–54: qualquer texto que comece com `gAAAAA` é tratado como "já criptografado" e salvo **em texto puro**.
  - Linhas 67–71 e 85–89: se a descriptografia falhar (chave errada), o sistema devolve o texto cifrado ou o arquivo cifrado **sem nenhum aviso** — uma troca errada de chave passa despercebida.
  - `cnh_numero` é salvo em texto puro em `pessoas_fisicas_cadastros`, mas criptografado em `cnhs_funcionarios` — inconsistente.
  - A criptografia não é determinística, então o índice em `cpf` (`colaborador.py`, linha 16) não serve para nada e não há como impedir CPF duplicado.
- **Como corrigir:** tornar `ENCRYPTION_KEY` obrigatória fora de desenvolvimento; tentar descriptografar em vez de checar prefixo; registrar falhas de descriptografia em log (sem o valor); criptografar `cnh_numero` também; se precisar buscar/deduplicar CPF, guardar um hash HMAC do CPF numa coluna separada.
- 🟡 **Parcialmente corrigido em 11/11/2026** (após incidente real de troca da `ENCRYPTION_KEY`): falhas de descriptografia agora geram erro no log (sem o valor); no boot o servidor confere, só com leitura, se a chave abre amostras do banco e mostra um aviso destacado se não abrir; aviso quando `ENCRYPTION_KEY` não está definida. O token continua sendo devolvido em caso de falha **de propósito** (salvar o registro preserva o dado). Teste: `backend/tests/test_encryption.py`. Pendente: `cnh_numero` em texto puro e índice inútil em `cpf`.

### 🟡 [M9] Imagem Docker sem `.dockerignore` e rodando como root
- **Onde:** `backend/Dockerfile`.
- **O que está acontecendo:** `COPY . .` copia tudo da pasta `backend/`, incluindo `backend/.env` (com os segredos reais) e `backend/.venv` em um build local. O container roda como root.
- **Como corrigir:** criar `backend/.dockerignore` com `.env`, `.env.*`, `.venv`, `__pycache__`, `seeds/`; adicionar `USER` não-root no Dockerfile; remover `build-essential` (não é necessário com `psycopg2-binary`).
- ✅ **Corrigido em 11/11/2026:** `.dockerignore` criado e container rodando como `appuser`. `build-essential` mantido (não havia Docker local para testar a remoção).

### 🟡 [M10] Frontend em produção servido pelo `vite preview`
- **Onde:** `frontend/meu-projeto/package.json` (script `start`) e `vite.config.js` (`allowedHosts: true`).
- **O que está acontecendo:** a documentação do Vite diz que o `preview` não é um servidor de produção. Não há cabeçalhos de segurança (CSP, X-Frame-Options) no site, e `allowedHosts: true` desliga a proteção contra DNS rebinding.
- **Como corrigir:** servir o `dist/` com um servidor estático (ex.: Caddy/Nginx, ou `serve`) configurado com headers de segurança e fallback para `index.html`.

### 🟡 [M11] Fichas de colaboradores não podem ser editadas nem excluídas
- **Onde:** `backend/app/api/v1/endpoints/colaboradores.py` e `pessoas_juridicas.py` — só existem rotas de criar, listar, ver e mudar status.
- **Por que importa:** a LGPD garante ao titular o direito de correção e eliminação dos dados. Hoje isso só é possível direto no banco. Além disso, `StatusUpdate.status` aceita qualquer texto (sem validação dos valores `PENDENTE`, `VALIDADO`, `REVISAO_SOLICITADA`).
- **Como corrigir:** criar rotas de edição e exclusão (restritas por perfil, ver A6) e usar `Literal[...]`/`Enum` no schema de status.

---

## 6. 🔵 Baixos

| ID | Problema | Onde | Sugestão |
|---|---|---|---|
| B1 | **Nenhum teste automatizado** (nem backend, nem frontend). Bugs como M1 e M2 passariam despercebidos para sempre. | — | Começar com `pytest` + banco de teste para login, CORS, CRUD de colaboradores e regras de alerta. |
| B2 | README do backend desatualizado: cita `app.main`, `passlib`, `alembic` e um arquivo `../PLANO_DESENVOLVIMENTO_BACKEND.md` que fica em `prompts/`. Não há README na raiz. | `backend/README.md` | Reescrever com instalação real, variáveis e como rodar. |
| B3 | Arquivos muito grandes: `FormularioColaborador.jsx` (3.258 linhas), `ControleEPIs.jsx` (2.054), `api.js` (981), `epis.py` (682). Bundle JS de 1,87 MB num único arquivo. | frontend | Dividir em componentes/hooks; `React.lazy` por módulo do portal; separar `api.js` por recurso. |
| B4 | Repositório com arquivos que não são código: `images/` (inclui foto de WhatsApp e capturas de tela), `pdfs/`, `prompts/` (31 arquivos), `cmd/`, `outputs/`. `outputs/Planilha_EPIs_e_Funcionarios.xlsx` é na verdade um HTML. Imagens duplicadas em `images/` e `frontend/public/images/`. | raiz | Mover documentação para `docs/`, apagar o que não é usado, revisar se as imagens têm dados pessoais. |
| B5 | `frontend/meu-projeto/.env.production` está versionado apesar do `.gitignore` (contém só a URL pública da API, sem segredo). | — | Decidir: ou é configuração pública (renomear e documentar) ou usar variável do Railway. |
| B6 | `.vscode/settings.json` versionado com dados da conexão local do banco (sem senha). | `.vscode/` | Adicionar `.vscode/` ao `.gitignore` da raiz. |
| B7 | Mensagens de erro devolvem o texto da exceção interna ao usuário. | `cnhs.py:288`, `exames.py:195` | Logar o erro e devolver mensagem genérica. |
| B8 | Leitura de XML de NF-e com `xml.etree` (alerta do Bandit B314). O risco é baixo no Python 3.11, mas o recomendado é `defusedxml`. | `services/xml_importer.py:19` | Trocar por `defusedxml.ElementTree.fromstring`. |
| B9 | Download de documento com nome contendo caracteres fora do Latin-1 (ex.: travessão "–", aspas curvas, emoji) gera erro 500 no header `Content-Disposition`. | `colaboradores.py:498`, `documentos_pessoas_juridicas.py:74` | Usar `filename*=UTF-8''<nome codificado>`. |
| B10 | Funções de "descriptografar" alteram o objeto do ORM no lugar. Hoje nada é salvo depois, mas se alguém adicionar um `commit` depois disso, os dados vão para o banco **em texto puro**. | `_descriptografar_*` em vários endpoints | Montar o objeto de resposta (schema) em vez de alterar a entidade. |
| B11 | Código morto e avisos do lint: blocos `if (false) {...}`, variáveis não usadas (8 avisos do oxlint em `FormularioColaborador.jsx`), 15 `console.log/error`. | frontend | Limpar. |
| B12 | `datetime.utcnow()` (obsoleto no Python 3.12) misturado com horário de São Paulo; datas guardadas como texto em vários modelos. Seeds com dados no formato de CPF/telefone (`seeds/injetar_diaristas_*.py`) — confirmar se são fictícios. | models, seeds | Usar `datetime.now(timezone.utc)` e colunas `DATE`; garantir dados de teste claramente falsos. |

---

## 7. Ferramentas executadas

| Ferramenta | Resultado |
|---|---|
| Varredura manual de segredos no código e no histórico (`git log -p`) | 1 `SECRET_KEY` real (C1), 1 senha de Postgres local no histórico, hashes de usuários (A1). `BREVO_API_KEY` no histórico é apenas exemplo. |
| Busca por CPF/telefone/e-mail nos arquivos versionados | Ocorrências em seeds e formulários (exemplos/placeholders); revisar seeds (B12). |
| Planilhas `.xlsx` versionadas | Apenas inventário de EPIs (sem dados pessoais). |
| `npm audit --omit=dev` | 3 vulnerabilidades: 1 crítica, 2 altas (A5). |
| `oxlint` | 8 avisos, 0 erros (B11). |
| `vite build` | Sucesso; aviso de chunk de 1,87 MB (B3). |
| `pip-audit` | 3 vulnerabilidades em `python-jose` e `ecdsa` (A5). |
| `bandit -ll` | 1 achado médio: XML (B8). |
| Teste do roteador FastAPI | Confirmou M1. |
| Testes automatizados | Não existem (B1). |

---

## 8. Ações que só o responsável pelo sistema pode fazer

1. **Gerar uma nova `SECRET_KEY`** no Railway e confirmar que `ENCRYPTION_KEY` está definida e é diferente dela (C1).
2. **Trocar a senha** dos usuários listados em `backend/seeds/inserir_usuarios.sql` (A1).
3. Verificar se o repositório `irmaosbarreirodbb/Cadastro_de_gest-o_irmaos_barreiro` é público. Se for (ou já foi), decidir sobre limpar o histórico com `git filter-repo`/BFG — isso reescreve o histórico e exige que todos clonem de novo.
4. Se a senha do Postgres local que aparece no histórico for reaproveitada em outro lugar, trocá-la.
5. Ajustar no Railway o comando de start do backend (A2) e o servidor do frontend (M10).

---

## 9. Plano de correção sugerido

| Etapa | Itens | Esforço |
|---|---|---|
| 1 — Urgente (hoje) | C1, C2, A1 | Baixo — trocar chaves/senhas, 1 linha no CORS, remover arquivo |
| 2 — Esta semana | A2, A5, M1, M2, M9 | Baixo a médio |
| 3 — Próximas semanas | A3 (Alembic), A4, A6, M4, M6, M7 | Médio |
| 4 — Contínuo | Demais médios e baixos, começar testes (B1) | Médio |
