import { describe, expect, it } from "vitest";

import { motivoParaNaoMarcar, obsLimpa, statusPermitidos, statusValido } from "@/lib/escalas/status";

const HOJE = "2026-10-01";

describe("quando cada status pode ser marcado", () => {
  it("culto futuro: confirmar e pedir troca, mas não presença", () => {
    expect(statusPermitidos("2026-10-04", HOJE, true)).toEqual(["escalado", "confirmado", "troca_solicitada"]);
  });
  it("culto passado: presença e falta, mas não confirmação", () => {
    expect(statusPermitidos("2026-09-27", HOJE, true)).toEqual(["escalado", "presente", "faltou"]);
  });
  it("culto de hoje: tudo — a pessoa pode confirmar à tarde e faltar à noite", () => {
    expect(statusPermitidos(HOJE, HOJE, true)).toEqual([
      "escalado",
      "confirmado",
      "troca_solicitada",
      "presente",
      "faltou",
    ]);
  });
  it("vaga sem ninguém só fica escalada", () => {
    expect(statusPermitidos("2026-10-04", HOJE, false)).toEqual(["escalado"]);
    expect(motivoParaNaoMarcar("confirmado", "2026-10-04", HOJE, false)).toBe("a vaga está sem ninguém");
  });
  it("o motivo da recusa diz o que está errado", () => {
    expect(motivoParaNaoMarcar("faltou", "2026-10-04", HOJE, true)).toBe("o culto ainda não aconteceu");
    expect(motivoParaNaoMarcar("confirmado", "2026-09-27", HOJE, true)).toBe("o culto já passou");
    expect(motivoParaNaoMarcar("escalado", "2026-09-27", HOJE, true)).toBe("");
  });
});

describe("entrada vinda do cliente", () => {
  it("só aceita os cinco status", () => {
    expect(statusValido("confirmado")).toBe(true);
    expect(statusValido("cancelado")).toBe(false);
    expect(statusValido(undefined)).toBe(false);
  });
  it("observação curta e numa linha só", () => {
    expect(obsLimpa("  viagem\n a trabalho  ")).toBe("viagem a trabalho");
    expect(obsLimpa("x".repeat(500))).toHaveLength(200);
    expect(obsLimpa(42)).toBe("");
  });
});
