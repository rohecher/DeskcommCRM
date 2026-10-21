import { describe, expect, it } from "vitest";

import { capacidadePorHora, planejarDisparo } from "@/lib/escalas/disparo";

/** Horário de Brasília (UTC-3, sem horário de verão desde 2019). 2 e 3 de novembro de 2026 são segunda e terça. */
const nov = (dia: number, hora: number) => new Date(`2026-11-${String(dia).padStart(2, "0")}T${String(hora).padStart(2, "0")}:00:00-03:00`);

const REGRA = { janelaInicio: 7, janelaFim: 22, diasSemEnvio: [0] }; // domingo = 0

describe("capacidadePorHora: o teto se adapta ao limite do número", () => {
  it("usa o teto configurado quando o limite diário folga", () => {
    expect(capacidadePorHora({ tetoPorHora: 25, limiteDiario: 1000, horasDaJanela: 15 })).toBe(25);
  });

  it("baixa o teto quando o limite diário é menor (300 por dia em 15 horas = 20 por hora)", () => {
    expect(capacidadePorHora({ tetoPorHora: 25, limiteDiario: 300, horasDaJanela: 15 })).toBe(20);
  });

  it("nunca chega a zero: número com limite minúsculo ainda manda 1 por hora", () => {
    expect(capacidadePorHora({ tetoPorHora: 25, limiteDiario: 10, horasDaJanela: 15 })).toBe(1);
  });
});

describe("planejarDisparo: quando começa, em que blocos e quando termina", () => {
  it("35 pessoas com 25 por hora: dois blocos, 25 e depois 10, e termina em 2 horas", () => {
    const p = planejarDisparo({ total: 35, abreEm: nov(2, 7), prazo: nov(4, 22), capacidade: 25, ...REGRA });

    expect(p.blocos).toEqual([
      { inicio: nov(2, 7), quantidade: 25 },
      { inicio: nov(2, 8), quantidade: 10 },
    ]);
    expect(p.terminaEm).toEqual(nov(2, 9));
    expect(p.horasNecessarias).toBe(2);
    expect(p.cabeNoPrazo).toBe(true);
  });

  it("não cria bloco vazio e a soma dos blocos é sempre o total", () => {
    const p = planejarDisparo({ total: 100, abreEm: nov(2, 7), prazo: nov(4, 22), capacidade: 25, ...REGRA });

    expect(p.blocos.map((b) => b.quantidade)).toEqual([25, 25, 25, 25]);
    expect(p.blocos.reduce((s, b) => s + b.quantidade, 0)).toBe(100);
  });

  it("quando a janela do dia fecha às 22h, o resto passa para as 7h do dia seguinte", () => {
    const p = planejarDisparo({ total: 60, abreEm: nov(2, 20), prazo: nov(4, 22), capacidade: 25, ...REGRA });

    expect(p.blocos).toEqual([
      { inicio: nov(2, 20), quantidade: 25 },
      { inicio: nov(2, 21), quantidade: 25 },
      { inicio: nov(3, 7), quantidade: 10 },
    ]);
  });

  it("não envia no domingo: sábado à noite passa direto para a segunda", () => {
    const sabadoNoite = new Date("2026-10-31T21:00:00-03:00");
    const p = planejarDisparo({ total: 60, abreEm: sabadoNoite, prazo: nov(4, 22), capacidade: 25, ...REGRA });

    expect(p.blocos).toEqual([
      { inicio: sabadoNoite, quantidade: 25 },
      { inicio: nov(2, 7), quantidade: 25 },
      { inicio: nov(2, 8), quantidade: 10 },
    ]);
  });

  it("1.500 voluntários não cabem num prazo curto, e o plano diz isso em vez de estourar o ritmo", () => {
    const p = planejarDisparo({ total: 1500, abreEm: nov(2, 7), prazo: nov(4, 22), capacidade: 25, ...REGRA });

    expect(p.horasNecessarias).toBe(60);
    expect(p.cabeNoPrazo).toBe(false);
    expect(Math.max(...p.blocos.map((b) => b.quantidade))).toBe(25);
    expect(p.terminaEm!.getTime()).toBeGreaterThan(nov(4, 22).getTime());
  });

  it("ninguém para avisar: sem blocos e sem fim", () => {
    const p = planejarDisparo({ total: 0, abreEm: nov(2, 7), prazo: nov(4, 22), capacidade: 25, ...REGRA });

    expect(p).toEqual({ blocos: [], terminaEm: null, horasNecessarias: 0, cabeNoPrazo: true });
  });

  it("capacidade inválida é recusada, e não vira laço infinito", () => {
    expect(() => planejarDisparo({ total: 10, abreEm: nov(2, 7), prazo: nov(4, 22), capacidade: 0, ...REGRA })).toThrow(/capacidade/);
  });
});
