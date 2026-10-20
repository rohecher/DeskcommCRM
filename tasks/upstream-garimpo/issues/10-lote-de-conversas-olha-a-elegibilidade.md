# 10 — Conversa marcada como exemplo e resolvida dias depois entra no aprendizado da IA

Status: needs-triage
Type: task
Origem: https://github.com/melgarafael/DeskcommCRM/pull/3071 (merge `77fb59fae`, issue #3044), relatório de 2026-10-20 (avaliação dos 9 itens que aplicam limpo)
Zona: verde (aplica limpo)
Valor: bot-comunicacao

## Por que traz

Marcar uma conversa como exemplo enquanto aberta e resolvê-la mais de 24 horas depois deixava o selo na tela, mas a conversa nunca entrava no lote que ensina o agente. Para quem cuida e ensina o agente com conversas reais, a lição se perdia sem aviso.

## O que toca

`lib/ai/rag/ingest/conversations.ts` e um teste novo (285 linhas no total).

## Risco e conflito esperado

Baixo: aplica limpo. Mas **não sei** se o Cajado usa "conversa marcada como exemplo" para ensinar o agente. Triar antes: se não usa, `wontfix`.

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada.
2. `git cherry-pick -x -m 1 77fb59fae` (simulação com `git merge-tree`: aplica limpo em 2026-10-20). **Não trazer** `.changes/*.md`.

Gates, com o `.env` fora do caminho: `pnpm gov:verify`. PR para a `cajado`; o merge faz deploy.

## Comments
