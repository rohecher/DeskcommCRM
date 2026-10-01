/**
 * O MÊS como unidade da tela de escalas.
 *
 * A liderança monta, confere e divulga a escala mês a mês ("a escala de
 * outubro"). A tela antiga listava todos os cultos do mais recente para trás, e
 * o culto de hoje ficava perdido no fim da lista. Aqui mora o que a tela mensal
 * precisa e que não depende de banco — por isso é testável sem Supabase.
 *
 * Datas são tratadas como TEXTO (`2026-10-01`), nunca como `Date` local: o
 * servidor roda em UTC e a igreja em America/Sao_Paulo, e `new Date("2026-10-01")`
 * vira 30/09 às 21h no Brasil. Uma escala mostrada no dia errado é pior que
 * nenhuma.
 */
import { diaBonito } from "./formato";

/** `2026-10`. */
export type Mes = string;

const FUSO_DA_IGREJA = "America/Sao_Paulo";

/** Hoje na igreja, como `AAAA-MM-DD` — e não no relógio do servidor. */
export function hojeIso(agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_IGREJA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function mesValido(texto: string | null | undefined): texto is Mes {
  return typeof texto === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);
}

function partes(mes: Mes): [number, number] {
  const [a, m] = mes.split("-");
  return [Number(a), Number(m)];
}

function mesDe(ano: number, mes: number): Mes {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function mesAnterior(mes: Mes): Mes {
  const [a, m] = partes(mes);
  return m === 1 ? mesDe(a - 1, 12) : mesDe(a, m - 1);
}

export function mesSeguinte(mes: Mes): Mes {
  const [a, m] = partes(mes);
  return m === 12 ? mesDe(a + 1, 1) : mesDe(a, m + 1);
}

/** Primeiro e último dia do mês, para o filtro `data between`. */
export function limitesDoMes(mes: Mes): { inicio: string; fim: string } {
  const [a, m] = partes(mes);
  // Dia 0 do mês seguinte = último dia deste. UTC para não depender do fuso.
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

const NOMES_DOS_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** `2026-10` → `Outubro de 2026`. */
export function nomeDoMes(mes: Mes): string {
  const [a, m] = partes(mes);
  return `${NOMES_DOS_MESES[m - 1] ?? m} de ${a}`;
}

/**
 * Culto ou encontro só do louvor.
 *
 * As salas de oração de segunda chegam pela escala do louvor e viram um "culto"
 * em que TODA vaga é de departamento externo. Elas existem e o louvor precisa
 * vê-las, mas não são culto: não têm atalaia, recepção nem cozinha, e mostrá-las
 * como culto com "4 vagas" fazia parecer que faltava gente.
 */
export type TipoDeCulto = "culto" | "oracao";

export function tipoDoCulto(origens: readonly string[]): TipoDeCulto {
  return origens.length > 0 && origens.every((o) => o === "externo") ? "oracao" : "culto";
}

/**
 * O nome com que a igreja chama cada culto. É o que aparece no cabeçalho do card;
 * o dia da semana sozinho ("Quinta") não diz qual encontro é.
 */
const NOME_DO_CULTO: Record<string, string> = {
  QUINTA: "Quinta Profética",
  DOMINGO: "Domingo de Celebração",
};

export function nomeDoCulto(diaSemana: string, tipo: TipoDeCulto): string {
  if (tipo === "oracao") return "Sala de Oração";
  return NOME_DO_CULTO[diaSemana] ?? diaBonito(diaSemana);
}

/** Vaga mínima que a tabela precisa saber de cada culto. */
export interface VagaDaTabela {
  setor: string;
  setorPosicao: number;
  subfuncao: string;
  posicao: number;
}

export interface LinhaDaTabela {
  /** `SETOR|Subfunção|n` — a n-ésima vaga daquela função no culto. */
  chave: string;
  setor: string;
  subfuncao: string;
}

/** A chave de cada vaga de um culto, na ordem recebida. */
export function chavesDoCulto(vagas: readonly VagaDaTabela[]): string[] {
  const vistos = new Map<string, number>();
  return vagas.map((v) => {
    const base = `${v.setor}|${v.subfuncao}`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return `${base}|${n}`;
  });
}

/**
 * As linhas da visão em tabela: a união das vagas de todos os cultos do mês.
 *
 * Domingo tem 4 na recepção e quinta tem 3; a quarta linha da recepção existe na
 * tabela e fica vazia na quinta. Sem a união, a tabela teria de escolher um
 * culto como molde e esconderia a vaga extra dos outros.
 */
export function linhasDaTabela(cultos: readonly (readonly VagaDaTabela[])[]): LinhaDaTabela[] {
  const linhas = new Map<string, LinhaDaTabela & { ordem: [number, number] }>();
  for (const vagas of cultos) {
    const chaves = chavesDoCulto(vagas);
    vagas.forEach((v, i) => {
      const chave = chaves[i]!;
      const ordem: [number, number] = [v.setorPosicao, v.posicao];
      const atual = linhas.get(chave);
      if (!atual) {
        linhas.set(chave, { chave, setor: v.setor, subfuncao: v.subfuncao, ordem });
      } else if (ordem[0] < atual.ordem[0] || (ordem[0] === atual.ordem[0] && ordem[1] < atual.ordem[1])) {
        atual.ordem = ordem;
      }
    });
  }
  return [...linhas.values()]
    .sort((a, b) => a.ordem[0] - b.ordem[0] || a.ordem[1] - b.ordem[1] || a.chave.localeCompare(b.chave))
    .map(({ chave, setor, subfuncao }) => ({ chave, setor, subfuncao }));
}
