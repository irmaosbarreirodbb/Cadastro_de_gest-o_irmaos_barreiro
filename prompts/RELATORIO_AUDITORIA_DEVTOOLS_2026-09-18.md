# Auditoria de exposição no DevTools e possíveis vazamentos

**Data:** 18/09/2026  
**Escopo:** inspeção de leitura do frontend, backend e comportamento local em `localhost`. Nenhum arquivo da aplicação foi alterado. Este relatório é o único artefato criado.

## Conclusão executiva

O painel **Sources** mostrado no DevTools não expõe, por si só, uma credencial: ele é o comportamento esperado do Vite em modo de desenvolvimento (`localhost:5173`) e permite ver o código React servido ao navegador. Não há como ocultar código que é enviado ao cliente; por isso, nenhum segredo deve estar em variáveis `VITE_*`, no JavaScript ou nas respostas da API.

Foram encontrados riscos reais e mais importantes que a visualização do código:

| Severidade | Achado | Estado verificado |
|---|---|---|
| Crítica | PDFs de EPI acessíveis sem autenticação | Confirmado no código e por requisição local sem token |
| Alta | Material criptográfico legado fixo no repositório e no histórico Git | Confirmado |
| Alta | JWT devolvido ao JavaScript e guardado em `sessionStorage` | Confirmado |
| Média | Dados de trabalho em caches do `localStorage` | Confirmado |
| Baixa | Documentação técnica e metadados expostos em ambiente de desenvolvimento | Confirmado localmente; esperado em desenvolvimento |

## Achados

### DEV-01 — PDFs com dados de colaboradores sem autenticação

**Severidade: Crítica**

As rotas abaixo não incluem `Depends(get_current_user)`:

- `GET /api/v1/epis/entregas/{entrega_id}/pdf` — [epis.py](backend/app/api/v1/endpoints/epis.py:607)
- `GET /api/v1/epis/ficha-colaborador-pdf?colaborador_nome=...` — [epis.py](backend/app/api/v1/endpoints/epis.py:652)

Elas geram fichas contendo nome, registro, função, setor, local, data de admissão/entrega e histórico de EPI. Um teste local sem credencial na segunda rota recebeu `404` para um nome inexistente, e não `401`; isso confirma que a consulta é alcançada antes de qualquer bloqueio de autenticação.

**Impacto:** alguém que alcance a API pode consultar nomes ou identificadores e obter fichas de colaboradores, constituindo exposição de dados pessoais e trabalhistas (LGPD).

**Correção recomendada:** exigir `current_user: Usuario = Depends(get_current_user)` nas duas rotas e repetir o teste sem token, cujo resultado deve ser `401`. Como medida adicional, validar autorização por papel/escopo se houver perfis distintos.

### DEV-02 — Chave criptográfica legada gravada no código e presente no histórico

**Severidade: Alta**

O módulo de criptografia mantém uma chave legada literal como candidata para descriptografia em [encryption.py](backend/app/core/encryption.py:25). Referências equivalentes também constam em documentação versionada; a busca no histórico Git confirmou commits que contêm o material.

**Impacto:** se dados antigos foram cifrados com essa chave, quem obtiver o repositório/histórico poderá tentar descriptografá-los. Se a chave também foi reutilizada como segredo JWT em algum ambiente anterior, tokens desse ambiente podem ser forjados.

**Correção recomendada:** rotacionar imediatamente a chave de criptografia e o segredo JWT em produção; manter chaves antigas somente em um cofre de segredos, nunca no código; recriptografar registros legados e, após a migração, remover a compatibilidade legada. O relatório não reproduz o valor da chave.

### DEV-03 — Token de acesso visível no DevTools (Application > Session Storage)

**Severidade: Alta**

O login devolve `access_token` na resposta em [auth.py](backend/app/api/v1/endpoints/auth.py:47), e o frontend o grava em `sessionStorage` em [api.js](frontend/meu-projeto/src/services/api.js:35). Embora também exista cookie `HttpOnly`, a cópia no `sessionStorage` continua legível por JavaScript e pelo DevTools.

