import { describe, expect, it } from "vitest";

import {
  chaveDeApelido,
  datasDaLinha,
  lerEscalaDoLouvor,
  reconhecerNome,
  semelhanca,
  type BaseDeNomes,
} from "@/lib/escalas/louvor";

// A mensagem de outubro/2026 como a liderança colou na conversa — com os erros
// de digitação de verdade ("04/ 10", "Escaldo", parêntese sem fechar).
const OUTUBRO = `Escaldo do louvor mês de outubro

Cultos 04/ 10 e 08/10
Voz guia: Rhayssa celebração
Voz guia: Juan adoração
Back: Samily e Mara (JOsimaria
Bateria: Calebe
Baixo: Lucas Moura
Live: André
Sala pastoral:Juan e Juliana
Paleta de roupa: Marrom/ preto

Sala de oração 05/10
André/ Layla/ Mara
Bateria: Juan

Cultos 11/10 e 15/10
Voz guia: Naty (Nataliana) celebração
Vos guia: André adoração
Backs: Lê e Layla
Bateria: Erdrian
Baixo: Ervison
Teclado: Jaziel
Sala pastoral: André e Naty
Paleta de roupas: preto e branco`;

describe("lendo a mensagem do louvor", () => {
  const { blocos, ignoradas } = lerEscalaDoLouvor(OUTUBRO, "2026-10");

  it("acha os blocos e as datas, mesmo com '04/ 10'", () => {
    expect(blocos.map((b) => b.datas)).toEqual([
      ["2026-10-04", "2026-10-08"],
      ["2026-10-05"],
      ["2026-10-11", "2026-10-15"],
    ]);
    expect(blocos.map((b) => b.oracao)).toEqual([false, true, false]);
    expect(ignoradas).toEqual(["Escaldo do louvor mês de outubro"]);
  });

  it("separa a voz guia de celebração da de adoração", () => {
    const funcoes = blocos[0]!.itens.map((i) => i.funcao);
    expect(funcoes).toContain("Voz guia celebracao");
    expect(funcoes).toContain("Voz guia adoracao");
    const celebracao = blocos[0]!.itens.find((i) => i.funcao === "Voz guia celebracao")!;
    expect(celebracao.nomes).toEqual([{ digitado: "Rhayssa", dica: null }]);
  });

  it("aceita 'Vos guia' e 'Backs' como as funções de sempre", () => {
    const funcoes = blocos[2]!.itens.map((i) => i.funcao);
    expect(funcoes).toContain("Voz guia adoracao");
    expect(funcoes).toContain("Back");
  });

  it("parêntese vira dica, mesmo sem fechar", () => {
    const back = blocos[0]!.itens.find((i) => i.funcao === "Back")!;
    expect(back.nomes).toEqual([
      { digitado: "Samily", dica: null },
      { digitado: "Mara", dica: "JOsimaria" },
    ]);
  });

  it("na sala de oração, linha sem função são as vozes", () => {
    const oracao = blocos[1]!.itens.find((i) => i.funcao === "Sala de oracao")!;
    expect(oracao.nomes.map((n) => n.digitado)).toEqual(["André", "Layla", "Mara"]);
  });

  it("guarda a paleta da semana", () => {
    expect(blocos[0]!.paleta).toBe("Marrom / preto");
    expect(blocos[2]!.paleta).toBe("preto e branco");
  });
});

describe("datas", () => {
  it("dezembro falando de janeiro vira o ano", () => {
    expect(datasDaLinha("Cultos 04/01 e 08/01", "2026-12")).toEqual(["2027-01-04", "2027-01-08"]);
  });
  it("ano escrito vale", () => {
    expect(datasDaLinha("Culto 04/10/26", "2026-10")).toEqual(["2026-10-04"]);
  });
});

