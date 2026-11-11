# 📋 PLANEJAMENTO DE SIMPLIFICAÇÃO & REDESIGN DE UI/UX
## Módulo: Relação de Diaristas & Controle de Pagamentos Diários
**Projeto:** LiG Irmãos Barreiros  
**Objetivo:** Transformar a tela atual fragmentada e sobrecarregada em uma central operacional moderna, limpa, dinâmica e focada em produtividade.

---

## 1. Diagnóstico da Tela Atual: Por que ela parece "bagunçada"?

Analisando a captura de tela da aplicação (`localhost:5173/portal` - Relação de Diaristas), identificamos os pontos de atrito cognitivo e desperdício visual:

| Elemento Atual | Problema Encontrado | Consequência para o Usuário |
| :--- | :--- | :--- |
| **"Efeito Ilhas" (Cards Desconexos)** | A tela é fatiada em 4 cartões brancos flutuantes empilhados verticalmente com margens e sombras pesadas. | Falta de unidade visual; o olho do usuário salta de caixa em caixa sem um fluxo de leitura contínuo. |
| **Desperdício de Espaço Vertical** | O cabeçalho, a barra de data e os 3 cards de resumo consomem mais de 65% da altura da tela (*above the fold*). | A tabela de diaristas (que é o que realmente interessa) mal aparece na tela sem rolagem, mesmo em monitores Full HD. |
| **Barra de Navegação Temporal Desértica** | Uma caixa inteira dedicada apenas às setas `< Hoje >` e ao seletor de calendário, com enorme espaço em branco inútil. | Sensação de lentidão e estática; navegar entre dias requer muitos cliques ou abrir drop-downs pesados. |
| **Cards de Métricas Superdimensionados** | 3 blocos gigantes ("Diaristas no Dia", "Diárias Computadas", "Total a Pagar") que mostram apenas números simples. | Ocupam o espaço nobre da tela sem entregar análise inteligente (ex: quanto já foi pago vs. quanto está pendente). |
| **Ações Espalhadas Sem Hierarquia** | Botão Voltar no canto esquerdo, Relatório e Imprimir no centro-direito, e Cadastrar Diarista no extremo direito. | Dispersão de atenção; o operador hesita sobre qual é a ação principal do momento. |
| **Falta de Dinamismo Operacional** | Se não houver diaristas na data, a tabela fica vazia e estática; não há como "copiar equipe de ontem", nem editar valores inline. | Toda ação exige ir para outra tela de cadastro e depois voltar, travando o ritmo de quem está na fazenda/empresa. |

---

## 2. Conceito da Nova Interface: *Cockpit Operacional Unificado*

A nova proposta abandona o conceito de "vários cartões empilhados" e adota um layout **integrado e fluido**, com 3 zonas bem delimitadas:

