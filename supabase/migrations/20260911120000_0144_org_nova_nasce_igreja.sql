-- ============================================================================
-- 0144 — ORGANIZAÇÃO NOVA NASCE IGREJA, NÃO LOJA
--
-- O Cajado é um produto de igreja, mas toda organização criada neste banco ainda
-- nascia com o funil de e-commerce herdado do DeskcommCRM:
--
--   pipeline "Pedidos" → Carrinho abandonado / Aguardando pagamento / Pago /
--   Em separação / Enviado / Entregue / Pós-venda / Cancelado
--
-- e `crm_pipelines.vocabulary` com o DEFAULT de loja
-- (lead=Cliente, deal=Pedido, won=Pago, lost=Cancelado).
--
-- Isso não é resquício cosmético: é a PRIMEIRA TELA de quem instala. O funil piloto
-- só está certo porque foi renomeado à mão (docs/decisoes.md, 2026-08-14); qualquer
-- igreja que instale o kit abre o produto e vê carrinho abandonado. Pela doutrina de
-- QA Visual do CLAUDE.md, a primeira impressão é P0, e `docs/decisoes.md` já registrava
-- o gatilho como pendência declarada.
--
-- Duas origens do vocabulário de venda, e só corrigir uma deixa a outra de pé:
--
--   (A) o DEFAULT da coluna `crm_pipelines.vocabulary` — vale para TODO funil criado
--       sem passar `vocabulary` explícito, inclusive os criados pela UI;
--   (B) o corpo de `fn_seed_default_pipeline_for_org()`, que roda no INSERT de
--       `organizations` e escrevia nome e etapas de loja.
--
-- Os nomes das etapas espelham `ETAPAS_INICIAIS` (lib/pipelines/pipeline-editing.ts),
-- que já é o que o usuário recebe ao criar um funil à mão — o funil semeado e o funil
-- criado na tela deixam de divergir. Os SLUGS são preservados
-- (`novo/em_andamento/ganho/perdido`): slug é chave estável, não rótulo.
--
-- A etapa de GANHO não é enfeite: `/leads/[id]/win` procura `is_won` e responde 422
-- `pipeline_no_won_stage` sem ela.
--
-- SEM BACKFILL, DE PROPÓSITO. Renomear funil, etapa ou vocabulário de organização que
-- já existe é mexer em dado que o dono pode ter customizado — e o nome da etapa é
-- exibição, não chave (o código lê slug e `is_won`/`is_lost`). Quem já instalou
-- renomeia em Configurações › Funis. Esta migration muda o que NASCE, não o que É.
-- ============================================================================

alter table public.crm_pipelines
  alter column vocabulary set default jsonb_build_object(
    'lead',         'Visitante',
    'lead_plural',  'Visitantes',
    'deal',         'Acompanhamento',
    'deal_plural',  'Acompanhamentos',
    'won',          'Membro',
    'lost',         'Afastado',
    'stage',        'Etapa da Jornada',
    'stage_plural', 'Etapas'
  );

create or replace function public.fn_seed_default_pipeline_for_org() returns trigger
    language plpgsql
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_pipeline_id uuid;
  v_position numeric := 1000;
  r record;
begin
  insert into public.crm_pipelines (organization_id, name, slug, is_default, position)
  values (new.id, 'Jornada', 'jornada', true, 1000)
  returning id into v_pipeline_id;

  -- espelha ETAPAS_INICIAIS (lib/pipelines/pipeline-editing.ts): o funil semeado e o
  -- funil criado na tela precisam nascer iguais.
  for r in
    select * from (values
      ('Visitante',         'novo',         false, false),
      ('Em acompanhamento', 'em_andamento', false, false),
      ('Membro',            'ganho',        true,  false),
      ('Afastado',          'perdido',      false, true)
    ) as t(stage_name, stage_slug, won, lost)
  loop
    insert into public.crm_stages (organization_id, pipeline_id, name, slug, position, is_won, is_lost)
    values (new.id, v_pipeline_id, r.stage_name, r.stage_slug, v_position, r.won, r.lost);
    v_position := v_position + 1000;
  end loop;

  return new;
end$$;

-- `create or replace` preserva a ACL da função, que já existia no baseline — não há
-- grant novo a revogar. O `vocabulary` do funil semeado vem do DEFAULT acima.

notify pgrst, 'reload schema';
