/**
 * A nota do candidato.
 *
 * Rodízio pesa mais que afinidade: `descanso * pesoRodizio` (3x) contra
 * `afinidade * 2`. A liderança escala quem está descansado, não quem tem mais
 * histórico no setor — a primeira versão do motor ordenava por afinidade e
 * devolvia a mesma equipe todo culto.
 *
 * O termo de liderança é NEGATIVO (`pesoLider = -1`), e isso foi corrigido
 * depois de eu ter feito o contrário. Nas palavras da liderança: "mesmo sendo
 * líder a regra é gerenciar a equipe, não servir mais que todos; o líder entra
 * meio como socorro". Ele já está presente no culto; escalá-lo numa vaga tira o
 * lugar de quem precisa servir.
 */
import type { Config, Perfil } from "./dominio";
import { chave } from "./normalizar";
import { diasEntre } from "./rodada";

export interface ContextoNota {
  setor: string;
  subfuncao: string;
  diaSemana: string;
  dataIso: string;
  /** Setor de origem da pessoa, já traduzido. */
  casa: string;
  cargaMes: Map<string, number>;
  casais: Map<string, string>;
  /** Quem já foi escalado NESTE culto. */
  usados: Set<string>;
  /** Quem lidera este setor. */
  lideres: Set<string>;
  config: Config;
}

export function nota(nome: string, d: Perfil, ctx: ContextoNota): number {
  const { setor, subfuncao, diaSemana, dataIso, casa, cargaMes, casais, usados, lideres, config } =
    ctx;

  const noSetor = d.setores.get(setor) ?? 0;
  const noSub = subfuncao ? (d.subs.get(setor)?.get(subfuncao) ?? 0) : 0;

  const afinidade = d.total ? noSetor / d.total : 0;
  const experiencia = Math.min(noSetor, 30) / 30;
  const especialista = Math.min(noSub, 10) / 10;
  const noDia = ((d.dias.get(diaSemana) ?? 0) + 1) / (d.total + 1);
  const conjuge = casais.get(nome);
  const junto = conjuge !== undefined && usados.has(conjuge) ? 1 : 0;
  const emCasa = casa && casa === setor ? config.bonusCasa : 0;
  const lider = lideres.has(nome) ? config.pesoLider : 0;

  // Descanso: metade "quanto tempo faz que não serve" (satura em 2 meses),
  // metade "quantos cultos pegou no mês". As duas metades são necessárias —
  // só a data ignora quem serviu três vezes na semana passada, e só a
  // contagem ignora quem está parado há meses.
  let folga = 0;
  if (d.ultimaData) {
    const semanas = diasEntre(dataIso, d.ultimaData) / 7;
    folga = Math.min(Math.max(semanas, 0), 8) / 8;
  }
  const descanso = (folga + 1 / (1 + (cargaMes.get(nome) ?? 0))) / 2;

  return (
    afinidade * 2 +
    experiencia +
    especialista * 2 +
    noDia +
    descanso * config.pesoRodizio +
    junto +
    emCasa +
    lider
  );
}

/**
 * Compara duas chaves de ordenação elemento a elemento, como o Python compara
 * tuplas. `false < true`, números por valor.
 *
 * Existe porque `gerar()` ordena por uma tupla mista (booleano, booleano,
 * número negativo, número) e reproduzir isso com subtração de números perde os
 * booleanos.
 */
export type ChaveOrdem = (boolean | number)[];

export function comparaChave(a: ChaveOrdem, b: ChaveOrdem): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const x = typeof a[i] === "boolean" ? (a[i] ? 1 : 0) : (a[i] as number);
    const y = typeof b[i] === "boolean" ? (b[i] ? 1 : 0) : (b[i] as number);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Ordena DECRESCENTE e de forma ESTÁVEL, como `list.sort(key=…, reverse=True)`.
 *
 * O detalhe que engana: em Python, `reverse=True` NÃO inverte a ordem dos
 * empatados — a ordenação continua estável e quem veio primeiro continua
 * primeiro. `Array.prototype.sort` também é estável (ES2019), então inverter o
 * comparador dá o mesmo resultado. Reverter a lista depois de ordenar, não.
 */
export function ordenarDesc<T>(itens: T[], chaveDe: (x: T) => ChaveOrdem): T[] {
  const comChave = itens.map((x) => ({ x, k: chaveDe(x) }));
  comChave.sort((p, q) => comparaChave(q.k, p.k));
  return comChave.map((p) => p.x);
}

export { chave };
