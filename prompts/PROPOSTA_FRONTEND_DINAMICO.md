# ⚡ PROPOSTA DE ENGENHARIA DE FRONTEND & DINAMISMO
## Módulo: Relação de Diaristas & Gestão de Pagamentos
**Projeto:** LiG Irmãos Barreiros  
**Stack Atual:** React 18, Tailwind CSS, Lucide Icons, Vite  
**Arquivo Principal Atual:** `frontend/meu-projeto/src/components/RelacaoDiaristas.jsx` (1.134 linhas)

---

## 1. Desafio Técnico Atual

O arquivo `RelacaoDiaristas.jsx` atualmente acumula **mais de 1.100 linhas de código** em um único componente. Ele é responsável por:
1. Controle de datas, anos e meses vigentes.
2. Cálculos matemáticos pesados de totais, contagens e agrupamentos no render.
3. Calendário completo dos 12 meses do ano e grade de 31 dias com dias da semana.
4. Cabeçalho, botões de ação e modais de relatório.
5. 3 cards de KPIs estáticos.
6. Tabela principal com busca e paginação/renderização de linhas.
7. Lógica de impressão de documentos.

**Consequência:** A tela é pesada para renderizar, tem código acoplado, e qualquer pequena alteração visual pode quebrar comportamentos de data ou cálculos.

---

## 2. Nova Arquitetura de Componentes Modulares

Propomos modularizar o fluxo em uma pasta `components/diaristas/` com componentes especializados e limpos:

```
frontend/meu-projeto/src/components/diaristas/
├── RelacaoDiaristasContainer.jsx    <-- Orquestrador de dados e estado global
├── components/
│   ├── DiaristasHeaderBar.jsx       <-- Título, badges de totais e ações rápidas
│   ├── StripSemanalNav.jsx          <-- Fita horizontal interativa de 7 dias
│   ├── DiaristasFilters.jsx         <-- Campo de busca reativo + tabs (Todos/Pendentes/Pagos)
│   ├── TabelaDiaristasRow.jsx       <-- Linha individual com quick-edit e badge de status
│   ├── DrawerCadastroDiarista.jsx   <-- Gaveta lateral deslizante para novo cadastro
│   └── ModalAcoesRapidas.jsx        <-- Ações em lote ("Repetir equipe", exportar, imprimir)
```

---

## 3. Funcionalidades Dinâmicas Propostas

### 3.1. Fita de Navegação Semanal Reativa (`<StripSemanalNav />`)
- **Como funciona:** Renderiza uma fita deslizante com os dias ao redor da data selecionada (Ontem, Hoje, Amanhã e demais dias da semana atual).
- **Indicadores Dinâmicos:**
  - Cada cartãozinho de dia mostra a data, o dia da semana e um **micro-contador de diaristas** (ex: `8 d.`).
  - Ao clicar em um dia, a tabela faz uma transição de fade/slide ultra rápida.
  - Teclas de atalho no teclado: Pressione `←` (seta esquerda) para voltar um dia e `→` (seta direita) para avançar.

### 3.2. Atualização Otimista de Status de Pagamento (Optimistic UI)
- No modelo atual, marcar como pago ou não pago gera recargas ou pode parecer estático.
- **Na nova versão:**
  - O usuário clica no badge de status: `[ Pendente ]` -> `[ Pago ]`.
  - O React atualiza a tela **instantaneamente em 0ms** (Optimistic Update) e já recalcula o indicador de "Total a Pagar Pendente" no topo.
  - Em segundo plano, a chamada para a rota `PATCH /api/v1/diaristas/{id}/status-pago` é enviada silenciosamente.
  - Se houver falha de rede, um Toast avisa e reverte o estado automaticamente.

### 3.3. Gaveta Lateral Deslizante (*Slide-Over Drawer*) para Cadastro
- Em vez de trocar de tela inteira ao clicar em `+ Cadastrar Diarista`, uma gaveta translúcida com fundo desfocado desliza suavemente da direita da tela:
  - O operador não perde a visão da tabela do dia atual.
  - Formulário com foco automático no primeiro campo (Nome do Diarista).
  - Sugestão inteligente com *autocomplete* de diaristas já cadastrados anteriormente (ao digitar "João", já preenche a profissão e a chave PIX dele automaticamente!).
  - Opção: **"Salvar e Adicionar Outro"** com tecla de atalho `Ctrl + Enter` para cadastrar 5 diaristas em menos de 1 minuto.

### 3.4. Ação Rápida: "Repetir Equipe do Dia Anterior" (Smart Clone)
- **Cenário Real do Campo:** Muitas vezes, a equipe que trabalhou ontem é exatamente a mesma que está trabalhando hoje.
- Na tela atual, o usuário precisa cadastrar um por um novamente todo dia.
- **Novo Dinamismo:**
  - Se o dia selecionado estiver vazio, aparece um botão inteligente:  
    `⚡ Copiar os 7 diaristas de ontem (08/09) para hoje`.
  - Com 1 clique, o sistema replica a lista para o dia de hoje, permitindo apenas ajustar quem faltou ou adicionar alguém novo. Economia de 15 a 20 minutos de digitação diária!

### 3.5. Filtro Reativo por Abas (Tabs) e Busca Instantânea
- Acima da tabela, três abas com contadores numéricos dinâmicos:
  1. **Todos (12)** — Visualização completa da equipe.
  2. **Pendentes (8)** — Foco no que o financeiro precisa pagar agora via PIX.
  3. **Pagos (4)** — Histórico do que já foi quitado no dia.
- A busca filtra instantaneamente enquanto o usuário digita (nome, motorista do caminhão ou chave PIX).

---

## 4. Estratégia de Transição e Código Não Destrutivo

- **Zero downtime e sem quebrar nada:** Como você pediu para não alterar nada agora, a estratégia planejada é criar o novo componente de forma isolada (ex: `RelacaoDiaristasV2.jsx`) e testá-lo lado a lado.
- As props existentes (`diaristas`, `dataSelecionada`, `onNavigateCadastrar`, `onEmitirRecibo`) permanecem 100% compatíveis, garantindo que o `PortalColaborador.jsx` continue funcionando normalmente.

---

## 5. Resumo das Melhorias de Frontend

| Funcionalidade | Como é Hoje | Como Ficará no Novo Design |
| :--- | :--- | :--- |
| **Navegação de Dias** | Setas lentas `< Hoje >` e modal pesado | Fita horizontal rápida de 7 dias + atalhos `←` e `→` |
| **Cadastro de Diarista** | Sai da tela e vai para outra página | Drawer lateral sobreposto sem perder a lista de vista |
| **Marcação de Pago** | Não intuitivo / escondido | 1 clique direto na linha com atualização em tempo real |
| **PIX do Diarista** | Texto corrido com ícone básico | Botão de cópia rápida com feedback "PIX Copiado!" e modal de QR Code |
| **Repetição de Equipe** | Não existe (digitação manual diária) | Botão de 1 clique para clonar equipe do dia anterior |
| **Tamanho do Arquivo** | 1 componente gigante com 1.134 linhas | 6 submódulos limpos e de fácil manutenção |
