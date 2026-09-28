/**
 * Quais vagas existem num culto, e em que ORDEM elas escolhem.
 *
 * A ordem é a parte que não parece importar e importa: quem escolhe primeiro
 * leva os candidatos escassos. Auxílio Pastoral EXIGE casal, e o pool de casais
 * é raso — se a Cafeteria (que só PREFERE casal) escolher antes, ela leva o par
 * e o Auxílio Pastoral fica vazio.
 */
import type { Perfil, Setor, Subfuncao } from "./dominio";
import { chave } from "./normalizar";
import { dataDoRegistro } from "./rodada";
import type { RegistroHistorico } from "./dominio";

/** Uma vaga a preencher: setor, subfunção e quantas pessoas. */
export interface Vaga {
  setor: Setor;
  sub: Subfuncao;
  qtd: number;
}

function mediana(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  // `statistics.median` do Python devolve a média dos dois centrais em lista
  // par; o motor trunca com int(), então reproduzo os dois passos.
  const m = s.length % 2 ? s[meio]! : (s[meio - 1]! + s[meio]!) / 2;
  return Math.trunc(m);
}

/**
 * Por (dia da semana, setor): quantas pessoas e quais subfunções o histórico
 * recente mostra. Serve para setor ATIVO que a liderança não descreveu na
 * estrutura — ele entra pela mediana, sem subfunção.
 *
 * Setor que aparece em menos de dois cultos é descartado: é evento pontual
 * ("teve uma vez uma equipe de decoração no Natal"), não padrão.
 */
export function modeloDemanda(
  recentes: RegistroHistorico[],
): Map<string, { qtd: number; subs: string[] }> {
  const pessoas = new Map<string, Map<string, Set<string>>>();
  const subs = new Map<string, Map<string, number>>();

  for (const r of recentes) {
    const k = chave(r.diaSemana, r.setor);
    const porCulto = pessoas.get(k) ?? new Map<string, Set<string>>();
    // O culto é identificado por competência + dia, como no Python (aba, ano,
    // mes, dia). Registro sem dia agrupa por mês, que é o comportamento atual.
    const culto = chave(r.ano, r.mes, r.dia);
    const s = porCulto.get(culto) ?? new Set<string>();
    s.add(r.nome);
    porCulto.set(culto, s);
    pessoas.set(k, porCulto);

    if (r.subfuncao) {
      const cont = subs.get(k) ?? new Map<string, number>();
      cont.set(r.subfuncao, (cont.get(r.subfuncao) ?? 0) + 1);
      subs.set(k, cont);
    }
  }

  const demanda = new Map<string, { qtd: number; subs: string[] }>();
  for (const [k, cultos] of pessoas) {
    if (cultos.size < 2) continue;
    const tamanhos = [...cultos.values()].map((v) => v.size);
    const maisComuns = [...(subs.get(k) ?? new Map<string, number>())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nome]) => nome);
    demanda.set(k, { qtd: mediana(tamanhos), subs: maisComuns });
  }
  return demanda;
}

/**
 * As vagas do culto, já na ordem em que devem escolher.
 *
 * Três níveis, e o motivo de cada um:
 *  0. setor que EXIGE casal — o pool de casais é raso e qualquer setor que só
 *     prefere casal rouba o par antes;
 *  1. preferência por casal, elenco fechado (`timeFixo`) e pool pequeno — todos
 *     têm poucos candidatos possíveis;
 *  2. o resto.
 * Dentro do nível, o mais apertado primeiro (menos gente disponível).
 *
 * A ordenação é estável, então a ordem das subfunções declarada na estrutura
 * sobrevive: Kids Sala Maior escolhe antes de Sala Menor, que é o que a
 * liderança pediu ao dizer que a sala maior leva o professor mais maduro.
 */
