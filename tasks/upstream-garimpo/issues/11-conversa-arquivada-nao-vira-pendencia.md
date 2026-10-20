# 11 — Conversa arquivada não vira pendência no Radar depois da atualização

Status: needs-triage
Type: task
Origem: https://github.com/melgarafael/DeskcommCRM/pull/2825 (merge `5bd5f2012`, issue #2822), relatório de 2026-10-20 (avaliação dos 9 itens que aplicam limpo)
Zona: amarela (só baseline)
Valor: confiabilidade

## Por que traz

O bloco "R2 — conversas que nunca escalaram também são demandas" do baseline cria uma demanda aberta para conversa arquivada que nunca teve demanda. Depois de atualizar, essa conversa aparece como pendência no Radar. O conserto é uma linha (`where cv.status <> 'archived'`). O bloco **existe no baseline do fork** (linha 9470), então o defeito também existe aqui.

## O que toca

Só `supabase/baseline.sql` (e um teste de invariante). Nenhuma migration.

## Risco e conflito esperado

Baixo no código, mas é baseline: portar à mão a linha no bloco R2 do fork. **Não sei** se a produção do Cajado reaplica o baseline (o deploy do Dokploy não o aplica; o kit self-host aplica). Se ninguém reaplica, o defeito só aparece em quem instala/atualiza pelo kit.

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada.
2. Editar a linha no bloco R2 do `baseline.sql` do fork; copiar o teste de invariante do upstream.

Gates, com o `.env` fora do caminho: `pnpm gov:verify` **e `pnpm test:db`**. PR para a `cajado`; o merge faz deploy.

## Comments
