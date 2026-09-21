-- ============================================================================
-- 0147 — O HISTÓRICO DE QUEM SERVIU É O APRENDIZADO DO MOTOR
--
-- A 0145 deixou `escalas_historico.csv` de fora com a justificativa de que era
-- "matéria-prima de extração, não estado do produto". Essa leitura estava
-- errada, e o porte do motor para TypeScript é onde ela aparece: `perfis()` —
-- a função que dá a NOTA de cada candidato — é calculada sobre esse histórico
-- inteiro. Dele saem os quatro termos do score:
--
--   afinidade    = vezes no setor / total de vezes que serviu
--   experiencia  = vezes no setor, saturando em 30
--   especialista = vezes NAQUELA subfunção, saturando em 10
--   no_dia       = proporção de vezes que serviu naquele dia da semana
--
-- e mais `ultima_data`, que é o termo de descanso. Sem a tabela, o motor no app
-- não tem como pontuar ninguém: todo mundo empata em zero e a escala vira
-- sorteio. Os `escala_slots` da 0145 cobrem 13/09 a 15/10 — dez cultos. O
-- histórico cobre 141, de 2025-01-01 em diante. Não dá para derivar um do outro.
--
-- POR QUE TABELA SEPARADA, E NÃO MAIS `escala_slots`
--
-- `escala_slots` é a escala OFICIAL: cada linha é uma vaga que a liderança
-- publicou, com origem declarada e um voluntário (ou a vaga aberta de
-- propósito). O histórico é outra coisa — é o resultado de LER 43 abas de
-- planilha e casar texto escrito à mão com o cadastro. Por isso ele carrega o
-- `texto_bruto` ("Mariane"), o `metodo` que o reconheceu (`primeiro_nome`,
-- `fuzzy_primeiro`, `apelido_do_setor`…) e o `score` de confiança: 2.510 dos
-- 4.970 registros foram casados por primeiro nome e 226 por similaridade, e
-- quem for auditar uma escalação estranha daqui a um ano precisa poder ver que
-- aquele "Mariane" virou "Mariana Exemplo Da Silva" com 0.923 de confiança.
--
-- Misturar as duas apagaria essa procedência e poria 4.970 linhas de planilha
-- lida por heurística dentro da tabela que a tela de escala publica.
--
-- `dia` É NULLABLE, E ISSO NÃO É DESLEIXO. 84 dos 4.970 registros vieram de
-- abas que só identificavam o mês ("JAN2024"), sem dia. Eles contam para
-- afinidade, experiência e dia da semana, mas não para carga por período nem
-- para rodada — exatamente como `dia_do_registro()` faz no Python, devolvendo
-- None e sendo ignorado por `carga_por_periodo` e `equipes_por_rodada`.
-- Descartá-los mudaria o perfil de quem serviu naquelas abas e o porte deixaria
-- de reproduzir o motor que a liderança já aprovou.
-- ============================================================================

create table if not exists public.escala_historico (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    voluntario_id uuid not null,
    -- Competência: ano/mês sempre; `dia` só quando a aba identificava a data.
    ano integer not null,
    mes integer not null,
    dia integer,
    dia_semana text default '' not null,
    setor text not null,
    subfuncao text default '' not null,
    -- Procedência do reconhecimento. `texto_bruto` é o que estava escrito na
    -- planilha; `metodo` e `score` dizem como se chegou ao voluntário.
    aba text default '' not null,
    texto_bruto text default '' not null,
    metodo text default '' not null,
    score numeric(4, 3),
    created_at timestamp with time zone default now() not null
);

alter table only public.escala_historico
    add constraint escala_historico_pkey primary key (id);

alter table only public.escala_historico
    add constraint escala_historico_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;

-- Apagar o voluntário apaga o histórico dele: diferente de `escala_slots`, aqui
-- a linha não é registro público de um culto — é o insumo do score. Histórico
-- órfão não pontua ninguém e só enviesaria contagens de setor.
alter table only public.escala_historico
    add constraint escala_historico_voluntario_id_fkey foreign key (voluntario_id)
    references public.escala_voluntarios(id) on delete cascade;

alter table only public.escala_historico
    add constraint escala_historico_mes_check check (mes between 1 and 12);
alter table only public.escala_historico
    add constraint escala_historico_dia_check check (dia is null or dia between 1 and 31);

create index if not exists escala_historico_org_idx
    on public.escala_historico using btree (organization_id);
-- A consulta que o motor faz em toda geração: o histórico do voluntário para
-- montar o perfil.
create index if not exists escala_historico_voluntario_idx
    on public.escala_historico using btree (voluntario_id, setor);
-- E a janela recente (carga e descanso), que anda sempre para trás a partir de hoje.
create index if not exists escala_historico_org_data_idx
    on public.escala_historico using btree (organization_id, ano desc, mes desc, dia desc);

alter table public.escala_historico enable row level security;

create policy tenant_isolation_escala_historico_all on public.escala_historico
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));

grant all on table public.escala_historico to anon, authenticated, service_role;

notify pgrst, 'reload schema';
