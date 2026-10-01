-- ============================================================================
-- 0149 — O STATUS DE CADA VAGA: ESCALADO, CONFIRMADO, TROCA, PRESENTE, FALTOU
--
-- Até aqui a vaga só sabia QUEM estava nela. A liderança acompanha mais que
-- isso, e o sistema que ela já usava mostrava cinco estados na legenda:
--
--   escalado          — o nome está na escala; ninguém confirmou ainda.
--   confirmado        — a pessoa disse que vem.
--   troca_solicitada  — a pessoa pediu para trocar; a vaga precisa de alguém.
--   presente          — serviu (marcado no dia ou depois).
--   faltou            — estava escalada e não veio.
--
-- O que é REGRA (e mora no código, `lib/escalas/status.ts`), não aqui:
--   - presente/faltou só a partir do dia do culto;
--   - trocar o nome da vaga volta o status para 'escalado' — a confirmação era
--     da pessoa anterior, e herdá-la diria "confirmado" de quem nem sabe.
-- O banco só garante que o valor é um dos cinco.
--
-- `status_em` e `status_obs` dizem quando mudou e por quê ("viagem a trabalho").
-- Quem mudou fica na auditoria (`escala.vaga_status_alterado`), que já registra
-- o autor de toda ação — repetir aqui seria uma segunda fonte para divergir.
--
-- Default 'escalado': as vagas que já existem são exatamente isso. Nada é
-- reescrito, e o app anterior a esta migration continua funcionando — ele não
-- lê nem grava as colunas novas.
-- ============================================================================

alter table public.escala_slots
    add column if not exists status text default 'escalado' not null,
    add column if not exists status_em timestamp with time zone,
    add column if not exists status_obs text default '' not null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'escala_slots_status_check'
          and conrelid = 'public.escala_slots'::regclass
    ) then
        alter table public.escala_slots
            add constraint escala_slots_status_check
            check (status in ('escalado', 'confirmado', 'troca_solicitada', 'presente', 'faltou'));
    end if;
end $$;

comment on column public.escala_slots.status is
  'escalado | confirmado | troca_solicitada | presente | faltou. Volta a escalado quando o voluntário da vaga muda. Regras de quando cada um vale em lib/escalas/status.ts.';
comment on column public.escala_slots.status_em is
  'Quando o status mudou pela última vez. NULL = nunca mudou desde a escala.';
comment on column public.escala_slots.status_obs is
  'Observação do status — o motivo de quem pediu troca, por exemplo. Curta; quem mudou fica na auditoria.';

-- A tela pergunta "quem pediu troca neste mês?": índice parcial, porque é a
-- minoria das vagas e é a única que alguém precisa achar depressa.
create index if not exists escala_slots_troca_idx
    on public.escala_slots using btree (organization_id, culto_id)
    where status = 'troca_solicitada';

notify pgrst, 'reload schema';
