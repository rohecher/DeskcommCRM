# 02 — Convocação por WhatsApp quando o mês é aprovado

Status: needs-info
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

## Blocked by: 01 e as perguntas 1, 2 e 8 da spec

Aprovar o mês grava um evento em `event_log`; um worker monta uma mensagem por voluntário (dias e funções dele) e enfileira no caminho de envio existente, respeitando throttle, janela e opt-out. Idempotente por (organização, mês, voluntário).

## Comments
