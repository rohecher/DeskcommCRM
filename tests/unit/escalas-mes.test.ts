import { describe, expect, it } from "vitest";

import {
  chavesDoCulto,
  hojeIso,
  limitesDoMes,
  linhasDaTabela,
  mesAnterior,
  mesSeguinte,
  mesValido,
  nomeDoCulto,
  nomeDoMes,
  tipoDoCulto,
} from "@/lib/escalas/mes";

describe("hojeIso — o dia é o da igreja, não o do servidor", () => {
  it("23h de 30/09 em São Paulo já é 01/10 em UTC, e a tela tem de dizer 30/09", () => {
    expect(hojeIso(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09-30");
  });
  it("meio-dia é o mesmo dia nos dois fusos", () => {
    expect(hojeIso(new Date("2026-10-01T15:00:00Z"))).toBe("2026-10-01");
  });
});

describe("navegação de mês", () => {
  it("vira o ano nos dois sentidos", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesSeguinte("2026-09")).toBe("2026-10");
  });
  it("só aceita AAAA-MM com mês de 01 a 12 — o valor vem da URL", () => {
    expect(mesValido("2026-10")).toBe(true);
    expect(mesValido("2026-13")).toBe(false);
    expect(mesValido("2026-1")).toBe(false);
    expect(mesValido("2026-10'; drop")).toBe(false);
    expect(mesValido(undefined)).toBe(false);
  });
  it("o último dia respeita fevereiro bissexto", () => {
    expect(limitesDoMes("2026-10")).toEqual({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(limitesDoMes("2028-02").fim).toBe("2028-02-29");
    expect(limitesDoMes("2026-02").fim).toBe("2026-02-28");
  });
  it("nome do mês em português", () => {
    expect(nomeDoMes("2026-03")).toBe("Março de 2026");
  });
});

describe("tipo do culto", () => {
  it("só vagas do louvor = sala de oração", () => {
    expect(tipoDoCulto(["externo", "externo"])).toBe("oracao");
    expect(nomeDoCulto("SEGUNDA", "oracao")).toBe("Sala de Oração");
  });
  it("uma vaga geral já faz dele um culto", () => {
    expect(tipoDoCulto(["externo", "gerado"])).toBe("culto");
    expect(nomeDoCulto("QUINTA", "culto")).toBe("Quinta Profética");
    expect(nomeDoCulto("DOMINGO", "culto")).toBe("Domingo de Celebração");
  });
  it("culto sem vaga nenhuma não vira sala de oração", () => {
    expect(tipoDoCulto([])).toBe("culto");
  });
});

describe("linhas da tabela", () => {
  const v = (setor: string, subfuncao: string, setorPosicao: number, posicao: number) => ({
    setor,
    subfuncao,
    setorPosicao,
    posicao,
  });

  it("numera a vaga repetida da mesma função", () => {
    expect(chavesDoCulto([v("BV", "Recepcao", 1, 1), v("BV", "Recepcao", 1, 2)])).toEqual([
      "BV|Recepcao|1",
      "BV|Recepcao|2",
    ]);
  });

  it("a 4ª recepção do domingo vira linha, vazia na quinta que só tem 3", () => {
    const domingo = [1, 2, 3, 4].map((p) => v("BV", "Recepcao", 2, p));
    const quinta = [1, 2, 3].map((p) => v("BV", "Recepcao", 2, p));
    const linhas = linhasDaTabela([quinta, domingo]);
    expect(linhas.map((l) => l.chave)).toEqual([
      "BV|Recepcao|1",
      "BV|Recepcao|2",
      "BV|Recepcao|3",
      "BV|Recepcao|4",
    ]);
  });

  it("ordena pela posição do setor, não pela ordem de chegada", () => {
    const linhas = linhasDaTabela([[v("COZINHA", "Apoio", 5, 1), v("ATALAIAS", "Altar", 1, 2)]]);
    expect(linhas.map((l) => l.setor)).toEqual(["ATALAIAS", "COZINHA"]);
  });
});
