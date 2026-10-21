# 04 — Rota de download com permissão, RLS e auditoria

Status: needs-info
Type: task
Spec: `tasks/exportar-escala-planilha/spec.md`

## Blocked by: 03 e as perguntas 1, 2 e 5 da spec

## O que fazer

`GET /app/escalas/exportar?mes=AAAA-MM`: sessão por cookie, `getUser()`, papel mínimo (pergunta 1), `mes` com Zod, cliente **sem** service role. Só cultos nos status da pergunta 2. Auditoria `escala.exportada` com `resourceId: null` e o mês no `metadata`. Cabeçalhos de download corretos. Rate limit de rota autenticada.

## Aceite

- 403 sem permissão; 2 tenants sem vazamento; auditoria gravada.
- `pnpm test:db` verde se tocar em schema ou RLS (não deve tocar).

## Comments
