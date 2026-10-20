# 03 — Importar a primeira sequência de follow-up mostra o que resolver antes de publicar

Status: needs-info
Type: task
Origem: https://github.com/melgarafael/DeskcommCRM/pull/3077 (merge `fe8c5bfdc`), relatório de 2026-10-20
Zona: verde
Valor: bot-comunicacao

## Por que traz

Follow-up é o cuidado automático com a pessoa. Quem importava um fluxo numa lista vazia via só "deu certo" e perdia o aviso do que precisava resolver antes de publicar (um gatilho que voltou para manual, um modelo que não existe na conta). Correção de 3 arquivos, 101 linhas.

## O que toca

`app/app/ai/followups/_components/FlowsList.tsx` e o teste novo.

## Conflito esperado

Baixo. Nenhum arquivo amarelo ou vermelho.

## Tradução necessária

Texto de tela dentro de `FlowsList.tsx` (aviso do resultado da importação): conferir termos comerciais.

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada: `upstream/3077-primeira-sequencia-importada-mostra-o-resultado`.
2. `git cherry-pick -x -m 1 fe8c5bfdc` (o commit é o merge do PR no upstream). **Não trazer** `.changes/*.md`: o fork não usa esse diretório.
3. Conflito em arquivo amarelo: manter a lógica do upstream e o vocabulário do Cajado. Conflito em arquivo vermelho: parar e mudar para `needs-info`.
4. Texto de tela novo passa pelo `humanizer-pt-br` e pela varredura de termo comercial (`negócio`, `venda`, `lead`, `cliente`, `pedido`, `Ganho`, `Perdido`).
5. Gates, com o `.env` fora do caminho: `pnpm gov:verify`. PR para a `cajado`; o merge faz deploy.

## Comments

- 2026-10-20 (tentativa de aplicar): **conflito em `FlowsList.tsx` e causa de fundo maior.** O conserto pressupõe a janela "Importar fluxo" (`ImportFlowDialog`), os modelos de follow-up e o i18n (`useT`), tudo criado no upstream depois da base do fork (14 commits no arquivo, nenhum no fork). Resolver o conflito à mão geraria código que depende de arquivos que o Cajado não tem. Decisão do Roberto: o Cajado quer importar fluxos e usar modelos? Se sim, o ticket vira "trazer a funcionalidade", maior que o previsto.
