/**
 * A escala do louvor COLADA como texto — do jeito que chega no WhatsApp.
 *
 * O louvor monta a própria escala e manda uma mensagem assim:
 *
 *     Cultos 04/ 10 e 08/10
 *     Voz guia: Rhayssa celebração
 *     Back: Samily e Mara (JOsimaria
 *     Bateria: Calebe
 *     Paleta de roupa: Marrom/ preto
 *
 *     Sala de oração 05/10
 *     André/ Layla/ Mara
 *
 * Em vez de uma tela de cadastro, a liderança cola isso e confere uma prévia.
 * Este arquivo faz as duas leituras, ambas puras e testadas:
 *
 *   lerEscalaDoLouvor — texto → blocos (datas, função, nomes como digitados);
 *   reconhecerNome    — "Naty", "Lucas Moura", "Rayssa" → o voluntário do cadastro.
 *
 * Por que um leitor e não IA: o formato é estável, a leitura tem de ser a mesma
 * toda vez, e o que não for reconhecido vai para a liderança escolher — que é
 * onde a dúvida deve ser resolvida, não num palpite silencioso.
 */
import { norm } from "./normalizar";

// ─── 1. O texto ──────────────────────────────────────────────────────────────

export interface NomeDigitado {
  /** Como veio na mensagem: "Mara". */
  digitado: string;
  /** O que estava entre parênteses ao lado: "(JOsimaria" → "JOsimaria". */
  dica: string | null;
}

export interface ItemDoLouvor {
  /** Função canônica: "Voz guia celebracao", "Back", "Bateria"... */
  funcao: string;
  nomes: NomeDigitado[];
}

export interface BlocoDoLouvor {
  datas: string[];
  /** Sala de oração: encontro só do louvor (segunda). */
  oracao: boolean;
  paleta: string | null;
  itens: ItemDoLouvor[];
}

const DATA = /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/g;

/**
 * As datas de uma linha, já com ano. O ano vem do mês de referência — e vira o
 * ano quando a mensagem de dezembro já fala de janeiro.
 */
export function datasDaLinha(linha: string, mesReferencia: string): string[] {
  const [anoRef, mesRef] = mesReferencia.split("-").map(Number) as [number, number];
  const datas: string[] = [];
  for (const m of linha.matchAll(DATA)) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue;
    let ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : anoRef;
    if (!m[3] && mes < mesRef && mesRef - mes > 6) ano += 1;
    datas.push(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  return datas;
}

/** As funções como o louvor escreve → como o Cajado guarda (sem acento, como o motor). */
const FUNCOES: [RegExp, string][] = [
  // "Vos guia" também: veio assim na mensagem de outubro.
  [/^vo(z|s|zes) guias?$/, "Voz guia"],
  [/^backs?$|^backing( vocal)?s?$|^back vocal$/, "Back"],
  [/^bateria$|^batera$/, "Bateria"],
  [/^(contra)?baixo$/, "Baixo"],
  [/^teclados?$|^teclas$/, "Teclado"],
  [/^guitarras?$/, "Guitarra"],
  [/^violao$/, "Violao"],
  [/^live$/, "Live"],
  [/^sala pastoral$/, "Sala pastoral"],
  [/^sala de oracao$/, "Sala de oracao"],
];

function funcaoCanonica(digitada: string): string {
  const n = norm(digitada).toLowerCase();
  for (const [re, nome] of FUNCOES) if (re.test(n)) return nome;
  const limpa = digitada.trim().replace(/\s+/g, " ");
  return limpa.charAt(0).toUpperCase() + limpa.slice(1);
}

/** "celebração"/"adoração" depois do nome dizem QUAL voz guia é. */
const QUALIFICADOR = /\b(celebra[cç][aã]o|adora[cç][aã]o)\b/i;

function separarNomes(trecho: string): NomeDigitado[] {
  // "Mara (JOsimaria" — parêntese aberto e não fechado acontece; vale como dica.
  const nomes: NomeDigitado[] = [];
  for (const parte of trecho.split(/\s*(?:,|\/|&|;|\+|\be\b)\s*/i)) {
    let texto = parte.replace(QUALIFICADOR, "").trim();
    let dica: string | null = null;
    const p = /\(([^)]*)\)?/.exec(texto);
    if (p) {
      dica = p[1]!.trim() || null;
      texto = texto.replace(p[0], "").trim();
    }
    texto = texto.replace(/[.:;!?-]+$/g, "").replace(/\s+/g, " ").trim();
    if (texto) nomes.push({ digitado: texto, dica });
  }
  return nomes;
}

