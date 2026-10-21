import { describe, expect, it } from "vitest";

import { countAs, sql, writeCountAs } from "./gov-helpers";

/**
 * O que a migration 0150 promete (`escala_avisos`), cobrado no banco que o CLONE recebe: o Postgres
 * descartável que nasce do `supabase/baseline.sql`, e não o de dev.
 *
 * Cada caso protege uma decisão da tabela, e não só o fato de ela existir:
 *
 *  1. **Isolamento nas duas direções.** Aviso liga uma pessoa a um culto; ver o da outra igreja é
 *     ver quem serve onde. O `with check` (org B escrevendo COM o id da org A) é o lado que uma
 *     policy só com `using` deixa passar.
 *  2. **A trava contra duplicar.** É o que impede aprovar duas vezes, ou o cron reiniciar no meio,
 *     de mandar a mesma mensagem duas vezes a 100 pessoas. Os dois lados: o mesmo aviso colide, e
 *     tipos diferentes para a mesma pessoa e o mesmo culto convivem (confirmação e lembrete).
 *  3. **O vocabulário fechado.** `tipo` e `status` com CHECK: um valor inventado que passasse
 *     quebraria o cron em silêncio, que só roda de manhã.
 *  4. **O que apaga o quê.** Apagar a pessoa apaga os avisos dela (LGPD). Apagar um culto com aviso
 *     é BLOQUEADO: o registro do que foi enviado é histórico e não some junto.
 *  5. **Sem `anon`.** Aviso não tem leitor anônimo.
 */

// Namespace pela MIGRATION (`0150aaaa`/`0150bbbb`): os arquivos de invariante rodam em PARALELO
// contra o MESMO container, e UUID reusado não é colisão teórica.
const ORG_A = "0150aaaa-0000-4000-8000-000000000001";
const ORG_B = "0150bbbb-0000-4000-8000-000000000002";
const MEMBRO_A = "0150aaaa-1111-4000-8000-000000000001";
const MEMBRO_B = "0150bbbb-1111-4000-8000-000000000002";
const CULTO_A = "0150aaaa-2222-4000-8000-000000000001";
const CULTO_B = "0150bbbb-2222-4000-8000-000000000002";
const VOLUNTARIO_A = "0150aaaa-3333-4000-8000-000000000001";
const VOLUNTARIO_B = "0150bbbb-3333-4000-8000-000000000002";

function semear(): void {
  sql(`
    insert into auth.users (id, email) values
      ('${MEMBRO_A}', 'avisos-a@invariant.test'),
      ('${MEMBRO_B}', 'avisos-b@invariant.test')
      on conflict do nothing;
    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'avisos-inv-a', 'Avisos Inv A', 'Avisos A'),
      ('${ORG_B}', 'avisos-inv-b', 'Avisos Inv B', 'Avisos B')
      on conflict do nothing;
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${MEMBRO_A}', '${ORG_A}', 'manager', now()),
      ('${MEMBRO_B}', '${ORG_B}', 'manager', now())
      on conflict do nothing;
    insert into public.escala_cultos (id, organization_id, data, dia_semana, rodada_data) values
      ('${CULTO_A}', '${ORG_A}', '2026-11-08', 'DOMINGO', '2026-11-08'),
      ('${CULTO_B}', '${ORG_B}', '2026-11-08', 'DOMINGO', '2026-11-08')
      on conflict do nothing;
    insert into public.escala_voluntarios (id, organization_id, nome) values
      ('${VOLUNTARIO_A}', '${ORG_A}', 'Voluntario 001'),
      ('${VOLUNTARIO_B}', '${ORG_B}', 'Voluntario 002')
      on conflict do nothing;
  `);
}

const COLUNAS = "(organization_id, tipo, culto_id, voluntario_id, agendado_para)";
const linha = (org: string, tipo: string, culto: string, vol: string) =>
  `('${org}', '${tipo}', '${culto}', '${vol}', now())`;

function erroDe(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    // execFileSync joga o stderr do psql em `stderr`; a mensagem do Error só traz o exit.
    const err = e as { stderr?: Buffer | string; message?: string };
    return String(err.stderr ?? "") + String(err.message ?? "");
  }
  throw new Error("o comando passou — a trava não existe neste banco");
}

