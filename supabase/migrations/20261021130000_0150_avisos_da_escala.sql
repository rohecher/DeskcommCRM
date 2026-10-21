-- ============================================================================
-- 0150 — OS AVISOS DA ESCALA: A FILA, O REGISTRO E A TRAVA CONTRA DUPLICAR
--
-- Spec: tasks/avisos-da-escala/spec.md. Cada linha é UM aviso de WhatsApp para UMA pessoa
-- sobre UM culto: a confirmação de dois dias antes, o lembrete, a pesquisa pós-culto, o
-- aviso de troca. A tabela faz três papéis de uma vez, e é por isso que ela existe:
--
--   FILA        `pendente` + `agendado_para`: o cron lê o que já venceu e manda no ritmo
--               do plano (blocos por hora, `lib/escalas/disparo.ts`). Aprovar o mês não
--               envia nada; só grava linhas pendentes.
--   REGISTRO    "o que mandamos a quem", visível para a liderança. `pulado` guarda o
--               motivo (sem telefone, contato bloqueado), para o aviso que não saiu não
--               sumir em silêncio.
--   TRAVA       único por (organização, tipo, culto, voluntário): aprovar duas vezes ou o
--               cron reiniciar no meio não pode mandar a mesma mensagem duas vezes. O
--               código captura o 23505 e segue.
--
-- E há uma quarta função, a que a resposta do voluntário exige: quando alguém responde "1",
-- o sistema precisa saber A QUAL aviso ele responde. `message_id` e `culto_id` dão isso.
--
-- Chaves:
--   voluntario_id  on delete cascade — é dado pessoal ligado à pessoa; apagar o cadastro
--                  (LGPD) apaga os avisos dela.
--   culto_id       SEM cascade — o culto com aviso já enviado é histórico, e apagá-lo em
--                  silêncio levaria o registro junto. Culto em rascunho nunca tem aviso
--                  (as linhas nascem na publicação), então descartar rascunho não é bloqueado.
--   slot_id / message_id  on delete set null — o aviso sobrevive à vaga e à mensagem.
--
-- `tipo` e `status` são text + CHECK (doutrina do repo), com o espelho em
-- `lib/escalas/tipos.ts` vigiado por `vocabulario-banco-x-typescript.test.ts`.
--
-- Tabela nova: nada existente muda, e o app anterior continua funcionando sem ela.
-- ============================================================================

create table if not exists public.escala_avisos (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    tipo text not null,
    culto_id uuid not null,
    voluntario_id uuid not null,
    slot_id uuid,
    status text default 'pendente' not null,
    -- Por que `pulado` ou `falhou`. Vazio enquanto pendente ou enviado.
    motivo text default '' not null,
    -- Quando o plano manda sair. O cron só pega o que já venceu.
    agendado_para timestamp with time zone not null,
    enviado_em timestamp with time zone,
    message_id uuid,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_pkey' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos add constraint escala_avisos_pkey primary key (id);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_organization_id_fkey' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos
            add constraint escala_avisos_organization_id_fkey foreign key (organization_id)
            references public.organizations(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_culto_id_fkey' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos
            add constraint escala_avisos_culto_id_fkey foreign key (culto_id)
            references public.escala_cultos(id);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_voluntario_id_fkey' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos
            add constraint escala_avisos_voluntario_id_fkey foreign key (voluntario_id)
            references public.escala_voluntarios(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_slot_id_fkey' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos
            add constraint escala_avisos_slot_id_fkey foreign key (slot_id)
            references public.escala_slots(id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_message_id_fkey' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos
            add constraint escala_avisos_message_id_fkey foreign key (message_id)
            references public.messages(id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_tipo_check' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos
            add constraint escala_avisos_tipo_check
            check (tipo in ('confirmacao', 'lembrete_vespera', 'lembrete_no_dia', 'pesquisa', 'troca_entrou', 'troca_saiu'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'escala_avisos_status_check' and conrelid = 'public.escala_avisos'::regclass) then
        alter table only public.escala_avisos
            add constraint escala_avisos_status_check
            check (status in ('pendente', 'enviado', 'falhou', 'pulado'));
    end if;
end $$;

-- A trava contra duplicar. O nome importa: o código e o teste a reconhecem por ele.
create unique index if not exists escala_avisos_org_tipo_culto_vol_key
    on public.escala_avisos using btree (organization_id, tipo, culto_id, voluntario_id);

-- O cron só pergunta "o que está pendente e já venceu?". Índice parcial: a fila é a minoria.
create index if not exists escala_avisos_fila_idx
    on public.escala_avisos using btree (organization_id, agendado_para)
    where status = 'pendente';

-- A tela pergunta "o que mandamos para este culto?".
create index if not exists escala_avisos_culto_idx
    on public.escala_avisos using btree (culto_id);

create index if not exists escala_avisos_voluntario_idx
    on public.escala_avisos using btree (voluntario_id);

comment on table public.escala_avisos is
  'Fila, registro e trava de duplicidade dos avisos de WhatsApp da escala. Uma linha = um aviso para uma pessoa sobre um culto. Spec: tasks/avisos-da-escala.';
comment on column public.escala_avisos.tipo is
  'confirmacao | lembrete_vespera | lembrete_no_dia | pesquisa | troca_entrou | troca_saiu. Espelho: lib/escalas/tipos.ts.';
comment on column public.escala_avisos.status is
  'pendente | enviado | falhou | pulado. pulado = nao havia como enviar (sem telefone, contato bloqueado); o motivo fica em `motivo`.';
comment on column public.escala_avisos.agendado_para is
  'Quando o plano de disparo manda sair (lib/escalas/disparo.ts). O cron so envia o que ja venceu.';

create or replace trigger escala_avisos_updated_at before update on public.escala_avisos
    for each row execute function public.fn_set_updated_at();

alter table public.escala_avisos enable row level security;

drop policy if exists tenant_isolation_escala_avisos_all on public.escala_avisos;
create policy tenant_isolation_escala_avisos_all on public.escala_avisos
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));

-- Sem `anon`: aviso nao tem leitor anonimo. O envio roda com service_role (cron) e a liderança
-- le pela RLS acima.
grant all on table public.escala_avisos to authenticated, service_role;
revoke all on table public.escala_avisos from anon;

notify pgrst, 'reload schema';
