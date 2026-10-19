import { describe, expect, it } from "vitest";

import {
  classificarArquivo,
  exigePortarAMao,
  precisaRenumerar,
  zonaDoPR,
} from "@/scripts/upstream-garimpo/zonas";

// Caminhos reais do repo. O que o fork mexeu em arquivo do upstream:
const MODIFICADOS = new Set([
  "lib/audit/actions.ts",
  "components/kanban/KanbanBoard.tsx",
  "app/app/team/_components/TeamMembersClient.tsx",
]);

describe("classificarArquivo", () => {
  it.each([
    ["lib/escalas/motor.ts"],
    ["app/app/escalas/_acoes.ts"],
    ["lib/branding.ts"],
    ["docs/decisoes.md"],
    ["docs/escalas-glossario.md"],
    ["docs/dominio-nao-e-venda.md"],
    ["docs/agents/domain.md"],
    ["CLAUDE.md"],
    ["AGENTS.md"],
  ])("%s é vermelha mesmo que o fork nem tenha modificado", (caminho) => {
    expect(classificarArquivo(caminho, new Set())).toBe("vermelha");
  });

  it("arquivo do upstream que o fork já modificou é amarela", () => {
    expect(classificarArquivo("lib/audit/actions.ts", MODIFICADOS)).toBe("amarela");
    expect(classificarArquivo("components/kanban/KanbanBoard.tsx", MODIFICADOS)).toBe("amarela");
  });

  it("baseline.sql e MANIFEST.md são amarelos (portar à mão), não vermelhos", () => {
    expect(classificarArquivo("supabase/baseline.sql", new Set())).toBe("amarela");
    expect(classificarArquivo("supabase/migrations/MANIFEST.md", new Set())).toBe("amarela");
    expect(exigePortarAMao("supabase/baseline.sql")).toBe(true);
    expect(exigePortarAMao("lib/audit/actions.ts")).toBe(false);
  });

  it("PR de schema com 50 arquivos verdes e o baseline não vira vermelho", () => {
    const zonas = ["supabase/baseline.sql", "lib/ai/x.ts", "workers/y.ts"].map((f) =>
      classificarArquivo(f, new Set()),
    );
    expect(zonaDoPR(zonas)).toBe("amarela");
  });

  it("migration com 'escala' no nome não é vermelha por isso ('escalação' é do upstream)", () => {
    expect(
      classificarArquivo("supabase/migrations/20261001000000_0600_escalacao_do_turno.sql", new Set()),
    ).toBe("verde");
  });

  it("arquivo que o fork não tocou é verde", () => {
    expect(classificarArquivo("lib/ai/dispatcher/rate-limit.ts", MODIFICADOS)).toBe("verde");
    expect(classificarArquivo("workers/agent-engine.ts", MODIFICADOS)).toBe("verde");
  });

  it("vermelha vence amarela: não existe arquivo vermelho 'resolvível' por tradução", () => {
    expect(
      classificarArquivo("lib/branding.ts", new Set(["lib/branding.ts"])),
    ).toBe("vermelha");
  });

  it("não confunde prefixo parecido: lib/escalas-x não é lib/escalas/", () => {
    expect(classificarArquivo("lib/escalasX/foo.ts", new Set())).toBe("verde");
    expect(classificarArquivo("docs/agents-extra.md", new Set())).toBe("verde");
  });
});

describe("zonaDoPR", () => {
  it("o PR herda a PIOR zona dos arquivos", () => {
    expect(zonaDoPR(["verde", "amarela"])).toBe("amarela");
    expect(zonaDoPR(["verde", "amarela", "vermelha"])).toBe("vermelha");
    expect(zonaDoPR(["verde", "verde"])).toBe("verde");
  });

  it("PR sem arquivo é verde (nada a conflitar)", () => {
    expect(zonaDoPR([])).toBe("verde");
  });
});

describe("precisaRenumerar", () => {
  it("migration do upstream sempre precisa de número novo", () => {
    expect(
      precisaRenumerar("supabase/migrations/20261019010000_0683_atualizar_card_por_fonte.sql"),
    ).toBe(true);
    expect(
      precisaRenumerar("supabase/migrations/20260810121000_0144_followup_timing_plan.sql"),
    ).toBe(true);
  });

  it("o resto não", () => {
    expect(precisaRenumerar("supabase/migrations/MANIFEST.md")).toBe(false);
    expect(precisaRenumerar("lib/audit/actions.ts")).toBe(false);
  });
});
