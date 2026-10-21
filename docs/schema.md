# schema.md — domínio novo do Cajado

Este arquivo é o lugar canônico do schema e das políticas de RLS do **domínio novo**
(ministérios, escalas, jornada de vida, EAD, check-in), conforme a regra 6 da camada
Cajado no [`CLAUDE.md`](../CLAUDE.md).

**Atualização de 2026-10-21:** as tabelas das escalas entraram a partir da migration 0145 e a
Fase 0 já passou. As anteriores à 0150 (`escala_cultos`, `escala_slots`, `escala_voluntarios`,
`escala_setores`, `escala_subfuncoes`, `escala_config` e as demais) estão descritas nas próprias
migrations `0145` a `0149`, com o porquê de cada coluna; daqui em diante, cada tabela nova do
domínio ganha uma seção abaixo.

**Estava vazio de propósito.** A Fase 0 (`docs/tarefa-atual.md`) não cria tabela nenhuma —
o critério de pronto dela diz literalmente que este arquivo *não muda*. O desenho do
domínio começa na Fase 2 (`cajado-arquitetura.md` §3.4).

Quando o primeiro domínio novo entrar, cada tabela documentada aqui segue as convenções
não-negociáveis já em vigor:

- `organization_id uuid not null references organizations(id) on delete cascade`
- RLS `tenant_isolation_<tabela>_all` via `fn_user_org_ids()`
- `organization_id` resolvido de fonte confiável, nunca do body
- migration versionada + apêndice idempotente no `supabase/baseline.sql` + linha no MANIFEST

---

## Escalas

### `escala_avisos` (migration 0150)

Fila, registro e trava de duplicidade dos avisos de WhatsApp da escala. Uma linha é um aviso para
uma pessoa sobre um culto. Spec: [`tasks/avisos-da-escala/spec.md`](../tasks/avisos-da-escala/spec.md).

| Coluna | Tipo | Observação |
|---|---|---|
| `organization_id` | uuid, FK `organizations` (cascade) | resolvido da sessão, nunca do body |
| `tipo` | text + CHECK | `confirmacao`, `lembrete_vespera`, `lembrete_no_dia`, `pesquisa`, `troca_entrou`, `troca_saiu`. Espelho: `TipoDeAviso` |
| `culto_id` | uuid, FK `escala_cultos` **sem cascade** | aviso enviado é histórico; apagar o culto é bloqueado |
| `voluntario_id` | uuid, FK `escala_voluntarios` (cascade) | apagar a pessoa apaga os avisos dela (LGPD) |
| `slot_id`, `message_id` | uuid, FK (set null) | o aviso sobrevive à vaga e à mensagem |
| `status` | text + CHECK | `pendente`, `enviado`, `falhou`, `pulado`. Espelho: `StatusDoAviso` |
| `motivo` | text | por que `pulado` ou `falhou` (sem telefone, contato bloqueado…) |
| `agendado_para` | timestamptz | quando o plano de disparo manda sair (`lib/escalas/disparo.ts`) |
| `enviado_em` | timestamptz | |

- **Trava:** índice único `escala_avisos_org_tipo_culto_vol_key` em (`organization_id`, `tipo`, `culto_id`, `voluntario_id`). O código captura o `23505`.
- **Fila:** índice parcial `escala_avisos_fila_idx` onde `status = 'pendente'`.
- **RLS:** `tenant_isolation_escala_avisos_all` via `fn_user_org_ids()`. Sem acesso do `anon`; o envio roda com `service_role`.
- **Provado por:** `tests/invariants/escala-avisos.test.ts` e `tests/invariants/vocabulario-banco-x-typescript.test.ts`.

