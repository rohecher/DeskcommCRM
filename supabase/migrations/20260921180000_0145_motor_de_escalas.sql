-- ============================================================================
-- 0145 — MOTOR DE ESCALAS (Filhos que Servem)
--
-- Porte do motor Python (`motor/gerar.py`, 1030 linhas) para dentro do produto.
-- No Python, TODA regra é constante no topo do arquivo: `TIME_FIXO`, `PRIORIDADE`,
-- `RESERVA`, `PESO_LIDER`, `SO_CASAL`, ~30 no total. Cada ajuste que a liderança
-- pediu virou um `git commit` — e quem monta a escala da igreja não tem terminal.
-- Esta migration transforma essas constantes em DADO por organização, para as
-- telas de `/app/escalas/regras` editarem.
--
-- POR QUE SÓ 8 TABELAS, E NÃO UMA POR CONSTANTE
--
-- Sete das constantes são "esta vaga tem um elenco fechado / uma ordem de
-- preferência / um teto": `TIME_FIXO`, `PRIORIDADE`, `POOL_EXTRA`, `MAX_DO_GRUPO`,
-- `MESMO_SEXO_QUE`, `CONJUGE_DE`, `POR_FREQUENCIA`. Todas têm a MESMA chave —
-- (setor, subfunção) — então são COLUNAS da subfunção, não tabelas com FK de volta
-- para ela. `uuid[]` não tem integridade referencial declarada, e esse é o preço
-- pago de propósito: sete tabelas de duas colunas seriam sete joins em todo
-- carregamento do motor, para um dado que só a liderança da igreja escreve e que
-- o importador valida na entrada (é o que `validar_nomes()` já faz no Python,
-- criado depois de "Lucélia" ter sido escrita "Lucília" e sumido da escala por um
-- mês inteiro sem ninguém notar).
--
-- O QUE NÃO ENTRA
--
--  - `escalas_historico.csv` (6.768 linhas extraídas de 43 abas de XLSX): é
--    matéria-prima de extração, não estado do produto. Só `escala_real` (a escala
--    que a liderança APROVOU e divulgou) é histórico de verdade.
--  - `ACENTO` (mapa de acentuação pt-BR de `exportar.py`): é tradução de exibição
--    do vocabulário de setor, igual em toda igreja. Fica em código.
--  - `FIXO_NO_MES` e `SEM_NO_DIA`: hoje vazias no motor. YAGNI — quando voltarem,
--    entram em `escala_config`, que existe exatamente para regra sem tabela.
--
-- RODADA: domingo + a quinta seguinte são a MESMA equipe (medido: 85% em 50 pares
-- do histórico). O rodízio acontece ENTRE rodadas, não dentro. Daí
-- `escala_cultos.rodada_data` apontar para o domingo que abre a rodada: a quinta
-- não é um culto independente, é a segunda metade de um par.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SETORES e SUBFUNÇÕES — a `ESTRUTURA` do motor
-- ---------------------------------------------------------------------------

