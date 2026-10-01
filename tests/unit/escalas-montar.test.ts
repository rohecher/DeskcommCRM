import { describe, expect, it } from "vitest";

import { diaDaSemanaIso } from "@/lib/escalas/mes";
import { datasDeCulto, planoDoMes } from "@/lib/escalas/montar";

const HORARIO = { QUINTA: "19:20", DOMINGO: "19:00" };

describe("datas de culto do mês", () => {
  it("dia da semana certo em qualquer fuso", () => {
    expect(diaDaSemanaIso("2026-10-01")).toBe("QUINTA");
    expect(diaDaSemanaIso("2026-10-04")).toBe("DOMINGO");
    expect(diaDaSemanaIso("2026-10-05")).toBe("SEGUNDA");
  });
  it("novembro de 2026: quintas e domingos", () => {
    expect(datasDeCulto("2026-11", HORARIO)).toEqual([
      "2026-11-01",
      "2026-11-05",
      "2026-11-08",
      "2026-11-12",
      "2026-11-15",
      "2026-11-19",
      "2026-11-22",
      "2026-11-26",
      "2026-11-29",
    ]);
  });
  it("segue o horário configurado, não um calendário fixo", () => {
    expect(datasDeCulto("2026-11", { SABADO: "18:00" })).toHaveLength(4);
  });
});

describe("o que o motor pode gerar", () => {
  const datas = ["2026-10-29", "2026-11-01", "2026-11-05", "2026-11-08"];
  const hoje = "2026-11-01";

  it("não toca culto publicado nem data que já passou", () => {
    const r = planoDoMes(
      datas,
      [
        { data: "2026-11-05", status: "publicado" },
        { data: "2026-11-08", status: "rascunho" },
      ],
      hoje,
    );
    expect(r.gerar).toEqual(["2026-11-01", "2026-11-08"]);
    expect(r.pulados).toEqual([
      { data: "2026-10-29", motivo: "ja_passou" },
      { data: "2026-11-05", motivo: "publicado" },
    ]);
  });
  it("culto aprovado conta como publicado — também não é tocado", () => {
    const r = planoDoMes(["2026-11-08"], [{ data: "2026-11-08", status: "aprovado" }], hoje);
    expect(r.gerar).toEqual([]);
  });
  it("hoje ainda pode ser montado", () => {
    expect(planoDoMes(["2026-11-01"], [], hoje).gerar).toEqual(["2026-11-01"]);
  });
});