export function vagasDoCulto(
  diaSemana: string,
  setores: Setor[],
  demanda: Map<string, { qtd: number; subs: string[] }>,
  perfis: Map<string, Perfil>,
  desligados: Map<string, string>,
): Vaga[] {
  const daEstrutura = setores.filter((s) => !s.externo);
  const porNome = new Map(setores.map((s) => [s.nome, s]));

  // Soma, não duplica: o reforço pode pedir uma vaga que já existe na estrutura.
  const somadas = new Map<string, { setor: Setor; sub: Subfuncao; qtd: number }>();
  const juntar = (setor: Setor, sub: Subfuncao, qtd: number) => {
    const k = chave(setor.nome, sub.nome);
    const atual = somadas.get(k);
    somadas.set(k, { setor, sub, qtd: (atual?.qtd ?? 0) + qtd });
  };

  for (const setor of daEstrutura) {
    for (const sub of setor.subfuncoes) {
      juntar(setor, sub, sub.qtdPorDia[diaSemana] ?? sub.qtd);
    }
  }

  // Setor OFF empurra a equipe dele para outra vaga: sem cozinha na quinta, a
  // Recepção recebe quatro pessoas a mais em vez de a equipe ficar em casa.
  for (const nomeOff of desligados.keys()) {
    const setorOff = porNome.get(nomeOff);
    for (const ref of setorOff?.reforcoSeOff ?? []) {
      const alvo = porNome.get(ref.setor);
      const sub = alvo?.subfuncoes.find((x) => x.nome === ref.subfuncao);
      if (alvo && sub) juntar(alvo, sub, ref.qtd);
    }
  }

  // Setor ativo fora da estrutura entra pela mediana do histórico, sem subfunção.
  const nomesDefinidos = new Set(daEstrutura.map((s) => s.nome));
  for (const [k, { qtd }] of demanda) {
    const [dia, nomeSetor] = JSON.parse(k) as [string, string];
    if (dia !== diaSemana || nomesDefinidos.has(nomeSetor)) continue;
    const setor = porNome.get(nomeSetor);
    if (!setor || setor.externo) continue;
    const sub: Subfuncao = {
      nome: "",
      qtd,
      qtdPorDia: {},
      timeFixo: [],
      prioridade: [],
      poolExtra: [],
      porFrequencia: false,
      maxDoGrupo: null,
      duplaDecente: false,
      casalJunto: false,
      mesmoSexoQue: null,
      conjugeDe: null,
    };
    juntar(setor, sub, qtd);
  }

  // "Escolhe cedo" é propriedade do SETOR, não da subfunção: preferência por
  // casal, pool pequeno, e as duas pontas da regra de cônjuge (a vaga que recebe
  // o cônjuge e a vaga de onde ele vem). Uma subfunção que só PREFERE casal
  // — Boas Vindas / Máquina de Cartão — NÃO entra: ela não esvazia o pool de
  // casais, e adiantá-la faz Boas Vindas levar o par antes da Intercessão, que
  // foi exatamente a divergência medida contra o motor original.
  const setoresCedo = new Set<string>();
  for (const s of setores) {
    if (s.casalJunto || s.poolPequeno) setoresCedo.add(s.nome);
    for (const sub of s.subfuncoes) {
      if (sub.conjugeDe) {
        setoresCedo.add(s.nome);
        setoresCedo.add(sub.conjugeDe[0]);
      }
    }
  }

  const lista = [...somadas.values()];
  const comOrdem = lista.map((v) => {
    const elenco = v.sub.timeFixo.length > 0 ? v.sub.timeFixo : null;
    const disponivel = elenco
      ? elenco.length
      : [...perfis.values()].filter((d) => (d.setores.get(v.setor.nome) ?? 0) > 0).length;
    const nivel = v.setor.soCasal ? 0 : setoresCedo.has(v.setor.nome) || elenco ? 1 : 2;
    return { v, k: [nivel, disponivel] as [number, number] };
  });
  comOrdem.sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1]);
  return comOrdem.map(({ v }) => ({ setor: v.setor, sub: v.sub, qtd: v.qtd }));
}

export { dataDoRegistro };
