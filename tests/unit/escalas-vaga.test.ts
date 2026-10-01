import { describe, expect, it } from "vitest";

import type { Config, RegraVoluntario } from "@/lib/escalas/dominio";
import { candidatosDaVaga, legivel, type EntradaDaVaga } from "@/lib/escalas/vaga";

const config = {
  deptoExterno: ["LOUVOR", "M. LOUVOR", "MIDIA", "DANCA"],
} as unknown as Config;

function regra(p: Partial<RegraVoluntario> = {}): RegraVoluntario {
  return { status: "ATIVO", departamento: "", dias: [], bloqueados: [], permitidos: [], de: "", ate: "", max: null, ...p };
}

const pessoas = ["Ana", "Bia", "Caio", "Davi", "Eva", "Fabio", "Gil", "Hugo"].map((nome, i) => ({
  id: `id-${i}`,
  nome,
}));

function entrada(p: Partial<EntradaDaVaga> = {}): EntradaDaVaga {
  return {
    setor: "CAFETERIA",
    diaSemana: "QUINTA",
    dataIso: "2026-10-08",
    voluntarios: pessoas,
    regras: new Map(pessoas.map((v) => [v.nome, regra()])),
    config,
    ocupados: new Map(),
    timeFixo: [],
    exigeDecencia: false,
    parceiros: [],
    sexo: new Map(),
    casais: new Map(),
    experiencia: new Map(),
    atual: null,
    ...p,
  };
}

const nomes = (l: { nome: string }[]) => l.map((c) => c.nome);

describe("quem pode ocupar a vaga", () => {
  it("quem já está em outra vaga do mesmo culto não pode — com o lugar no motivo", () => {
    const r = candidatosDaVaga(entrada({ ocupados: new Map([["Ana", "Recepção (boas-vindas)"]]) }));
    expect(nomes(r.pode)).not.toContain("Ana");
    expect(r.naoPode.find((c) => c.nome === "Ana")?.motivo).toBe("já está em Recepção (boas-vindas) neste culto");
  });

  it("aplica as regras do motor: ausência, dia, setor, louvor", () => {
    const regras = new Map(pessoas.map((v) => [v.nome, regra()]));
    regras.set("Bia", regra({ de: "2026-10-02", ate: "2026-11-15" }));
    regras.set("Caio", regra({ dias: ["DOMINGO"] }));
    regras.set("Davi", regra({ bloqueados: ["CAFETERIA"] }));
    regras.set("Eva", regra({ departamento: "LOUVOR" }));
    regras.set("Fabio", regra({ permitidos: ["MESA DA COMUNHAO"] }));
    const r = candidatosDaVaga(entrada({ regras }));
    const motivo = (n: string) => r.naoPode.find((c) => c.nome === n)?.motivo;
    expect(motivo("Bia")).toBe("ausente até 15/11/2026");
    expect(motivo("Caio")).toBe("só serve domingo");
    expect(motivo("Davi")).toBe("não serve neste setor");
    expect(motivo("Eva")).toBe("do louvor (escala própria)");
    expect(motivo("Fabio")).toBe("só serve em mesa da comunhão");
    expect(nomes(r.pode)).toEqual(["Ana", "Gil", "Hugo"]);
  });

  it("inativo some da lista; suspenso aparece com o motivo", () => {
    const regras = new Map(pessoas.map((v) => [v.nome, regra()]));
    regras.set("Gil", regra({ status: "INATIVO" }));
    regras.set("Hugo", regra({ status: "SUSPENSO" }));
    const r = candidatosDaVaga(entrada({ regras }));
    const todos = [...r.pode, ...r.comAviso, ...r.naoPode].map((c) => c.nome);
    expect(todos).not.toContain("Gil");
    expect(r.naoPode.find((c) => c.nome === "Hugo")?.motivo).toBe("suspenso");
  });

  it("quem está na vaga agora não aparece como opção", () => {
    expect(nomes(candidatosDaVaga(entrada({ atual: "Ana" })).pode)).not.toContain("Ana");
  });

  it("fora do time fixo pode, mas com aviso", () => {
    const r = candidatosDaVaga(entrada({ timeFixo: ["Ana", "Bia"] }));
    expect(nomes(r.pode)).toEqual(["Ana", "Bia"]);
    expect(r.comAviso.find((c) => c.nome === "Caio")?.motivo).toBe("fora do time fixo desta função");
  });

  it("dupla isolada: homem e mulher só sem aviso se forem casados", () => {
    const sexo = new Map([
      ["Ana", "F"],
      ["Caio", "M"],
      ["Davi", "M"],
      ["Bia", "F"],
    ]);
    const casais = new Map([
      ["Ana", "Davi"],
      ["Davi", "Ana"],
    ]);
    const r = candidatosDaVaga(
      entrada({ exigeDecencia: true, parceiros: ["Ana"], ocupados: new Map([["Ana", "Cafeteria"]]), sexo, casais }),
    );
    expect(nomes(r.pode)).toContain("Davi"); // marido
    expect(nomes(r.pode)).toContain("Bia"); // mesmo sexo
    expect(r.comAviso.find((c) => c.nome === "Caio")?.motivo).toBe(
      "ficaria em dupla com Ana, sem serem casados",
    );
  });

  it("ordena quem pode por experiência no setor, depois pelo nome", () => {
    const r = candidatosDaVaga(
      entrada({
        experiencia: new Map([
          ["Hugo", 12],
          ["Caio", 3],
        ]),
      }),
    );
    expect(nomes(r.pode).slice(0, 3)).toEqual(["Hugo", "Caio", "Ana"]);
  });
});

describe("legivel", () => {
  it("traduz o motivo do motor para a tela", () => {
    expect(legivel("ausente ate 2026-11-15")).toBe("ausente até 15/11/2026");
    expect(legivel("time de m. louvor")).toBe("do louvor (escala própria)");
    expect(legivel("time de som")).toBe("do som (escala própria)");
    expect(legivel("so serve em culto kids/mesa da comunhao")).toBe(
      "só serve em culto kids ou mesa da comunhão",
    );
  });
});