```
+-----------------------------------------------------------------------------------------+
| [Header Integrado]  <- Voltar | Relação de Diaristas  [👥 8 | ⏱️ 8 d. | 🟢 R$ 1.200,00]    |
|                      [ + Nova Diária ] [ Ações Rápidas v ]                              |
+-----------------------------------------------------------------------------------------+
| [Mini Strip Temporal - 7 Dias Dinâmicos]                                                |
| [ Seg 07 ]  [ Ter 08 ]  [[ QUA 09 (Hoje) ]]  [ Qui 10 ]  [ Sex 11 ]  [ Sáb 12 ] [ 📅 Mês ]|
+-----------------------------------------------------------------------------------------+
| [Barra de Ação & Filtros Reativos]                                                      |
| 🔍 Buscar nome, função ou PIX...   [ Todos (8) ] [ A Pagar (5) ] [ Pagos (3) ]          |
+-----------------------------------------------------------------------------------------+
| [Lista Operacional Dinâmica - Tabela Clean com Ações Inline]                            |
| DIARISTA            FUNÇÃO/MOTORISTA   VALOR     QTD    TOTAL        STATUS     PIX/AÇÃO|
| --------------------------------------------------------------------------------------- |
| João Silva          Colheita (Caminhão) R$ 150    1     R$ 150,00   [ Pendente ] [ Copiar ] |
| Marcos Souza        Carga / Descarga    R$ 160    1     R$ 160,00   [ ✅ Pago  ] [ Recibo ] |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Os 5 Pilares de Mudança no Design

### Pilar 1: Unificação em um "Header de Comando"
- **O que muda:** Elimina o primeiro bloco isolado e junta o título com os totalizadores.
- **Resultado:** O operador vê o nome da tela e, na mesma linha, **três badges elegantes (pílulas de métricas)**:
  - `👥 8 diaristas`
  - `⏱️ 8 diárias`
  - `💰 R$ 1.200,00 (R$ 800 pendente / R$ 400 pago)`
- As ações de "Relatório Mensal" e "Imprimir" são agrupadas em um menu limpo ou botões secundários discretos, dando destaque total ao botão primário: **`+ Adicionar Diarista`**.

### Pilar 2: Barra Temporal Dinâmica ("Carrossel de Dias / Strip Semanal")
- Em vez de uma caixa cinza estática com botões `< Hoje >`, implementar uma **fita horizontal de dias**:
  - Mostra os dias da semana corrente (ex: Segunda a Sábado).
  - O dia selecionado fica em evidência (gradiente vermelho elegante com indicador ativo).
  - Cada dia já mostra um mini-indicador: bolinha verde se tiver lançamentos e a quantidade (ex: `Qua 09 • 8 diárias`).
  - Um clique em qualquer dia muda instantaneamente a tabela com animação suave, sem recarregar nada.
  - No final da barra, um botão discreto de calendário `[ 📅 Outra Data / Calendário Mensal ]`.

### Pilar 3: Drawer Lateral (Slide-over) para "+ Cadastrar Diarista"
- **Problema atual:** Ao clicar em "Cadastrar Diarista", o sistema navega para outra tela/rota, fazendo o usuário perder a visão da lista do dia.
- **Solução dinâmica:** Ao clicar em `+ Nova Diária`, abre uma gaveta lateral suave (*Slide-over Drawer*) à direita:
  - O usuário preenche nome, valor, diárias e chave PIX.
  - Ao salvar, a linha entra na tabela com animação em tempo real e o totalizador no topo já soma o valor imediatamente.
  - A tela principal não perde o foco nem a data em que você estava trabalhando.

### Pilar 4: Tabela Mais Limpa e Inteligente com Ações Inline
- **Edição Rápida (Quick-edit):** Se o valor da diária mudou de 150 para 160, o usuário pode dar 2 cliques ou clicar num ícone de lápis para alterar na hora, sem abrir telas complexas.
- **Botão de Alternar Status de Pagamento (Pendente / Pago):**
  - Um chip clicável na tabela:
    - `[ Pendente ]` (em tom âmbar suave).
    - Clicou? Vira instantaneamente `[ ✅ Pago ]` (em tom esmeralda suave).
  - Isso resolve o controle diário de quem já recebeu o PIX ou dinheiro.
- **Botão Inteligente de PIX:**
  - Mostra a chave de forma discreta com botão de cópia de 1 clique acompanhado de um feedback visual ("Copiado!").
  - Opção de QR Code rápido via modal flutuante se o pagamento for feito pelo app do celular.

### Pilar 5: Modo de Alternância (Tabela Clássica vs. Cards Operacionais)
- Adicionar um toggle no topo da lista:
  - **Modo Tabela:** Ideal para visualização densa no computador e conferência contábil.
  - **Modo Cards:** Ideal para visualização em tablets, notebooks menores ou smartphones na linha de frente do armazém/campo.

---

## 4. Comparativo Antes vs. Depois

```
ANTES:
[ Topo / Logo / Menu ]
[ Card 1: Título gigante + 3 botões espalhados ]
[ Card 2: Seletor de Data gigante e vazio ]
[ Card 3: 3 Caixas de Métricas ocupando altura inteira ]
[ Card 4: Tabela empurrada para o rodapé ]

DEPOIS:
[ Topo / Logo / Menu ]
[ Painel Único Integrado:
   ├── Barra de Título Compacta + Resumo Financeiro + Botão Nova Diária
   ├── Fita Semanal de Dias (Navegação em 1 toque)
   ├── Filtros Rápidos (Todos | A Pagar | Pagos) + Campo de Busca
   └── Grid/Tabela de Alta Densidade com Status Interativo ]
```
---

## 5. Próximos Passos
Para visualizar a viabilidade técnica e a arquitetura desse redesign:
1. Consulte `PROPOSTA_FRONTEND_DINAMICO.md` para entender como dividir o componente React e criar os estados fluidos.
2. Consulte `ANALISE_IMPACTO_BACKEND.md` para conferir a compatibilidade com a API FastAPI existente.
