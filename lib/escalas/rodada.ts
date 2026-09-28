/**
 * RODADA: domingo + a quinta seguinte são a MESMA equipe.
 *
 * Isso não é convenção, é o que o histórico diz — medido em 50 pares: domingo →
 * quinta seguinte repete 85% da equipe; rodada → rodada seguinte repete 30%;
 * rodada → duas rodadas depois, 66%. São duas equipes se alternando, com um
 * núcleo fixo. A primeira versão do motor tinha uma regra de descanso que
 * PROIBIA quem serviu no domingo de servir na quinta — o oposto exato de como a
 * igreja funciona.
 *
 * Consequência prática: a quinta não é um culto a ser sorteado. Ela herda a
 * escala do domingo da própria rodada, vaga por vaga, e só muda quem tem
 * impedimento. O rodízio acontece ENTRE rodadas.
 */
import { chave } from "./normalizar";
import type { RegistroExterno, RegistroHistorico } from "./dominio";

const DIA_MS = 86_400_000;

/** Data ISO (`2026-09-20`) → Date em UTC, sem fuso para atrapalhar. */
export function dataDe(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 0 = segunda … 6 = domingo, igual a `date.weekday()` do Python. */
export function diaDaSemana(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function somaDias(iso0: string, dias: number): string {
  return iso(new Date(dataDe(iso0).getTime() + dias * DIA_MS));
}

export function diasEntre(a: string, b: string): number {
  return (dataDe(a).getTime() - dataDe(b).getTime()) / DIA_MS;
}

/**
 * Domingo que abre a rodada de uma data.
 *
 * Domingo abre a própria; qualquer outro dia pertence ao domingo `-quintaAposDomingo`.
 * O motor só monta quinta e domingo, então na prática é a quinta apontando para
 * o domingo quatro dias antes.
 */
export function rodadaDe(dataIso: string, quintaAposDomingo: number): string {
  const d = dataDe(dataIso);
  if (diaDaSemana(d) === 6) return dataIso;
  return somaDias(dataIso, -quintaAposDomingo);
}

/** ISO do registro de histórico, ou null quando não há dia. */
export function dataDoRegistro(r: RegistroHistorico): string | null {
  if (r.dia === null) return null;
  const mes = String(r.mes).padStart(2, "0");
  const dia = String(r.dia).padStart(2, "0");
  const texto = `${r.ano}-${mes}-${dia}`;
  // Cinto de segurança: o Python devolve None quando `date()` lança, e é assim
  // que os 84 registros em 31 de fevereiro saem da conta de carga e de rodada.
  // O exportador já os manda com `dia: null`, mas um dado vindo do banco pode
  // não ter passado por ele.
  const d = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || iso(d) !== texto) return null;
  return texto;
}

/**
 * Domingo da rodada → quem serviu nela.
 *
 * A escala externa entra aqui: quem tocou no louvor numa rodada já serviu
 * naquela rodada e não deve ser chamado na seguinte. Sem isso a pessoa alterna
 * louvor e escala geral e nunca folga.
 */
export function equipesPorRodada(
  historico: RegistroHistorico[],
  externa: RegistroExterno[],
  quintaAposDomingo: number,
): Map<string, Set<string>> {
  const por = new Map<string, Set<string>>();
  const juntar = (dataIso: string, nome: string) => {
    const k = rodadaDe(dataIso, quintaAposDomingo);
    const s = por.get(k) ?? new Set<string>();
    s.add(nome);
    por.set(k, s);
  };
  for (const r of historico) {
    const d = dataDoRegistro(r);
    if (d) juntar(d, r.nome);
  }
  for (const r of externa) juntar(r.data, r.nome.trim());
  return por;
}

/**
 * `chave(domingo, setor, subfuncao)` → nomes, SÓ dos cultos de domingo.
 *
 * É a vaga, não só a equipe: na quinta, quem estava na Recepção continua na
 * Recepção. Herdar apenas "a equipe do setor" embaralharia as subfunções dentro
 * da rodada sem motivo.
 */
export function vagasDoDomingo(historico: RegistroHistorico[]): Map<string, string[]> {
  const por = new Map<string, string[]>();
  for (const r of historico) {
    const d = dataDoRegistro(r);
    if (!d || diaDaSemana(dataDe(d)) !== 6) continue;
    const k = chave(d, r.setor, r.subfuncao);
    const lista = por.get(k) ?? [];
    if (!lista.includes(r.nome)) lista.push(r.nome);
    por.set(k, lista);
  }
  return por;
}

/** `chave(domingo, setor)` → equipe do setor naquele domingo. */
export function equipeDoSetorNoDomingo(historico: RegistroHistorico[]): Map<string, string[]> {
  const por = new Map<string, string[]>();
  for (const r of historico) {
    const d = dataDoRegistro(r);
    if (!d || diaDaSemana(dataDe(d)) !== 6) continue;
    const k = chave(d, r.setor);
    const lista = por.get(k) ?? [];
    if (!lista.includes(r.nome)) lista.push(r.nome);
    por.set(k, lista);
  }
  return por;
}