/**
 * Lê a mensagem inteira. Linha com data e sem "função:" abre um bloco; as
 * linhas seguintes são "Função: nomes" até o próximo bloco. Título solto antes
 * do primeiro bloco ("Escala do louvor mês de outubro") é ignorado.
 */
export function lerEscalaDoLouvor(
  texto: string,
  mesReferencia: string,
): { blocos: BlocoDoLouvor[]; ignoradas: string[] } {
  const blocos: BlocoDoLouvor[] = [];
  const ignoradas: string[] = [];
  let atual: BlocoDoLouvor | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const doisPontos = linha.indexOf(":");
    const datas = datasDaLinha(doisPontos >= 0 ? linha.slice(0, doisPontos) : linha, mesReferencia);

    if (datas.length > 0) {
      atual = { datas, oracao: /ora[cç][aã]o/i.test(linha), paleta: null, itens: [] };
      blocos.push(atual);
      continue;
    }
    if (!atual) {
      ignoradas.push(linha);
      continue;
    }

    const rotulo = doisPontos >= 0 ? linha.slice(0, doisPontos).trim() : "";
    const resto = doisPontos >= 0 ? linha.slice(doisPontos + 1).trim() : linha;

    if (/^paleta/i.test(norm(rotulo).toLowerCase())) {
      atual.paleta = resto.replace(/\s*\/\s*/g, " / ").trim() || null;
      continue;
    }
    // Linha sem "função:" — na sala de oração são as vozes; num culto, continua
    // a função anterior.
    const funcaoBase = rotulo
      ? funcaoCanonica(rotulo)
      : atual.oracao
        ? "Sala de oracao"
        : (atual.itens.at(-1)?.funcao ?? "");
    if (!funcaoBase) {
      ignoradas.push(linha);
      continue;
    }

    for (const nome of separarNomes(resto)) {
      // "Voz guia: Rhayssa celebração" → a função é "Voz guia celebracao".
      let funcao = funcaoBase;
      if (funcaoBase === "Voz guia") {
        const q = QUALIFICADOR.exec(resto);
        if (q) funcao = /celebra/i.test(q[1]!) ? "Voz guia celebracao" : "Voz guia adoracao";
      }
      const item = atual.itens.find((i) => i.funcao === funcao);
      if (item) item.nomes.push(nome);
      else atual.itens.push({ funcao, nomes: [nome] });
    }
  }
  return { blocos, ignoradas };
}

// ─── 2. Os nomes ─────────────────────────────────────────────────────────────

export interface Pessoa {
  id: string;
  nome: string;
}

export type Reconhecimento =
  | { tipo: "certo"; pessoa: Pessoa; como: "apelido" | "nome" | "parte do nome" }
  | { tipo: "aproximado"; pessoa: Pessoa; opcoes: Pessoa[] }
  | { tipo: "duvida"; opcoes: Pessoa[] }
  | { tipo: "desconhecido"; opcoes: Pessoa[] };

export interface BaseDeNomes {
  pessoas: readonly Pessoa[];
  /** apelido normalizado → id (apelidos gerais e os do louvor). */
  apelidos: ReadonlyMap<string, string>;
  /** Quem é ou já foi do louvor: desempata "Lucas", "Bruno", "Juliana". */
  doLouvor: ReadonlySet<string>;
  /**
   * Quem é do DEPARTAMENTO louvor — desempate mais forte que o histórico. O
   * histórico importado já resolveu "Bruno" errado alguma vez, e então dois
   * Brunos "já foram do louvor"; o departamento diz qual é de fato.
   */
  doDepartamento?: ReadonlySet<string>;
}

