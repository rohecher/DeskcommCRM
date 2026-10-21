# 08 — Um agente pausado não cala mais o número quando há outro no ar

Status: ready-for-agent
Type: task
Origem: https://github.com/melgarafael/DeskcommCRM/pull/2376 (merge `53879af0b`), relatório de 2026-10-20 (avaliação dos 9 itens que aplicam limpo)
Zona: verde (aplica limpo)
Valor: bot-comunicacao

## Por que traz

Com mais de um agente publicado no mesmo número, o atendimento escolhia o de maior prioridade sem olhar se estava pausado. Se o escolhido estivesse pausado, a mensagem da pessoa ficava sem resposta, mesmo com outro agente no ar. Para uma igreja que pausa um agente para ajustar texto, isso é silêncio com quem escreveu. Agora quem está no ar vem antes de qualquer pausado.

## O que toca

`lib/agent-engine/agent/agent-config.ts` (1 arquivo de código, +113 linhas com o teste de invariante `tests/invariants/agente-pausado-nao-sequestra-o-numero.test.ts`).

## Risco e conflito esperado

Baixo: aplica limpo. O teste de invariante roda no `test:db`, então rodar os dois.

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada.
2. `git cherry-pick -x -m 1 53879af0b` (simulação com `git merge-tree`: aplica limpo em 2026-10-20). **Não trazer** `.changes/*.md`.
3. Conferir no teste que ele reprova sem a correção (o upstream o escreveu para isso).

Gates, com o `.env` fora do caminho: `pnpm gov:verify` **e `pnpm test:db`**. PR para a `cajado`; o merge faz deploy.

## Comments
