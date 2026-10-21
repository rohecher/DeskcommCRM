# 05 — A caixa de entrada mostra o nome salvo na agenda do celular (só para a equipe)

Status: needs-triage
Type: task
Blocked by: 02, 03, 04 (aplicar o lote pequeno primeiro)
Origem: https://github.com/melgarafael/DeskcommCRM/pull/2439 (merge `e593c58b0`), relatório de 2026-10-20
Zona: amarela
Valor: bot-comunicacao

## Por que traz

Visitante que escreve de um número salvo no celular da igreja aparece só com o telefone. Com isso, a equipe passa a ver o nome da agenda. O nome é só da equipe: nunca entra no `{{nome}}` de mensagem automática, campanha ou resposta rápida. Valor pastoral alto, mas é a mudança maior do lote: 38 arquivos, +1.399 linhas.

## O que toca

Migration `20261007205228_0593_nome_da_agenda.sql`, um cron novo (`app/api/v1/cron/contact-names/route.ts`, a cada 10 minutos), `contacts/_handler.ts`, `conversations/_handler.ts`, a prévia de LGPD, a tela de contato e a tabela de contatos.

## Conflito esperado

Arquivos amarelos: `components/inbox/CRMSidePanel.tsx`, `lib/audit/actions.ts` (423 commits do upstream desde a base), `supabase/baseline.sql`. A migration precisa de **número novo**: a `0593` do upstream vira a próxima do fork (hoje `0150`), com apêndice no `baseline.sql` ANTES do bloco `VARREDURA anon` e linha no `MANIFEST.md`.

## Tradução necessária

Texto de tela em contato, caixa de entrada e prévia de LGPD. Comentários do upstream falam em "cliente": são comentários, não entram em tela. Conferir.

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada: `upstream/2439-nome-salvo-no-celular-na-caixa-de-entrada`.
2. `git cherry-pick -x -m 1 e593c58b0` (o commit é o merge do PR no upstream). **Não trazer** `.changes/*.md`: o fork não usa esse diretório.
3. Conflito em arquivo amarelo: manter a lógica do upstream e o vocabulário do Cajado. Conflito em arquivo vermelho: parar e mudar para `needs-info`.
4. Texto de tela novo passa pelo `humanizer-pt-br` e pela varredura de termo comercial (`negócio`, `venda`, `lead`, `cliente`, `pedido`, `Ganho`, `Perdido`).
5. Gates, com o `.env` fora do caminho: `pnpm gov:verify` **e `pnpm test:db`** (schema, cron e LGPD). PR para a `cajado`; o merge faz deploy.

## Comments
