# 02 — Convocação semanal por WhatsApp, em blocos por hora

Status: needs-info
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

## Blocked by: contagem de telefones (ticket 01) e a escolha do número (feita). Perguntas 1, 2 e 8 respondidas em 2026-10-21 (consentimento: sim).

Aprovar o mês grava um evento em `event_log`; um worker monta uma mensagem por voluntário (dias e funções dele) e enfileira no caminho de envio existente, respeitando throttle, janela e opt-out. Idempotente por (organização, mês, voluntário).

## Comments

- 2026-10-21: escopo mudou para **só quem está na escala da semana**. Passos: (1) `lib/escalas/disparo.ts`, o plano em blocos por hora (**feito**, 10 testes, branch `feat/aviso-convocacao`); (2) migration `escala_avisos` (fila, registro e unicidade por organização, tipo, semana e voluntário) com `test:db`; (3) enfileirar a semana (idempotente, sem telefone vira `pulado`); (4) rota de cron que esvazia a fila reaproveitando a ação de WhatsApp das automações; (5) chave "Convocação ligada" (nasce desligada) e confirmação mostrando o plano.
- 2026-10-21 (2): **migration 0150 `escala_avisos` feita** (fila, registro e trava; `test:db` verde com 95 arquivos e 711 testes). A antecedência virou **por culto, 2 dias antes por padrão, parametrizável** (`abreEmDoCulto`, `prazoDoCulto`). Falta: enfileirar os avisos de um culto (idempotente, sem telefone vira `pulado`), a rota de cron que esvazia a fila, e a chave "Convocação ligada" (nasce desligada) com a confirmação do plano.

