# 02 — Sugerir resposta não culpa a configuração quando o agente decide não responder

Status: ready-for-agent
Type: task
Origem: https://github.com/melgarafael/DeskcommCRM/pull/3092 (merge `e4060c03f`), relatório de 2026-10-20
Zona: verde
Valor: bot-comunicacao

## Por que traz

Hoje, quando o agente termina sem propor resposta (por exemplo, diante da saudação automática de um WhatsApp Business), o painel "Sugerir resposta" diz para conferir a configuração, como se algo estivesse quebrado. A secretaria perde tempo investigando um erro que não existe. Correção pequena: 4 arquivos, 41 linhas.

## O que toca

`lib/agent-engine/agent/sugestao-de-resposta.ts`, `lib/i18n/dicionario.ts`, teste `tests/unit/sugestao-de-resposta.test.ts`.

## Conflito esperado

Baixo. Nenhum arquivo é amarelo ou vermelho. `lib/i18n/dicionario.ts` é arquivo compartilhado: confira se o fork não o alterou no momento do cherry-pick.

## Tradução necessária

A mensagem nova do painel é texto de tela. Conferir o tom e que não cita "empresa" nem "cliente".

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada: `upstream/3092-sugerir-resposta-sem-culpar-a-config`.
2. `git cherry-pick -x -m 1 e4060c03f` (o commit é o merge do PR no upstream). **Não trazer** `.changes/*.md`: o fork não usa esse diretório.
3. Conflito em arquivo amarelo: manter a lógica do upstream e o vocabulário do Cajado. Conflito em arquivo vermelho: parar e mudar para `needs-info`.
4. Texto de tela novo passa pelo `humanizer-pt-br` e pela varredura de termo comercial (`negócio`, `venda`, `lead`, `cliente`, `pedido`, `Ganho`, `Perdido`).
5. Gates, com o `.env` fora do caminho: `pnpm gov:verify`. PR para a `cajado`; o merge faz deploy.

## Comments
