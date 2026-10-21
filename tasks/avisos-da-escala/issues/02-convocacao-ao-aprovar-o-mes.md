# 02 — Convocação por WhatsApp quando o mês é aprovado

Status: needs-info
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

## Blocked by: contagem de telefones (ticket 01) e a escolha do número (feita). Perguntas 1, 2 e 8 respondidas em 2026-10-21 (consentimento: sim).

Aprovar o mês grava um evento em `event_log`; um worker monta uma mensagem por voluntário (dias e funções dele) e enfileira no caminho de envio existente, respeitando throttle, janela e opt-out. Idempotente por (organização, mês, voluntário).

## Comments