function chaveNome(s: string): string {
  return norm(s).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** Semelhança 0..1 (Levenshtein normalizado). "rayssa" × "rhayssa" ≈ 0,86. */
export function semelhanca(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  let ant = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(ant[j]! + 1, cur[j - 1]! + 1, ant[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    ant = cur;
  }
  return 1 - ant[n]! / Math.max(m, n);
}

/**
 * Quem é "Naty"? Do mais seguro para o menos:
 *
 *   1. a dica entre parênteses ("Mara (Josimaria)") — quem escreveu já disse;
 *   2. apelido cadastrado;
 *   3. nome completo igual;
 *   4. as palavras digitadas estão todas no nome ("Lucas Moura" → Lucas Borges
 *      Moura); várias pessoas assim → quem é do louvor; ainda várias → dúvida;
 *   5. grafia parecida ("Rayssa" → Rhayssa) — APROXIMADO: a prévia mostra e a
 *      liderança confirma.
 *
 * Nunca chuta entre duas pessoas: empate vira dúvida, com as opções.
 */
export function reconhecerNome(n: NomeDigitado, base: BaseDeNomes): Reconhecimento {
  const porId = new Map(base.pessoas.map((p) => [p.id, p]));
  const louvorPrimeiro = (lista: Pessoa[]) => {
    const doDepto = lista.filter((p) => base.doDepartamento?.has(p.id));
    if (doDepto.length > 0) return doDepto;
    const do_ = lista.filter((p) => base.doLouvor.has(p.id));
    return do_.length > 0 ? do_ : lista;
  };

  const tentar = (texto: string): Reconhecimento | null => {
    const k = chaveNome(texto);
    if (!k) return null;

    const ap = base.apelidos.get(k);
    if (ap && porId.has(ap)) return { tipo: "certo", pessoa: porId.get(ap)!, como: "apelido" };

    const exato = base.pessoas.filter((p) => chaveNome(p.nome) === k);
    if (exato.length === 1) return { tipo: "certo", pessoa: exato[0]!, como: "nome" };

    const palavras = k.split(" ");
    const contem = base.pessoas.filter((p) => {
      const tokens = chaveNome(p.nome).split(" ");
      return palavras.every((w) => tokens.includes(w));
    });
    if (contem.length > 0) {
      const preferidos = louvorPrimeiro(contem);
      if (preferidos.length === 1) return { tipo: "certo", pessoa: preferidos[0]!, como: "parte do nome" };
      return { tipo: "duvida", opcoes: preferidos };
    }
    return null;
  };

  if (n.dica) {
    const r = tentar(n.dica);
    if (r && r.tipo === "certo") return r;
  }
  const direto = tentar(n.digitado);
  if (direto) return direto;

  // Grafia parecida: compara com o primeiro nome e com o nome inteiro.
  const k = chaveNome(n.digitado);
  const notas = base.pessoas
    .map((p) => {
      const c = chaveNome(p.nome);
      return { p, s: Math.max(semelhanca(k, c.split(" ")[0]!), semelhanca(k, c)) };
    })
    .filter((x) => x.s >= 0.7)
    .sort((a, b) => b.s - a.s || Number(base.doLouvor.has(b.p.id)) - Number(base.doLouvor.has(a.p.id)));
  const opcoes = louvorPrimeiro(notas.map((x) => x.p)).slice(0, 5);
  if (notas.length === 0) return { tipo: "desconhecido", opcoes: [] };
  const melhor = notas[0]!;
  const empatados = notas.filter((x) => x.s === melhor.s);
  const doLouvorEntreEmpatados = empatados.filter((x) => base.doLouvor.has(x.p.id));
  const escolhido =
    empatados.length === 1 ? melhor.p : doLouvorEntreEmpatados.length === 1 ? doLouvorEntreEmpatados[0]!.p : null;
  return escolhido ? { tipo: "aproximado", pessoa: escolhido, opcoes } : { tipo: "duvida", opcoes };
}

/** Apelido como chave de busca — o mesmo normalizador do reconhecimento. */
export function chaveDeApelido(apelido: string): string {
  return chaveNome(apelido);
}