create table if not exists public.escala_setores (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    nome text not null,
    posicao integer default 0 not null,
    -- Núcleo: setor que não pode ficar vago (`SETOR_NUCLEO` — Intercessão,
    -- Coordenação do Culto). Perde a vaga e o culto começa sem cobertura.
    nucleo boolean default false not null,
    -- Decência: homem casado não serve sozinho com mulher que não é sua esposa.
    -- Vale para setor de dupla isolada — Cafeteria, Mesa da Comunhão,
    -- Estacionamento, Auxílio Pastoral (`DUPLA_DECENTE`).
    dupla_decente boolean default false not null,
    -- Preferir casal quando houver (`CASAL_JUNTO`).
    casal_junto boolean default false not null,
    -- EXIGE casal real homem+mulher; sem par, a vaga fica vazia em vez de
    -- receber dois homens ou duas mulheres (`SO_CASAL` — Auxílio Pastoral).
    so_casal boolean default false not null,
    -- Pool raso: escolhe cedo, senão outro setor leva os poucos candidatos
    -- (`POOL_PEQUENO` — Coordenação do Culto).
    pool_pequeno boolean default false not null,
    -- Escala montada pela liderança do próprio departamento, fora do motor
    -- (`IGNORAR` — Multimídia, M. Louvor, M. Dança, Som). Entra na escala
    -- publicada como dado externo; nunca é gerada.
    externo boolean default false not null,
    -- `RODIZIO_INVERSO_QUINTA`: gira a equipe entre domingo e quinta usando SÓ
    -- quem já foi escalado no domingo. Desligado — a primeira versão trouxe
    -- gente de fora da rodada, que é o oposto do que rodízio significa aqui.
    rodizio_inverso_quinta boolean default false not null,
    -- `REFORCO_SE_OFF`: quando ESTE setor está OFF num culto, as vagas abaixo
    -- são somadas às do culto. [{"setor":"BOAS VINDAS","subfuncao":"Recepcao","qtd":4}]
    reforco_se_off jsonb default '[]'::jsonb not null,
    ativo boolean default true not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create table if not exists public.escala_subfuncoes (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    setor_id uuid not null,
    -- '' = setor sem subfunção (Cafeteria, Estacionamento). Não é NULL de
    -- propósito: NULL não entra em UNIQUE, e duas linhas "sem subfunção" no
    -- mesmo setor é exatamente o erro que a constraint precisa barrar.
    nome text default '' not null,
    qtd integer default 1 not null,
    -- `QTD_POR_DIA`: sobrepõe `qtd` em um dia da semana. {"QUINTA": 3}
    qtd_por_dia jsonb default '{}'::jsonb not null,
    posicao integer default 0 not null,
    -- `TIME_FIXO`: elenco fechado — só estes servem nesta vaga. Ordem importa.
    time_fixo uuid[] default '{}'::uuid[] not null,
    -- `PRIORIDADE`: ordem de preferência, sem fechar o elenco (Kids Sala Maior).
    prioridade uuid[] default '{}'::uuid[] not null,
    -- `POOL_EXTRA`: gente que não vem do histórico desta vaga mas pode servir.
    pool_extra uuid[] default '{}'::uuid[] not null,
    -- `POR_FREQUENCIA`: escolhe por quem serviu MAIS nesta vaga, não por
    -- descanso. Professor de Kids precisa de continuidade, não de rodízio.
    por_frequencia boolean default false not null,
    -- `MAX_DO_GRUPO`: teto de gente do mesmo grupo/família na vaga. NULL = sem teto.
    max_do_grupo integer,
    -- `DUPLA_DECENTE_SUB` / `CASAL_JUNTO_SUB`: a regra do setor, mas só nesta
    -- subfunção (Boas Vindas › Máquina de Cartão, que é dupla isolada enquanto
    -- Recepção é grupo).
    dupla_decente boolean default false not null,
    casal_junto boolean default false not null,
    -- `MESMO_SEXO_QUE` / `CONJUGE_DE`: esta vaga espelha o sexo / recebe o
    -- cônjuge de quem ocupou a vaga apontada (Cozinha Auxiliar segue Cozinheiro).
    mesmo_sexo_que_id uuid,
    conjuge_de_id uuid,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------------
-- VOLUNTÁRIOS — a `disponibilidade.csv`
-- ---------------------------------------------------------------------------

create table if not exists public.escala_voluntarios (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    -- Grafia do CADASTRO, com acento. É a chave que a liderança lê e digita; o
    -- motor casa nomes por forma normalizada em memória, nunca reescreve esta.
    nome text not null,
    sexo text,
    status text default 'ATIVO' not null,
    -- Setor de ORIGEM ("casa") da pessoa. Se for um departamento externo
    -- (LOUVOR, MIDIA, DANCA...), ela fica ativa mas FORA do rodízio geral —
    -- louvor tem prioridade sobre qualquer outra escala. Qualquer outro valor
    -- é só preferência: `BONUS_CASA` no score daquele setor.
    departamento text default '' not null,
    dias_permitidos text[] default '{}'::text[] not null,
    setores_bloqueados text[] default '{}'::text[] not null,
    setores_permitidos text[] default '{}'::text[] not null,
    ausente_de date,
    ausente_ate date,
    max_por_mes integer,
    -- `RESERVA`: só entra quando falta gente, no máximo `reserva_max_no_mes`
    -- vezes (config). Não é punição — é quem já carrega outra função.
    reserva boolean default false not null,
    observacao text default '' not null,
    -- Liga no CRM para o bot achar o WhatsApp. Opcional: voluntário existe
    -- antes de ter contato, e apagar o contato não apaga a pessoa da escala.
    contact_id uuid,
    telefone text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create table if not exists public.escala_apelidos (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    -- Como o nome aparece na escala escrita à mão: "Josy", "Vick", "Thom".
    apelido text not null,
    voluntario_id uuid not null,
    -- Desempate por setor: o mesmo apelido pode ser duas pessoas em setores
    -- diferentes. '' = vale em qualquer setor.
    setor text default '' not null,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.escala_casais (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    voluntario_a uuid not null,
    voluntario_b uuid not null,
    -- false = derivado do histórico (servem juntos com frequência alta), ainda
    -- não confirmado pela liderança. O motor trata igual; a tela mostra a
    -- diferença para alguém confirmar.
    confirmado boolean default true not null,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.escala_lideres (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    setor_id uuid not null,
    voluntario_id uuid not null,
    -- `PAPEL_LIDERANCA`: só papel começando em "LIDER" pesa no score. Supervisor,
    -- Coordenador e Pastor NÃO — supervisionar o culto não é servir nele.
    papel text default 'LIDER' not null,
    created_at timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------------
-- CULTOS e ESCALA
-- ---------------------------------------------------------------------------

create table if not exists public.escala_cultos (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    data date not null,
    dia_semana text not null,
    hora time without time zone,
    -- Domingo que ABRE a rodada. Na quinta, aponta para o domingo -4
    -- (`QUINTA_APOS_DOMINGO`). É o que faz o par domingo/quinta compartilhar
    -- equipe em vez de sortear duas vezes.
    rodada_data date not null,
    -- rascunho = gerado, não divulgado. aprovado = a liderança validou.
    -- publicado = os voluntários já viram; mexer aqui é mudar o que foi anunciado.
    status text default 'rascunho' not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create table if not exists public.escala_setor_off (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    culto_id uuid not null,
    setor_id uuid not null,
    motivo text default '' not null,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.escala_slots (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    culto_id uuid not null,
    setor_id uuid not null,
    subfuncao_id uuid,
    -- NULL = vaga ABERTA, e ela é publicada assim de propósito: a liderança
    -- pediu que o setor apareça com a linha vazia para as pessoas verem que
    -- falta gente. Vaga escondida não arruma voluntário.
    voluntario_id uuid,
    -- gerado  = o motor escolheu
    -- fixado  = a liderança cravou ANTES de gerar (`fixados.csv`)
    -- manual  = a liderança trocou DEPOIS de gerar
    -- externo = veio pronto do departamento (louvor, mídia, dança)
    origem text default 'gerado' not null,
    motivo text default '' not null,
    -- `rejeitados.csv`: quem a liderança tirou DESTA vaga. Sem isso o motor
    -- recoloca a mesma pessoa na próxima geração e a correção se perde.
    vetados uuid[] default '{}'::uuid[] not null,
    posicao integer default 0 not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------------
-- CONFIG — os pesos e as regras que não têm tabela
-- ---------------------------------------------------------------------------

create table if not exists public.escala_config (
    id uuid default gen_random_uuid() not null,
    organization_id uuid not null,
    -- peso_rodizio, semanas_descanso, bonus_casa, peso_lider, max_padrao,
    -- quinta_apos_domingo, reserva_max_no_mes, depto_apelido, ...
    chave text not null,
    valor jsonb not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------------
-- Chaves, integridade e índices
-- ---------------------------------------------------------------------------

alter table only public.escala_setores add constraint escala_setores_pkey primary key (id);
alter table only public.escala_subfuncoes add constraint escala_subfuncoes_pkey primary key (id);
alter table only public.escala_voluntarios add constraint escala_voluntarios_pkey primary key (id);
alter table only public.escala_apelidos add constraint escala_apelidos_pkey primary key (id);
alter table only public.escala_casais add constraint escala_casais_pkey primary key (id);
alter table only public.escala_lideres add constraint escala_lideres_pkey primary key (id);
alter table only public.escala_cultos add constraint escala_cultos_pkey primary key (id);
alter table only public.escala_setor_off add constraint escala_setor_off_pkey primary key (id);
alter table only public.escala_slots add constraint escala_slots_pkey primary key (id);
alter table only public.escala_config add constraint escala_config_pkey primary key (id);

alter table only public.escala_setores
    add constraint escala_setores_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_subfuncoes
    add constraint escala_subfuncoes_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_subfuncoes
    add constraint escala_subfuncoes_setor_id_fkey foreign key (setor_id)
    references public.escala_setores(id) on delete cascade;
-- Autorreferência de `MESMO_SEXO_QUE` / `CONJUGE_DE`: apagar a vaga apontada
-- desliga a regra (set null) em vez de derrubar a vaga que aponta.
alter table only public.escala_subfuncoes
    add constraint escala_subfuncoes_mesmo_sexo_que_id_fkey foreign key (mesmo_sexo_que_id)
    references public.escala_subfuncoes(id) on delete set null;
alter table only public.escala_subfuncoes
    add constraint escala_subfuncoes_conjuge_de_id_fkey foreign key (conjuge_de_id)
    references public.escala_subfuncoes(id) on delete set null;

alter table only public.escala_voluntarios
    add constraint escala_voluntarios_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_voluntarios
    add constraint escala_voluntarios_contact_id_fkey foreign key (contact_id)
    references public.contacts(id) on delete set null;

alter table only public.escala_apelidos
    add constraint escala_apelidos_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_apelidos
    add constraint escala_apelidos_voluntario_id_fkey foreign key (voluntario_id)
    references public.escala_voluntarios(id) on delete cascade;

alter table only public.escala_casais
    add constraint escala_casais_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_casais
    add constraint escala_casais_voluntario_a_fkey foreign key (voluntario_a)
    references public.escala_voluntarios(id) on delete cascade;
alter table only public.escala_casais
    add constraint escala_casais_voluntario_b_fkey foreign key (voluntario_b)
    references public.escala_voluntarios(id) on delete cascade;
alter table only public.escala_casais
    add constraint escala_casais_distintos check (voluntario_a <> voluntario_b);

alter table only public.escala_lideres
    add constraint escala_lideres_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_lideres
    add constraint escala_lideres_setor_id_fkey foreign key (setor_id)
    references public.escala_setores(id) on delete cascade;
alter table only public.escala_lideres
    add constraint escala_lideres_voluntario_id_fkey foreign key (voluntario_id)
    references public.escala_voluntarios(id) on delete cascade;

alter table only public.escala_cultos
    add constraint escala_cultos_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;

alter table only public.escala_setor_off
    add constraint escala_setor_off_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_setor_off
    add constraint escala_setor_off_culto_id_fkey foreign key (culto_id)
    references public.escala_cultos(id) on delete cascade;
alter table only public.escala_setor_off
    add constraint escala_setor_off_setor_id_fkey foreign key (setor_id)
    references public.escala_setores(id) on delete cascade;

alter table only public.escala_slots
    add constraint escala_slots_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;
alter table only public.escala_slots
    add constraint escala_slots_culto_id_fkey foreign key (culto_id)
    references public.escala_cultos(id) on delete cascade;
alter table only public.escala_slots
    add constraint escala_slots_setor_id_fkey foreign key (setor_id)
    references public.escala_setores(id) on delete cascade;
alter table only public.escala_slots
    add constraint escala_slots_subfuncao_id_fkey foreign key (subfuncao_id)
    references public.escala_subfuncoes(id) on delete set null;
-- Apagar voluntário NÃO apaga a história de quem serviu: a vaga volta a ser
-- aberta. Escala publicada é registro, e registro que desaparece mente.
alter table only public.escala_slots
    add constraint escala_slots_voluntario_id_fkey foreign key (voluntario_id)
    references public.escala_voluntarios(id) on delete set null;

alter table only public.escala_config
    add constraint escala_config_organization_id_fkey foreign key (organization_id)
    references public.organizations(id) on delete cascade;

-- Domínios fechados. `status` de voluntário é lido por `STATUS_OK` do motor:
-- só ATIVO entra no rodízio, e um typo ("ATIVA") tirava a pessoa da escala em
-- silêncio.
alter table only public.escala_voluntarios
    add constraint escala_voluntarios_status_check
    check (status in ('ATIVO', 'INATIVO', 'SUSPENSO'));
alter table only public.escala_voluntarios
    add constraint escala_voluntarios_sexo_check
    check (sexo is null or sexo in ('M', 'F'));
alter table only public.escala_cultos
    add constraint escala_cultos_status_check
    check (status in ('rascunho', 'aprovado', 'publicado'));
alter table only public.escala_slots
    add constraint escala_slots_origem_check
    check (origem in ('gerado', 'fixado', 'manual', 'externo'));

-- Unicidade: o nome do voluntário é a chave que a liderança usa, então duas
-- "Lucélia" na mesma organização é erro de digitação, não duas pessoas.
create unique index if not exists escala_setores_org_nome_key
    on public.escala_setores using btree (organization_id, nome);
create unique index if not exists escala_subfuncoes_setor_nome_key
    on public.escala_subfuncoes using btree (setor_id, nome);
create unique index if not exists escala_voluntarios_org_nome_key
    on public.escala_voluntarios using btree (organization_id, nome);
create unique index if not exists escala_apelidos_org_apelido_setor_key
    on public.escala_apelidos using btree (organization_id, apelido, setor);
create unique index if not exists escala_lideres_setor_voluntario_key
    on public.escala_lideres using btree (setor_id, voluntario_id);
create unique index if not exists escala_cultos_org_data_key
    on public.escala_cultos using btree (organization_id, data);
create unique index if not exists escala_setor_off_culto_setor_key
    on public.escala_setor_off using btree (culto_id, setor_id);
create unique index if not exists escala_config_org_chave_key
    on public.escala_config using btree (organization_id, chave);
-- Casal é par NÃO ordenado: (a,b) e (b,a) são o mesmo casamento. Um UNIQUE
-- direto nas duas colunas deixaria a duplicata invertida passar.
create unique index if not exists escala_casais_par_key
    on public.escala_casais using btree (least(voluntario_a, voluntario_b), greatest(voluntario_a, voluntario_b));

create index if not exists escala_setores_org_idx on public.escala_setores using btree (organization_id);
create index if not exists escala_subfuncoes_org_idx on public.escala_subfuncoes using btree (organization_id);
create index if not exists escala_voluntarios_org_idx on public.escala_voluntarios using btree (organization_id);
create index if not exists escala_voluntarios_contact_idx on public.escala_voluntarios using btree (contact_id);
create index if not exists escala_apelidos_org_idx on public.escala_apelidos using btree (organization_id);
create index if not exists escala_casais_org_idx on public.escala_casais using btree (organization_id);
create index if not exists escala_lideres_org_idx on public.escala_lideres using btree (organization_id);
create index if not exists escala_cultos_org_idx on public.escala_cultos using btree (organization_id);
-- A consulta mais quente do motor: "o que rolou nas últimas N semanas" para
-- carga e descanso. Data DESC porque ele sempre olha para trás a partir de hoje.
create index if not exists escala_cultos_org_data_idx on public.escala_cultos using btree (organization_id, data desc);
create index if not exists escala_cultos_org_rodada_idx on public.escala_cultos using btree (organization_id, rodada_data);
create index if not exists escala_setor_off_org_idx on public.escala_setor_off using btree (organization_id);
create index if not exists escala_slots_org_idx on public.escala_slots using btree (organization_id);
create index if not exists escala_slots_culto_idx on public.escala_slots using btree (culto_id, posicao);
create index if not exists escala_slots_voluntario_idx on public.escala_slots using btree (voluntario_id);
create index if not exists escala_config_org_idx on public.escala_config using btree (organization_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace trigger escala_setores_updated_at before update on public.escala_setores
    for each row execute function public.fn_set_updated_at();
create or replace trigger escala_subfuncoes_updated_at before update on public.escala_subfuncoes
    for each row execute function public.fn_set_updated_at();
create or replace trigger escala_voluntarios_updated_at before update on public.escala_voluntarios
    for each row execute function public.fn_set_updated_at();
create or replace trigger escala_cultos_updated_at before update on public.escala_cultos
    for each row execute function public.fn_set_updated_at();
create or replace trigger escala_slots_updated_at before update on public.escala_slots
    for each row execute function public.fn_set_updated_at();
create or replace trigger escala_config_updated_at before update on public.escala_config
    for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — isolamento por organização, igual ao resto do banco
-- ---------------------------------------------------------------------------

alter table public.escala_setores enable row level security;
alter table public.escala_subfuncoes enable row level security;
alter table public.escala_voluntarios enable row level security;
alter table public.escala_apelidos enable row level security;
alter table public.escala_casais enable row level security;
alter table public.escala_lideres enable row level security;
alter table public.escala_cultos enable row level security;
alter table public.escala_setor_off enable row level security;
alter table public.escala_slots enable row level security;
alter table public.escala_config enable row level security;

create policy tenant_isolation_escala_setores_all on public.escala_setores
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_subfuncoes_all on public.escala_subfuncoes
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_voluntarios_all on public.escala_voluntarios
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_apelidos_all on public.escala_apelidos
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_casais_all on public.escala_casais
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_lideres_all on public.escala_lideres
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_cultos_all on public.escala_cultos
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_setor_off_all on public.escala_setor_off
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_slots_all on public.escala_slots
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));
create policy tenant_isolation_escala_config_all on public.escala_config
    using ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)))
    with check ((organization_id in (select public.fn_user_org_ids() as fn_user_org_ids)));

-- ---------------------------------------------------------------------------
-- Grants — o padrão do banco. RLS é quem barra; grant sem policy não lê nada.
-- `anon` está aqui porque é o papel do link público de consulta da escala (a
-- página que os voluntários abrem sem login), e a leitura dele passará por
-- policy própria quando essa tela existir.
-- ---------------------------------------------------------------------------

grant all on table public.escala_setores to anon, authenticated, service_role;
grant all on table public.escala_subfuncoes to anon, authenticated, service_role;
grant all on table public.escala_voluntarios to anon, authenticated, service_role;
grant all on table public.escala_apelidos to anon, authenticated, service_role;
grant all on table public.escala_casais to anon, authenticated, service_role;
grant all on table public.escala_lideres to anon, authenticated, service_role;
grant all on table public.escala_cultos to anon, authenticated, service_role;
grant all on table public.escala_setor_off to anon, authenticated, service_role;
grant all on table public.escala_slots to anon, authenticated, service_role;
grant all on table public.escala_config to anon, authenticated, service_role;

notify pgrst, 'reload schema';
