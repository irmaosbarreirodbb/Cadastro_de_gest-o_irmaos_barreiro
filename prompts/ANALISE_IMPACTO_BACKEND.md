# ⚙️ ANÁLISE DE IMPACTO NO BACKEND
## Módulo: Relação de Diaristas & API REST
**Projeto:** LiG Irmãos Barreiros  
**Stack do Backend:** Python 3.11+, FastAPI, SQLAlchemy, PostgreSQL, Criptografia AES (para chaves PIX)  
**Arquivo Inspecionado:** `backend/app/api/v1/endpoints/diaristas.py`

---

## 1. Resumo Executivo: Vai precisar mudar o backend?

> ### 🟢 **RESPOSTA DIRETA: NÃO É OBRIGATÓRIO ALTERAR O BACKEND.**
>
> A API atual do backend em FastAPI **já possui todos os endpoints essenciais** necessários para alimentar a nova interface simplificada e dinâmica.  
> 
> Você pode redesenhar **100% da tela no frontend** (fita de datas, drawer lateral de cadastro, filtros em tempo real, badges de status, cópia de PIX e edição) utilizando rigorosamente os mesmos endpoints que já estão rodando em produção.

---

## 2. Diagnóstico da API Existente no Backend

Abaixo está o mapeamento dos endpoints que já estão implementados e testados no seu backend em Python:

| Rota HTTP | Função no Backend | Suporta a Nova Interface? |
| :--- | :--- | :---: |
| `GET /api/v1/diaristas?data=YYYY-MM-DD` | Retorna todos os diaristas do dia especificado com chave PIX descriptografada. | ✅ **Sim** (Alimenta a tabela e os cálculos do dia) |
| `GET /api/v1/diaristas?mes=YYYY-MM` | Retorna todos os lançamentos do mês para cálculo de métricas. | ✅ **Sim** (Alimenta a visão geral e relatórios) |
| `GET /api/v1/diaristas/datas-disponiveis` | Retorna dicionário `{ "YYYY-MM-DD": quantidade }` de todas as datas com lançamentos. | ✅ **Sim** (Alimenta as bolinhas de contagem na fita semanal) |
| `POST /api/v1/diaristas` | Cadastra novo diarista, calcula total e encripta o PIX no banco. | ✅ **Sim** (Alimenta o novo Drawer lateral sem sair da tela) |
| `PATCH /api/v1/diaristas/{id}/status-pago` | Inverte o status de pagamento (`pago = true/false`) e atualiza timestamp. | ✅ **Sim** (Alimenta o clique rápido no badge de status) |
| `PUT /api/v1/diaristas/{id}` | Permite atualizar nome, valor, diárias, motorista e chave PIX. | ✅ **Sim** (Alimenta a edição rápida inline) |
| `DELETE /api/v1/diaristas/{id}` | Remove um lançamento de diária do banco de dados. | ✅ **Sim** (Alimenta o botão de exclusão rápida) |

---

## 3. Onde o Frontend pode agir SEM mexer no Backend

Como todos os endpoints CRUD e o toggle de pagamento já existem, o dinamismo desejado pode ser alcançado puramente na camada de apresentação:

1. **Fita Semanal de 7 Dias:**
   - O frontend consulta `GET /api/v1/diaristas/datas-disponiveis` (que já existe e é super leve).
   - Com esse mapa de datas, a fita de 7 dias sabe exatamente quais dias têm diaristas e exibe os números instantaneamente.

2. **Marcação Rápida de Pago / Pendente:**
   - O backend já tem a rota específica `PATCH /api/v1/diaristas/{id}/status-pago`.
   - Basta o frontend chamar essa rota ao clicar no botão na tabela, aplicando *Optimistic UI* (atualização visual imediata na tela sem esperar o retorno da rede).

3. **Novo Cadastro em Drawer Lateral:**
   - O drawer envia o mesmo payload JSON para `POST /api/v1/diaristas`.
   - Ao receber a resposta 201 Created, o frontend adiciona a linha diretamente na tabela local sem recarregar a página.

---

## 4. Melhorias Opcionais no Backend (Fase 2 - Evolução Futura)

Caso você queira ir além e adicionar funcionalidades avançadas de alta escala ou automações pesadas no futuro, recomendamos **3 endpoints adicionais opcionais**:

### Melhoria Opcional 1: Duplicação de Equipe em Lote (Smart Clone)
- **Cenário:** O usuário quer clicar em "Repetir equipe de ontem para hoje".
- **Sem mexer no backend:** O frontend pode pegar os diaristas de ontem e disparar múltiplos `POST` em loop. Funciona, mas faz várias requisições.
- **Com rota no backend (Recomendado na Fase 2):**
  - Rota: `POST /api/v1/diaristas/duplicar-dia`
  - Body: `{ "data_origem": "2026-09-08", "data_destino": "2026-09-09" }`
  - Vantagem: O PostgreSQL duplica todos os registros em **1 única query SQL atômica**, levando menos de 50 milissegundos.

### Melhoria Opcional 2: Pagamento em Massa (Bulk Status Toggle)
- **Cenário:** Na sexta-feira, o financeiro quer marcar 15 diaristas como pagos de uma única vez.
- **Com rota no backend (Recomendado na Fase 2):**
  - Rota: `PATCH /api/v1/diaristas/lote/status-pago`
  - Body: `{ "ids": ["id-1", "id-2", "id-3"], "pago": true }`
  - Vantagem: Evita 15 requisições HTTP individuais ao banco.

### Melhoria Opcional 3: Endpoint de Resumo por Período
- **Cenário:** Carregar métricas de uma semana inteira (Segunda a Sábado) para exibir no topo da tela.
- **Com rota no backend (Recomendado na Fase 2):**
  - Rota: `GET /api/v1/diaristas/resumo-semanal?data_inicio=2026-09-07&data_fim=2026-09-12`
  - Retorno: Totais consolidados de valor e diárias agrupados por dia.

---

## 5. Matriz de Decisão: O que implementar agora?

| Etapa | Trabalho no Frontend | Trabalho no Backend | Necessário para simplificar a tela? |
| :--- | :--- | :--- | :---: |
| **Fase 1 (Imediata)** | Redesenhar UI, criar fita de datas, drawer lateral e badges de status interativos. | **Nenhum (0 linhas de código)** | ✅ **SIM (Resolve 90% do problema)** |
| **Fase 2 (Otimização)** | Checkboxes de seleção múltipla e botão "Clonar equipe de ontem". | Adicionar rota de clonagem e rota de atualização em lote. | ⏳ *Opcional (Apenas se desejar ações em lote)* |

---

## 6. Conclusão e Recomendação

Você **não precisa alterar o backend** para alcançar a simplificação visual, a modernização do layout e o dinamismo na tela de diaristas. 

A arquitetura atual do seu backend em FastAPI já está bem estruturada, segura (com criptografia nas chaves PIX) e pronta para sustentar a nova interface limpa e intuitiva.
