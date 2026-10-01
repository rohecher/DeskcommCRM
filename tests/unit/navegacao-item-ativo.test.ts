import { describe, expect, it } from "vitest";

import { hrefAtivo } from "@/lib/navigation/ativo";

const escalas = [
  "/app/escalas",
  "/app/escalas/voluntarios",
  "/app/escalas/cobertura",
  "/app/escalas/setores",
  "/app/escalas/regras",
  "/app/inbox",
];

describe("item ativo do menu", () => {
  it("em Filhos que Servem, só ele fica marcado — não junto com Escalas", () => {
    expect(hrefAtivo("/app/escalas/voluntarios", escalas)).toBe("/app/escalas/voluntarios");
  });
  it("na porta do módulo, Escalas", () => {
    expect(hrefAtivo("/app/escalas", escalas)).toBe("/app/escalas");
  });
  it("no detalhe de um culto, que não tem item próprio, continua Escalas", () => {
    expect(hrefAtivo("/app/escalas/2026-10-01", escalas)).toBe("/app/escalas");
  });
  it("prefixo de texto não é prefixo de rota", () => {
    expect(hrefAtivo("/app/escalasx", escalas)).toBeNull();
  });
  it("rota fora do menu não marca nada", () => {
    expect(hrefAtivo("/app/kanban", escalas)).toBeNull();
  });
});
