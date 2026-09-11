/**
 * ORGANIZAÇÃO NOVA NASCE IGREJA, NÃO LOJA (migration 0144).
 *
 * ## O que se pagava
 *
 * O Cajado é um produto de igreja, mas o INSERT em `organizations` disparava
 * `fn_seed_default_pipeline_for_org()`, que semeava o funil de e-commerce herdado do
 * DeskcommCRM: pipeline `Pedidos` com `Carrinho abandonado / Aguardando pagamento /
 * Pago / Em separação / Enviado / Entregue / Pós-venda / Cancelado`. O DEFAULT de
 * `crm_pipelines.vocabulary` era o de loja (lead=Cliente, deal=Pedido, won=Pago,
 * lost=Cancelado).
 *
 * Isso é a PRIMEIRA TELA de quem instala o kit, e pela doutrina de QA Visual do
 * CLAUDE.md a primeira impressão é P0. O funil piloto só estava certo porque foi
 * renomeado à mão (docs/decisoes.md, 2026-08-14).
 *
 * ## Por que um invariante, e não um teste de unidade
 *
 * O comportamento mora num gatilho do Postgres e num DEFAULT de coluna — nada disso
 * existe em TypeScript e nada disso é exercitado por `pnpm test:unit`. Só um banco
 * real com o `baseline.sql` aplicado prova o que a organização recém-criada recebe,
 * que é exatamente o que o self-hoster vê.
 *
 * São duas origens do vocabulário de venda e corrigir uma só deixa a outra de pé: o
 * DEFAULT da coluna (vale para todo funil criado sem `vocabulary` explícito, inclusive
 * pela UI) e o corpo do gatilho. Cada uma tem seu caso aqui.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

const ORG = "00000000-0000-4000-8000-0144dae00001";
/** Funil criado à mão, sem `vocabulary` explícito — exercita o DEFAULT da coluna. */
const FUNIL_MANUAL = "00000000-0000-4000-8000-0144dae00002";

/** Espelha ETAPAS_INICIAIS (lib/pipelines/pipeline-editing.ts). */
// `||` no psql castea boolean para texto como "true"/"false" (o `t`/`f` de `-tA` só
// aparece quando a coluna é selecionada sozinha).
const ETAPAS_ESPERADAS = [
  "Visitante|novo|false|false",
  "Em acompanhamento|em_andamento|false|false",
  "Membro|ganho|true|false",
  "Afastado|perdido|false|true",
];

beforeAll(() => {
  sql(`delete from public.organizations where id = '${ORG}';`);
  sql(`
    insert into public.organizations (id, slug, legal_name, display_name)
      values ('${ORG}', 'org-0144-igreja', 'Igreja Invariante', 'Igreja Invariante');
    insert into public.crm_pipelines (id, organization_id, name, slug, position)
      values ('${FUNIL_MANUAL}', '${ORG}', 'Funil sem vocabulário', 'funil-sem-vocab', 2000);
  `);
});

describe("o gatilho de seed semeia a jornada da igreja", () => {
  it("cria UM funil padrão, chamado Jornada", () => {
    const linhas = sql(`
      select name || '|' || slug
        from public.crm_pipelines
       where organization_id = '${ORG}' and is_default
       order by position;
    `);
    expect(linhas.split("\n").filter(Boolean)).toEqual(["Jornada|jornada"]);
  });

  it("semeia as quatro etapas da jornada, na ordem, com os slugs estáveis", () => {
    const linhas = sql(`
      select s.name || '|' || s.slug || '|' || s.is_won || '|' || s.is_lost
        from public.crm_stages s
        join public.crm_pipelines p on p.id = s.pipeline_id
       where s.organization_id = '${ORG}' and p.is_default
       order by s.position;
    `);
    expect(linhas.split("\n").filter(Boolean)).toEqual(ETAPAS_ESPERADAS);
  });

  it("não semeia nenhuma etapa de e-commerce", () => {
    const sobrou = sql(`
      select count(*)
        from public.crm_stages
       where organization_id = '${ORG}'
         and slug in ('carrinho_abandonado', 'aguardando_pagamento', 'pago',
                      'em_separacao', 'enviado', 'entregue', 'pos_venda', 'cancelado');
    `);
    expect(sobrou).toBe("0");
  });

  it("deixa o funil capaz de fechar: existe etapa com is_won", () => {
    // Sem ela, /leads/[id]/win responde 422 pipeline_no_won_stage e o funil nasce
    // incapaz de graduar visitante a membro.
    const ganho = sql(`
      select count(*)
        from public.crm_stages s
        join public.crm_pipelines p on p.id = s.pipeline_id
       where s.organization_id = '${ORG}' and p.is_default and s.is_won;
    `);
    expect(ganho).toBe("1");
  });
});

describe("o DEFAULT de crm_pipelines.vocabulary é o da igreja", () => {
  it("um funil criado sem vocabulary explícito não nasce falando de venda", () => {
    const vocab = sql(`
      select vocabulary->>'lead' || '|' || (vocabulary->>'deal')
             || '|' || (vocabulary->>'won') || '|' || (vocabulary->>'lost')
        from public.crm_pipelines
       where id = '${FUNIL_MANUAL}';
    `);
    expect(vocab).toBe("Visitante|Acompanhamento|Membro|Afastado");
  });

  it("o funil semeado pelo gatilho herda o mesmo vocabulário", () => {
    const vocab = sql(`
      select vocabulary->>'lead' || '|' || (vocabulary->>'won')
        from public.crm_pipelines
       where organization_id = '${ORG}' and is_default;
    `);
    expect(vocab).toBe("Visitante|Membro");
  });
});