describe("reconhecendo os nomes", () => {
  const pessoas = [
    { id: "rh", nome: "Rhayssa Meira Pereira Santos" },
    { id: "lu", nome: "Lucas Borges Moura" },
    { id: "la", nome: "Lucas Alves Mendes" },
    { id: "jo", nome: "Josimária De Brito Fiuza" },
    { id: "na", nome: "Nataliana Mendes Da Silva Vieira" },
    { id: "ja", nome: "Jairlene Carvalho" },
    { id: "ev", nome: "Ervisson Santos Andrade" },
    { id: "b1", nome: "Bruno Moura" },
    { id: "b2", nome: "Bruno Santos De Souza" },
    { id: "s1", nome: "Samilly Pereira Dos Santos" },
  ];
  const base: BaseDeNomes = {
    pessoas,
    apelidos: new Map([
      [chaveDeApelido("Lê"), "ja"],
      [chaveDeApelido("Naty"), "na"],
      [chaveDeApelido("Mara"), "jo"],
    ]),
    doLouvor: new Set(["lu", "b1", "na", "ev"]),
  };

  it("apelido cadastrado, com e sem acento", () => {
    expect(reconhecerNome({ digitado: "Lê", dica: null }, base)).toMatchObject({ tipo: "certo", pessoa: { id: "ja" } });
    expect(reconhecerNome({ digitado: "Le", dica: null }, base)).toMatchObject({ tipo: "certo", pessoa: { id: "ja" } });
  });

  it("parte do nome: 'Lucas Moura' não é o Lucas da mídia", () => {
    expect(reconhecerNome({ digitado: "Lucas Moura", dica: null }, base)).toMatchObject({
      tipo: "certo",
      pessoa: { id: "lu" },
    });
  });

  it("primeiro nome repetido: quem é do louvor desempata", () => {
    expect(reconhecerNome({ digitado: "Bruno", dica: null }, base)).toMatchObject({ tipo: "certo", pessoa: { id: "b1" } });
  });

  it("grafia parecida vem como APROXIMADO, para a liderança confirmar", () => {
    expect(reconhecerNome({ digitado: "Rayssa", dica: null }, base)).toMatchObject({
      tipo: "aproximado",
      pessoa: { id: "rh" },
    });
    expect(reconhecerNome({ digitado: "Ervison", dica: null }, base)).toMatchObject({
      tipo: "aproximado",
      pessoa: { id: "ev" },
    });
    expect(reconhecerNome({ digitado: "Samily", dica: null }, base)).toMatchObject({
      tipo: "aproximado",
      pessoa: { id: "s1" },
    });
  });

  it("dois Brunos no histórico do louvor: o departamento decide", () => {
    const comHistoricoAmbiguo: BaseDeNomes = {
      ...base,
      doLouvor: new Set(["b1", "b2"]),
      doDepartamento: new Set(["b1"]),
    };
    expect(reconhecerNome({ digitado: "Bruno", dica: null }, comHistoricoAmbiguo)).toMatchObject({
      tipo: "certo",
      pessoa: { id: "b1" },
    });
    // Sem departamento para desempatar, não chuta.
    expect(reconhecerNome({ digitado: "Bruno", dica: null }, { ...comHistoricoAmbiguo, doDepartamento: new Set() }).tipo).toBe(
      "duvida",
    );
  });

  it("a dica entre parênteses vence", () => {
    expect(reconhecerNome({ digitado: "Mara", dica: "Josimaria" }, base)).toMatchObject({
      tipo: "certo",
      pessoa: { id: "jo" },
    });
  });

  it("nome que ninguém tem não vira chute", () => {
    expect(reconhecerNome({ digitado: "Zebedeu", dica: null }, base).tipo).toBe("desconhecido");
  });

  it("semelhança simétrica e em 0..1", () => {
    expect(semelhanca("rayssa", "rhayssa")).toBeCloseTo(semelhanca("rhayssa", "rayssa"));
    expect(semelhanca("abc", "abc")).toBe(1);
  });
});
