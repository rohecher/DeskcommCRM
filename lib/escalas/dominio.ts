/**
 * As estruturas que o motor de escalas recebe e devolve.
 *
 * Tudo aqui é dado em memória: o motor é função pura. Quem lê do Postgres é
 * `repo.ts`, quem lê dos JSON do lado Python é o teste de paridade, e nenhum dos
 * dois aparece na assinatura de `gerar()`. Foi assim que deu para provar o porte
 * contra o motor original sem subir banco nenhum.
 */
import type { OrigemSlot, SexoVoluntario, StatusVoluntario } from "./tipos";

/** Índice 0 = segunda, igual a `DIA_SEMANA` do Python e a `Date.getDay()-1`. */
export const DIA_SEMANA = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
] as const;
export type DiaSemana = (typeof DIA_SEMANA)[number];

/**
 * Uma linha do histórico: alguém serviu naquele setor naquela competência.
 *
 * `dia` é null quando a planilha não dizia o dia — ou dizia um que não existe
 * (a aba FEVEREIRO 2026 produziu 84 registros em 29, 30 e 31 de fevereiro).
 * Registro sem dia conta para afinidade, experiência e dia da semana; não conta
 * para carga por período nem para rodada, porque não há data a comparar.
 */
export interface RegistroHistorico {
  nome: string;
  ano: number;
  mes: number;
  dia: number | null;
  diaSemana: string;
  setor: string;
  subfuncao: string;
}

/** Uma vaga já ocupada em escala montada por outro departamento (louvor, mídia, dança). */
export interface RegistroExterno {
  /** ISO `2026-09-20`. */
  data: string;
  nome: string;
}

/** O que a liderança declarou sobre a disponibilidade de uma pessoa. */
export interface RegraVoluntario {
  status: StatusVoluntario | string;
  /** Setor de origem. Se for departamento externo, a pessoa sai do rodízio geral. */
  departamento: string;
  /** Vazio = serve em qualquer dia de culto. */
  dias: string[];
  /** Normalizados (`norm`). */
  bloqueados: string[];
  /** Normalizados. Não vazio = serve SÓ nesses. */
  permitidos: string[];
  /** ISO, ou vazio. Só vale quando os dois estão preenchidos. */
  de: string;
  ate: string;
  /** Teto de cultos no mês. null = usa o teto global. */
  max: number | null;
}

/**
 * O que o histórico diz sobre uma pessoa. É daqui que sai a nota.
 *
 * Os `Map` são contadores: ausência de chave é zero, como o `Counter` do Python.
 */
export interface Perfil {
  /** setor → vezes que serviu nele. */
  setores: Map<string, number>;
  /** dia da semana → vezes. */
  dias: Map<string, number>;
  /** setor → (subfunção → vezes). */
  subs: Map<string, Map<string, number>>;
  /** Competência mais recente [ano, mes], ou null. */
  ultima: [number, number] | null;
  /** Data exata mais recente (ISO), ou null. É o termo de descanso. */
  ultimaData: string | null;
  total: number;
  /** Quantos registros caem na janela de meses recentes. */
  recente: number;
}

/** Uma subfunção da estrutura, com as regras que valem só nela. */
export interface Subfuncao {
  nome: string;
  qtd: number;
  qtdPorDia: Record<string, number>;
  timeFixo: string[];
  prioridade: string[];
  poolExtra: string[];
  porFrequencia: boolean;
  maxDoGrupo: number | null;
  duplaDecente: boolean;
  casalJunto: boolean;
  /** [setor, subfunção] da vaga espelhada. */
  mesmoSexoQue: [string, string] | null;
  conjugeDe: [string, string] | null;
}

export interface Setor {
  nome: string;
  posicao: number;
  nucleo: boolean;
  duplaDecente: boolean;
  casalJunto: boolean;
  soCasal: boolean;
  poolPequeno: boolean;
  /** Escala montada pelo próprio departamento: o motor nunca gera. */
  externo: boolean;
  rodizioInversoQuinta: boolean;
  reforcoSeOff: { setor: string; subfuncao: string; qtd: number }[];
  subfuncoes: Subfuncao[];
}

