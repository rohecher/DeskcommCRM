# schema.md — domínio novo do Cajado

Este arquivo é o lugar canônico do schema e das políticas de RLS do **domínio novo**
(ministérios, escalas, jornada de vida, EAD, check-in), conforme a regra 6 da camada
Cajado no [`CLAUDE.md`](../CLAUDE.md).

**Está vazio de propósito.** A Fase 0 (`docs/tarefa-atual.md`) não cria tabela nenhuma —
o critério de pronto dela diz literalmente que este arquivo *não muda*. O desenho do
domínio começa na Fase 2 (`cajado-arquitetura.md` §3.4).

Quando o primeiro domínio novo entrar, cada tabela documentada aqui segue as convenções
não-negociáveis já em vigor:

- `organization_id uuid not null references organizations(id) on delete cascade`
- RLS `tenant_isolation_<tabela>_all` via `fn_user_org_ids()`
- `organization_id` resolvido de fonte confiável, nunca do body
- migration versionada + apêndice idempotente no `supabase/baseline.sql` + linha no MANIFEST