**Impacto:** qualquer XSS no mesmo domínio, extensão maliciosa ou pessoa com acesso ao perfil do navegador enquanto a sessão estiver aberta pode copiar e reutilizar o JWT até expirar (atualmente, até 8 horas).

**Correção recomendada:** adotar autenticação somente por cookie `HttpOnly`, `Secure` e com duração menor; não retornar nem salvar o JWT no JavaScript. Ao usar cookie cross-site, adicionar proteção CSRF apropriada e restringir origens CORS. Depois, verificar no DevTools que `barreiro_token` não existe em Storage.

### DEV-04 — Caches persistentes acessíveis pelo DevTools

**Severidade: Média**

O frontend mantém caches persistentes de estoque, funcionários, registros e permissões de trabalho em `localStorage`, por exemplo em [ControleEPIs.jsx](frontend/meu-projeto/src/components/ControleEPIs.jsx:104), [RegistroFuncionarios.jsx](frontend/meu-projeto/src/components/RegistroFuncionarios.jsx:56) e [PermissaoTrabalhos.jsx](frontend/meu-projeto/src/components/PermissaoTrabalhos.jsx:805).

**Impacto:** esses dados continuam no navegador após encerrar a sessão e podem ser vistos em DevTools por quem use o mesmo perfil de navegador. O risco é maior em computadores compartilhados.

**Correção recomendada:** evitar cache persistente para dados pessoais/trabalhistas; preferir estado em memória ou `sessionStorage` com limpeza explícita no logout e expiração curta. A limpeza deve abranger todas as chaves de cache, não apenas token e usuário.

### DEV-05 — Fontes, OpenAPI e endpoints de diagnóstico no ambiente local

**Severidade: Baixa / contexto de desenvolvimento**

No ambiente local atual, `GET /docs`, `GET /openapi.json`, `GET /health` e `GET /` retornaram `200`. Isso acontece porque o ambiente está configurado como desenvolvimento. O backend já desabilita Swagger/OpenAPI quando `ENVIRONMENT` não é `development` ([main.py](backend/main.py:148)).

**Impacto:** em produção, caso a variável de ambiente seja configurada incorretamente, a documentação revelará toda a superfície da API. Os endpoints raiz e `/health` também informam tecnologia e estado.

**Correção recomendada:** confirmar no deploy que `ENVIRONMENT=production`; testar publicamente que `/docs` e `/openapi.json` retornam `404`; minimizar as informações de `/` e `/health` ou protegê-las quando não forem necessárias.

## Pontos positivos verificados

- `backend/.env` existe localmente, está ignorado pelo Git e não há arquivos `.env`, chaves ou certificados rastreados no índice atual.
- As chaves atuais de JWT e criptografia estão presentes no arquivo local e possuem comprimento de ao menos 32 caracteres; seus valores não foram lidos ou registrados neste relatório.
- A maioria das rotas de dados usa `get_current_user`; as duas exceções de PDF acima são a principal falha de autorização encontrada.
- Senhas usam bcrypt e o login limita tentativas.

## Como conferir no DevTools sem expor dados

1. Em **Application > Session Storage**, verifique se há `barreiro_token`; enquanto existir, o JWT está acessível ao JavaScript.
2. Em **Application > Local Storage**, procure as chaves de cache listadas no achado DEV-04. Não copie dados reais para capturas ou conversas.
3. Em **Network**, sem login, chame as duas URLs de PDF. O comportamento seguro esperado após a correção é `401 Unauthorized`, sem PDF nem diferença entre IDs/nomes existentes e inexistentes.
4. Em produção, teste `/docs` e `/openapi.json`; ambos devem retornar `404`.

## Limitações

Esta foi uma auditoria estática e de comportamento local, sem tentativa de explorar dados reais, sem login e sem varredura externa do domínio publicado. A confirmação de exposição pública depende de repetir os testes autorizados contra o ambiente de produção.
