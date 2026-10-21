import { describe, expect, it } from "vitest";

import { conflitosDoMergeTree, fragmentosDeRelease, lerMerge, montarAviso, sinaisDe, type ItemDoAviso } from "@/scripts/upstream-garimpo/coleta";

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

const SEM_SINAIS = { bot: false, vendas: false, schema: false, tela: false };
const item = (o: Partial<ItemDoAviso>): ItemDoAviso => ({
  numero: 1,
  titulo: "t",
  zona: "verde",
  sinais: SEM_SINAIS,
  renumerar: [],
  ...o,
});

describe("montarAviso", () => {
  it("resumo do dia: contagens, migration, destaques com bot na frente e o link", () => {
    const itens = [
      item({ numero: 10, titulo: "ajuste de tela", zona: "amarela" }),
      item({ numero: 2865, titulo: "atribuição respeita visibilidade", sinais: { ...SEM_SINAIS, bot: true } }),
      item({ numero: 11, zona: "verde", renumerar: ["supabase/migrations/x_0683_y.sql"] }),
    ];
    expect(montarAviso("2026-10-16", itens, "https://github.com/x/pull/9")).toBe(
      [
        "Garimpo de 16/10: 3 itens novos no upstream.",
        "2 entram limpos, 1 pede cuidado.",
        "1 traz migration.",
        "Para olhar primeiro: #2865 atribuição respeita visibilidade; #10 ajuste de tela; #11 t.",
        "Decida aqui: https://github.com/x/pull/9",
      ].join("\n"),
    );
  });

  it("singular e sem linhas zeradas", () => {
    const txt = montarAviso("2026-10-17", [item({ numero: 5, titulo: "x" })], "u");
    expect(txt).toContain("1 item novo no upstream.");
    expect(txt).not.toContain("migration");
    expect(txt).not.toContain("Cajado");
  });

  it("vermelho aparece na contagem mas nunca nos destaques", () => {
    const txt = montarAviso("2026-10-17", [item({ numero: 7, titulo: "mexe em escala", zona: "vermelha" })], "u");
    expect(txt).toContain("1 mexe em área do Cajado");
    expect(txt).not.toContain("Para olhar primeiro");
  });

  it("título do upstream é cortado, sem quebra de linha e sem virar marcação", () => {
    const longo = `fix: ${"a".repeat(200)}\ninjetado *negrito*`;
    const txt = montarAviso("2026-10-17", [item({ numero: 8, titulo: longo })], "u");
    const destaque = txt.split("\n").find((l) => l.startsWith("Para olhar primeiro"))!;
    expect(destaque.length).toBeLessThan(120);
    expect(txt.split("\n")).toHaveLength(4);
  });
});

describe("conflitosDoMergeTree", () => {
  it("lê os arquivos entre o OID e a primeira linha em branco", () => {
    const saida = [
      "4e893b45a4b162cb8dfa1a30d288066b4d156d29",
      "app/app/ai/followups/_components/FlowsList.tsx",
      "lib/i18n/dicionario.ts",
      "",
      "CONFLITO (conteúdo): Conflito de merge em app/app/ai/followups/_components/FlowsList.tsx",
    ].join("\n");
    expect(conflitosDoMergeTree(saida)).toEqual([
      "app/app/ai/followups/_components/FlowsList.tsx",
      "lib/i18n/dicionario.ts",
    ]);
  });

  it("merge limpo: só o OID, nenhuma linha de conflito", () => {
    expect(conflitosDoMergeTree("2f0bad117f553984705d61ae64901dbad4cf8573\n")).toEqual([]);
    expect(conflitosDoMergeTree("2f0bad117f553984705d61ae64901dbad4cf8573")).toEqual([]);
  });
});
