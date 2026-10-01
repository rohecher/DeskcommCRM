/**
 * Quem pode ocupar UMA vaga — a pergunta da edição manual.
 *
 * Quando a liderança clica numa vaga para trocar o nome, a lista que aparece não
 * pode ser o cadastro inteiro: ela escolheria alguém de férias, alguém que já
 * está na recepção do mesmo culto ou alguém do louvor naquela noite, e a escala
 * sairia com o mesmo erro que o motor existe para evitar. As regras aqui são as
 * DO MOTOR (`impedido`, `parDecente`), não uma segunda versão delas: se a tela e
 * o motor discordassem, a escala trocada à mão seria desfeita na próxima geração.
 *
 * Três grupos, porque nem toda regra pesa igual:
 *
 *   pode       — passa em tudo. Ordenado por quem mais serviu NESTE setor.
 *   comAviso   — pode, mas a liderança precisa ver por quê: fora do time fixo
 *                da função, ou dupla de homem e mulher que não são casados numa
 *                vaga isolada. São regras que a liderança já liberou antes
 *                (excecoes.csv), então a tela avisa e deixa escolher.
 *   naoPode    — impedimento de verdade (ausente, suspenso, já escalado neste
 *                culto, time do louvor, dia ou setor que a pessoa não serve).
 *                Aparece com o motivo, para ninguém precisar investigar.
 */
import type { Config, RegraVoluntario } from "./dominio";
import { bonito } from "./formato";
import { impedido, parDecente } from "./restricoes";

export interface CandidatoBase {
  id: string;
  nome: string;
}

export interface Candidato extends CandidatoBase {
  /** Quantas vezes serviu neste setor no histórico. */
  vezesNoSetor: number;
  /** Motivo do aviso ou do impedimento; vazio em quem pode. */
  motivo: string;
}

export interface CandidatosDaVaga {
  pode: Candidato[];
  comAviso: Candidato[];
  naoPode: Candidato[];
}

export interface EntradaDaVaga {
  setor: string;
  diaSemana: string;
  dataIso: string;
  voluntarios: readonly CandidatoBase[];
  regras: ReadonlyMap<string, RegraVoluntario>;
  config: Config;
  /** Nome → onde já está neste culto ("Recepção", "louvor · Back"). Sem a vaga editada. */
  ocupados: ReadonlyMap<string, string>;
  /** Nomes do time fixo da função; vazio = qualquer um. */
  timeFixo: readonly string[];
  /** A vaga é de dupla isolada (cafeteria, mesa, estacionamento...)? */
  exigeDecencia: boolean;
  /** Quem já está na(s) outra(s) vaga(s) da mesma função neste culto. */
  parceiros: readonly string[];
  sexo: ReadonlyMap<string, string>;
  casais: ReadonlyMap<string, string>;
  /** Nome → vezes no setor. */
  experiencia: ReadonlyMap<string, number>;
  /** Quem está na vaga agora: não entra na lista. */
  atual: string | null;
}

/** Status que nem aparece na lista: quem saiu não é opção nem com motivo. */
const FORA_DA_LISTA = new Set(["INATIVO"]);

export function candidatosDaVaga(e: EntradaDaVaga): CandidatosDaVaga {
  const pode: Candidato[] = [];
  const comAviso: Candidato[] = [];
  const naoPode: Candidato[] = [];

  for (const v of e.voluntarios) {
    if (v.nome === e.atual) continue;
    const regra = e.regras.get(v.nome);
    if (regra && FORA_DA_LISTA.has(regra.status)) continue;

    const c: Candidato = { ...v, vezesNoSetor: e.experiencia.get(v.nome) ?? 0, motivo: "" };

    const onde = e.ocupados.get(v.nome);
    if (onde) {
      naoPode.push({ ...c, motivo: `já está em ${onde} neste culto` });
      continue;
    }
    const imp = impedido(v.nome, e.setor, e.diaSemana, e.dataIso, e.regras as Map<string, RegraVoluntario>, e.config);
    if (imp) {
      naoPode.push({ ...c, motivo: legivel(imp) });
      continue;
    }

    const avisos: string[] = [];
    if (e.timeFixo.length > 0 && !e.timeFixo.includes(v.nome)) {
      avisos.push("fora do time fixo desta função");
    }
    if (e.exigeDecencia) {
      const malPar = e.parceiros.find(
        (p) => !parDecente(v.nome, p, e.sexo as Map<string, string>, e.casais as Map<string, string>),
      );
      if (malPar) avisos.push(`ficaria em dupla com ${malPar}, sem serem casados`);
    }
    if (avisos.length > 0) comAviso.push({ ...c, motivo: avisos.join("; ") });
    else pode.push(c);
  }

  const porExperiencia = (a: Candidato, b: Candidato) =>
    b.vezesNoSetor - a.vezesNoSetor || a.nome.localeCompare(b.nome, "pt-BR");
  pode.sort(porExperiencia);
  comAviso.sort(porExperiencia);
  naoPode.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { pode, comAviso, naoPode };
}

/**
 * O motivo do motor vem sem acento e com data ISO ("ausente ate 2026-11-15"),
 * porque é o mesmo texto do Python. Na tela ele sai em português.
 */
export function legivel(motivo: string): string {
  // "so serve em mesa da comunhao/culto kids": o motor devolve o setor
  // normalizado; aqui ele volta a ser escrito como a igreja escreve.
  const setores = /^so serve em (.+)$/.exec(motivo);
  if (setores) {
    const lista = setores[1]!
      .split("/")
      .map((s) => bonito(s.toUpperCase()).toLocaleLowerCase("pt-BR"))
      .join(" ou ");
    return `só serve em ${lista}`;
  }
  return motivo
    .replace(/^ausente ate (\d{4})-(\d{2})-(\d{2})$/, "ausente até $3/$2/$1")
    .replace(/^so serve /, "só serve ")
    .replace(/^setor bloqueado$/, "não serve neste setor")
    .replace(/^ferias$/, "de férias")
    .replace(/^time de (m\. )?louvor$/, "do louvor (escala própria)")
    .replace(/^time de (m\. )?danca$/, "da dança (escala própria)")
    .replace(/^time de (multimidia|midia)$/, "da mídia (escala própria)")
    .replace(/^time de som$/, "do som (escala própria)");
}