describe("0150 · os avisos da escala chegam ao clone", () => {
  it("a tabela nasce com RLS ligada e a policy de tenant", () => {
    semear();
    expect(sql(`select relrowsecurity from pg_class where relname = 'escala_avisos'`)).toBe("t");
    expect(
      sql(`select policyname from pg_policies
            where schemaname = 'public' and tablename = 'escala_avisos' order by 1`),
    ).toBe("tenant_isolation_escala_avisos_all");
  });

  it("a liderança da org A grava na própria org e lê de volta", () => {
    expect(
      writeCountAs(
        MEMBRO_A,
        `insert into public.escala_avisos ${COLUNAS} values ${linha(ORG_A, "confirmacao", CULTO_A, VOLUNTARIO_A)}`,
      ),
    ).toBe(1);
    expect(
      countAs(MEMBRO_A, `select count(*) from public.escala_avisos where organization_id = '${ORG_A}';`),
    ).toBe(1);
  });

  it("a org B NÃO vê o aviso da org A", () => {
    expect(
      countAs(MEMBRO_B, `select count(*) from public.escala_avisos where organization_id = '${ORG_A}';`),
    ).toBe(0);
  });

  it("a org B NÃO escreve COM o organization_id da org A (o lado `with check`)", () => {
    expect(
      writeCountAs(
        MEMBRO_B,
        `insert into public.escala_avisos ${COLUNAS} values ${linha(ORG_A, "lembrete_no_dia", CULTO_A, VOLUNTARIO_A)}`,
      ),
    ).toBe(0);
    // 0 para quem bypassa RLS separa "foi barrado" de "foi gravado e o SELECT é que não enxerga".
    expect(sql(`select count(*) from public.escala_avisos where tipo = 'lembrete_no_dia'`)).toBe("0");
  });

  it("o MESMO aviso colide — senão aprovar duas vezes manda duas mensagens", () => {
    const erro = erroDe(() =>
      sql(`insert into public.escala_avisos ${COLUNAS} values ${linha(ORG_A, "confirmacao", CULTO_A, VOLUNTARIO_A)};`),
    );
    expect(erro).toContain("escala_avisos_org_tipo_culto_vol_key");
  });

  it("OUTRO tipo para a mesma pessoa e o mesmo culto convive — confirmação e lembrete são dois avisos", () => {
    sql(`insert into public.escala_avisos ${COLUNAS} values ${linha(ORG_A, "lembrete_vespera", CULTO_A, VOLUNTARIO_A)};`);
    expect(
      sql(`select count(*) from public.escala_avisos
            where organization_id = '${ORG_A}' and culto_id = '${CULTO_A}' and voluntario_id = '${VOLUNTARIO_A}'`),
    ).toBe("2");
  });

  it("status e tipo inventados são recusados pelo banco", () => {
    expect(
      erroDe(() =>
        sql(`insert into public.escala_avisos (organization_id, tipo, culto_id, voluntario_id, agendado_para, status)
             values ('${ORG_A}', 'pesquisa', '${CULTO_A}', '${VOLUNTARIO_A}', now(), 'meio-enviado');`),
      ),
    ).toContain("escala_avisos_status_check");
    expect(
      erroDe(() =>
        sql(`insert into public.escala_avisos ${COLUNAS} values ${linha(ORG_A, "propaganda", CULTO_A, VOLUNTARIO_A)};`),
      ),
    ).toContain("escala_avisos_tipo_check");
  });

  it("culto com aviso NÃO é apagado em silêncio — o registro do que foi enviado é histórico", () => {
    const erro = erroDe(() => sql(`delete from public.escala_cultos where id = '${CULTO_A}';`));
    expect(erro).toContain("escala_avisos_culto_id_fkey");
    expect(sql(`select count(*) from public.escala_avisos where culto_id = '${CULTO_A}'`)).toBe("2");
  });

  it("apagar a pessoa apaga os avisos dela (LGPD)", () => {
    sql(`delete from public.escala_voluntarios where id = '${VOLUNTARIO_A}';`);
    expect(sql(`select count(*) from public.escala_avisos where voluntario_id = '${VOLUNTARIO_A}'`)).toBe("0");
  });

  it("o anon não tem nenhum privilégio na tabela", () => {
    expect(
      sql(`select has_table_privilege('anon', 'public.escala_avisos', 'select')
               or has_table_privilege('anon', 'public.escala_avisos', 'insert')`),
    ).toBe("f");
  });
});
