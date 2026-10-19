import { describe, expect, it } from "vitest";

import { fragmentosDeRelease, lerMerge, sinaisDe } from "@/scripts/upstream-garimpo/coleta";

describe("lerMerge", () => {
  it("PR: número do assunto, título da primeira linha do corpo", () => {
    expect(
      lerMerge(
        "Merge pull request #2824 from vanksestevao/feat/router-api",
        "\nfeat(ai): roteador por token\n\nDetalhes…",
      ),
    ).toEqual({ numero: 2824, titulo: "feat(ai): roteador por token" });
  });

  it("corpo vazio cai no assunto", () => {
    expect(lerMerge("Merge pull request #7 from a/b", "")).toEqual({
      numero: 7,
      titulo: "Merge pull request #7 from a/b",
    });
  });

  it("merge de branch, sem PR, tem número nulo", () => {
    expect(lerMerge("Merge branch 'main' into fix/x", "").numero).toBeNull();
    expect(lerMerge("Merge remote-tracking branch 'origin/main' into HEAD", "").numero).toBeNull();
  });
});

describe("sinaisDe", () => {
  it("IA, WhatsApp e worker acendem 'bot'", () => {
    expect(sinaisDe(["lib/ai/dispatcher/rate-limit.ts"]).bot).toBe(true);
    expect(sinaisDe(["workers/agent-engine.ts"]).bot).toBe(true);
    expect(sinaisDe(["app/app/ai/agents/page.tsx"]).bot).toBe(true);
  });

  it("Nuvemshop e cobrança acendem 'vendas'", () => {
    expect(sinaisDe(["lib/integrations/nuvemshop/sync.ts"]).vendas).toBe(true);
    expect(sinaisDe(["app/api/v1/billing/portal/route.ts"]).vendas).toBe(true);
  });

  it("migration acende 'schema'; tela acende 'tela'", () => {
    expect(sinaisDe(["supabase/migrations/20261019_0683_x.sql"]).schema).toBe(true);
    expect(sinaisDe(["components/kanban/StageColumn.tsx"]).tela).toBe(true);
  });

  it("arquivo neutro não acende nada", () => {
    expect(sinaisDe(["README.md"])).toEqual({ bot: false, vendas: false, schema: false, tela: false });
  });
});

describe("fragmentosDeRelease", () => {
  it("só docs/release/*.md direto", () => {
    expect(
      fragmentosDeRelease(["docs/release/teto-de-orcamento.md", "docs/release/x/y.md", "docs/other.md"]),
    ).toEqual(["docs/release/teto-de-orcamento.md"]);
  });
});