/** Pesos e tetos. Os nomes espelham as constantes do Python. */
export interface Config {
  maxPadrao: number;
  pesoRodizio: number;
  bonusCasa: number;
  pesoLider: number;
  papelLideranca: string;
  semanasDescanso: number;
  quintaAposDomingo: number;
  reservaMaxNoMes: number;
  mesesRecentes: number;
  horario: Record<string, string>;
  /** Departamentos cuja escala vem de fora; quem é deles sai do rodízio geral. */
  deptoExterno: string[];
  /** "KIDS" → "CULTO KIDS": como a pessoa escreve o departamento vs. o setor. */
  deptoApelido: Record<string, string>;
}

/** Tudo que `gerar()` precisa saber antes de montar um culto. */
export interface EntradaMotor {
  config: Config;
  setores: Setor[];
  /** Nome → regras. Quem não está aqui está ativo e sem restrição. */
  regras: Map<string, RegraVoluntario>;
  /** Nome → perfil, na ORDEM em que o histórico apresentou as pessoas (ver `gerar`). */
  perfis: Map<string, Perfil>;
  /** Nome → cônjuge, nos dois sentidos. Só pares confirmados. */
  casais: Map<string, string>;
  /** Nome → M/F. */
  sexo: Map<string, SexoVoluntario>;
  /** Setor → quem lidera (só papel que começa com `papelLideranca`). */
  lideres: Map<string, Set<string>>;
  historico: RegistroHistorico[];
  externa: RegistroExterno[];
  /**
   * `chave(diaSemana, setor)` → quantas pessoas e quais subfunções o histórico
   * recente mostra. Só serve para setor ativo que não está na estrutura.
   */
  demanda: Map<string, { qtd: number; subs: string[] }>;
  /**
   * Data ISO → quem já está ocupado em escala montada por fora naquele culto.
   * Louvor tem prioridade sobre qualquer outra escala: quem toca no domingo não
   * é escalado para servir no mesmo culto.
   */
  ocupados: Map<string, Set<string>>;
  /**
   * Quem só entra quando está leve no mês. Set próprio, e não um campo da regra,
   * porque no motor `RESERVA` é uma lista à parte: a pessoa pode não ter linha
   * de disponibilidade nenhuma e ainda assim ser reserva.
   */
  reserva: Set<string>;
  /** `chave(dataIso, setor)` → nomes vetados naquele setor naquele culto. */
  rejeitados: Map<string, Set<string>>;
  /** `chave(dataIso, setor, subfuncao)` → nomes cravados à mão. */
  fixados: Map<string, string[]>;
  /** `chave(dataIso)` → (setor → motivo) dos setores desligados no culto. */
  setoresOff: Map<string, Map<string, string>>;
}

/** Uma linha da escala gerada. Espelha a lista de 7 posições do Python. */
export interface LinhaEscala {
  data: string;
  diaSemana: string;
  setor: string;
  subfuncao: string;
  /** Vazio = vaga aberta, publicada assim de propósito. */
  nome: string;
  /** "3x no setor" — o que a liderança lê para conferir a escolha. */
  historico: string;
  /** "casal", "repetido-sem-folga", "OFF - motivo", ou o motivo da vaga vazia. */
  obs: string;
}

export interface Falta {
  vaga: string;
  quantas: number;
  motivo: string;
}

export interface ResultadoCulto {
  data: string;
  escala: LinhaEscala[];
  faltas: Falta[];
}

/** Estado que atravessa os cultos de um mesmo lote. Ver `gerarLote`. */
export interface EstadoLote {
  /** Nome → cultos no mês alvo. Cresce conforme o lote é gerado. */
  cargaMes: Map<string, number>;
  /** Nome → cultos na janela de descanso. */
  cargaPeriodo: Map<string, number>;
  /** `chave(nome, setor, subfuncao)` → vezes naquela vaga na janela. */
  naVaga: Map<string, number>;
  /** Domingo da rodada (ISO) → quem serviu nela. */
  rodadas: Map<string, Set<string>>;
  /** `chave(domingoIso, setor, subfuncao)` → nomes do domingo. */
  vagasDomingo: Map<string, string[]>;
  /** `chave(domingoIso, setor)` → equipe do setor naquele domingo. */
  equipeDomingo: Map<string, string[]>;
}

export type { OrigemSlot, SexoVoluntario, StatusVoluntario };
