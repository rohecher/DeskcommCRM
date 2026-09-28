/**
 * PARIDADE: o motor de escalas em TypeScript decide igual ao motor Python.
 *
 * O motor original (`motor/gerar.py`, 1030 linhas) foi ensinado pela liderança da
 * igreja ao longo de dezenas de correções, uma escala errada por vez: "a equipe
 * que serve no domingo serve na quinta", "mesmo sendo líder a regra é gerenciar,
 * não servir mais que todos", "auxiliar pastores é casal homem e mulher, não pode
 * dois homens", "o rodízio não é trazer gente nova, é entre quem já foi escolhido
 * no domingo". Cada uma dessas frases é uma linha de código em algum lugar.
 *
 * Um porte que "faz sentido" mas decide diferente não é um porte: é um motor novo
 * com bugs novos, e os bugs aparecem como a pessoa errada escalada num culto —
 * meses depois, sem nada apontar para cá. Por isso o critério é IGUALDADE
 * ESTRITA, e não "parecido": mesma vaga, mesmo nome, mesma ordem, mesma
 * observação, nas dez escalas que a liderança aprovou e divulgou (13/09 a 15/10).
 *
 * ═══ COMO O FIXTURE NASCE ═══
 *
 *   python motor/paridade.py <as dez datas> --hoje 2026-09-21 --out motor/esperado.json
 *   python motor/fixture_paridade.py tests/fixtures/escalas
 *
 * `paridade.py` importa `gerar.py` e chama o `gerar()` DELE — não é uma segunda
 * implementação. `--hoje` é fixo porque a janela de meses recentes depende da
 * data de execução, e um teste que muda de resposta sozinho não prova nada.
 *
 * Os nomes no fixture são pseudônimos ("Voluntario 001"), e isso tem dois
 * motivos. O primeiro é que commit é para sempre e a lista nominal dos membros da
 * igreja com telefone não tem por que morar num repositório. O segundo é que a
 * pseudonimização é ELA MESMA uma prova: o resultado com pseudônimos é igual ao
 * resultado com os nomes reais, o que só acontece se nenhuma decisão do motor
 * depender do texto do nome — nenhuma ordem alfabética escondida, nenhum
 * desempate por string. Quem tem a planilha roda a mesma comparação com os nomes
 * de verdade.
 *
 * ═══ SE ESTE TESTE FALHAR ═══
 *
 * Não ajuste o esperado. Ou o motor TypeScript regrediu, ou alguém mudou uma
 * regra de negócio — e nesse caso a mudança precisa ser feita nos DOIS motores e
 * o fixture regerado de propósito, com a escala nova conferida por quem monta a
 * escala na igreja.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { montarMotor, type DadosJson, type RegrasJson } from "@/lib/escalas/de-json";
import { gerarLote } from "@/lib/escalas/gerar";
import type { LinhaEscala } from "@/lib/escalas/dominio";

const DIR = path.join(process.cwd(), "tests/fixtures/escalas");

function ler<T>(arquivo: string): T {
  return JSON.parse(readFileSync(path.join(DIR, arquivo), "utf8")) as T;
}

interface Esperado {
  hoje: string;
  datas: string[];
  linhas: {
    data: string;
    dia_semana: string;
    setor: string;
    subfuncao: string;
    nome: string;
    historico: string;
    obs: string;
  }[];
  faltas: { data: string; vaga: string; quantas: number; motivo: string }[];
}

const regras = ler<RegrasJson>("regras.json");
const dados = ler<DadosJson>("dados.json");
const esperado = ler<Esperado>("esperado.json");

/** Uma linha em texto, para o diff do vitest apontar a vaga e não um índice. */
function linha(l: {
  data: string;
  setor: string;
  subfuncao: string;
  nome: string;
  obs: string;
}): string {
  return `${l.data} ${l.setor} / ${l.subfuncao || "-"} = ${l.nome || "(vaga aberta)"}${
    l.obs ? ` [${l.obs}]` : ""
  }`;
}

function gerar(): LinhaEscala[] {
  const { entrada, estado } = montarMotor(regras, dados, esperado.datas, esperado.hoje);
  return gerarLote(esperado.datas, entrada, estado).flatMap((c) => c.escala);
}

describe("motor de escalas — paridade com o motor Python", () => {
  const obtido = gerar();

  it("gera a mesma escala, linha por linha, nas dez datas aprovadas", () => {
    expect(obtido.map(linha)).toEqual(esperado.linhas.map(linha));
  });

  it("mantém as vagas abertas que o motor deixou abertas", () => {
    // Vaga sem nome é PUBLICADA de propósito — a liderança pediu que o setor
    // apareça com a linha vazia para as pessoas verem que falta gente. Um porte
    // que "conserta" isso preenchendo a vaga quebra o pedido em silêncio.
    const vaziasEsperadas = esperado.linhas.filter((l) => !l.nome).map(linha);
    const vaziasObtidas = obtido.filter((l) => !l.nome).map(linha);
    expect(vaziasObtidas).toEqual(vaziasEsperadas);
  });

  it("marca as mesmas duplas de casal", () => {
    const casaisEsperados = esperado.linhas.filter((l) => l.obs.includes("casal")).map(linha);
    const casaisObtidos = obtido.filter((l) => l.obs.includes("casal")).map(linha);
    expect(casaisObtidos).toEqual(casaisEsperados);
  });

  it("é determinístico: rodar duas vezes dá a mesma escala", () => {
    // O motor lê Map com ordem de inserção e ordena de forma estável. Se algum
    // ponto passasse a depender de iteração de Set não determinística ou de
    // `Date.now()`, apareceria aqui antes de aparecer numa escala divulgada.
    expect(gerar().map(linha)).toEqual(obtido.map(linha));
  });

  it("respeita o setor desligado no culto (17/09 sem Auxílio Pastoral)", () => {
    // Âncora de uma regra específica que a liderança ensinou pelo nome: "esqueci
    // que não vai ter cozinha e mesa dia 17/09" e o Auxílio Pastoral daquela
    // quinta. Se o OFF parar de funcionar, o teste acima já falha — mas falha
    // como "uma das 324 linhas mudou", e este diz o que quebrou.
    const off = obtido.filter((l) => l.data === "2026-09-17" && l.obs.startsWith("OFF"));
    expect(off.length).toBeGreaterThan(0);
    expect(off.every((l) => l.nome === "")).toBe(true);
  });
});
