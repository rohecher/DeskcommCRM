/**
 * Partes puras do coletor do garimpo (spec §5.3 e §5.4): ler o merge de um PR e dar
 * sinais do que ele toca. Sem git e sem disco — o teste não depende do repo.
 *
 * Os `sinais` são pistas BARATAS por caminho, não o veredito de valor. Quem decide se
 * um PR agrega ao Cajado é a classificação (sessão do Claude, spec §5.5 a 5.7).
 */

export interface MergeDePR {
  /** Número do PR do upstream, ou null se o merge não é de PR (merge de branch direto). */
  numero: number | null;
  /** Título do PR: a 1ª linha do corpo do merge; cai no assunto se o corpo vier vazio. */
  titulo: string;
}

const ASSUNTO_PR = /^Merge pull request #(\d+) from /;

export function lerMerge(assunto: string, corpo: string): MergeDePR {
  const m = ASSUNTO_PR.exec(assunto);
  const primeiraLinha = corpo.split("\n").find((l) => l.trim().length > 0)?.trim();
  return {
    numero: m ? Number(m[1]) : null,
    titulo: primeiraLinha ?? assunto,
  };
}

export interface Sinais {
  /** Toca em IA, agente, WhatsApp/WAHA ou worker: candidato a `bot-comunicacao`. */
  bot: boolean;
  /** Toca em produto de vendas (Nuvemshop, pedidos, cobrança): candidato a descarte. */
  vendas: boolean;
  /** Toca em schema, RLS ou migration. */
  schema: boolean;
  /** Toca em tela: pode trazer texto comercial para traduzir. */
  tela: boolean;
}

const BOT = /^(lib\/ai\/|lib\/waha|lib\/whatsapp|workers\/|app\/api\/v1\/(webhooks|ai|agents|cron)\/|app\/app\/ai\/)/;
const VENDAS = /(nuvemshop|\/orders?\/|\/billing\/|\/cobranca|\/checkout|\/planos?\/)/i;
const SCHEMA = /^supabase\//;
const TELA = /^(app\/app\/|components\/)/;

export function sinaisDe(arquivos: readonly string[]): Sinais {
  return {
    bot: arquivos.some((f) => BOT.test(f)),
    vendas: arquivos.some((f) => VENDAS.test(f)),
    schema: arquivos.some((f) => SCHEMA.test(f)),
    tela: arquivos.some((f) => TELA.test(f)),
  };
}

/** Fragmento de release do upstream (`docs/release/*.md`): o resumo em linguagem de produto. */
export function fragmentosDeRelease(arquivos: readonly string[]): string[] {
  return arquivos.filter((f) => /^docs\/release\/[^/]+\.md$/.test(f));
}

// ---- Aviso no Telegram ------------------------------------------------------------

export interface ItemDoAviso {
  numero: number | null;
  titulo: string;
  zona: "verde" | "amarela" | "vermelha";
  sinais: Sinais;
  renumerar: readonly string[];
}

const MAX_DESTAQUES = 3;
const MAX_TITULO = 70;

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function limpaTitulo(t: string): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > MAX_TITULO ? `${s.slice(0, MAX_TITULO - 1)}…` : s;
}

/**
 * Texto puro (sem parse_mode) do aviso diário: o título do PR vem do upstream, então não
 * pode ser interpretado como marcação. Itens vermelhos nunca entram nos destaques — a
 * rotina não propõe tocar neles.
 */
export function montarAviso(
  data: string,
  itens: readonly ItemDoAviso[],
  urlDaPR: string,
  totalNoUpstream?: number,
): string {
  const [, mes, dia] = data.split("-");
  const n = (z: ItemDoAviso["zona"]) => itens.filter((i) => i.zona === z).length;
  const migrations = itens.filter((i) => i.renumerar.length > 0).length;

  const abertura =
    totalNoUpstream === undefined
      ? `${plural(itens.length, "item novo", "itens novos")} no upstream`
      : `${plural(itens.length, "correção pequena", "correções pequenas")} entre ${totalNoUpstream} itens novos no upstream`;
  const linhas = [`Garimpo de ${dia}/${mes}: ${abertura}.`];
  const faixas = [
    plural(n("verde"), "entra limpo", "entram limpos"),
    plural(n("amarela"), "pede cuidado", "pedem cuidado"),
  ];
  if (n("vermelha") > 0) faixas.push(plural(n("vermelha"), "mexe em área do Cajado", "mexem em área do Cajado"));
  linhas.push(`${faixas.join(", ")}.`);
  if (migrations > 0) linhas.push(`${plural(migrations, "traz migration", "trazem migration")}.`);

  const candidatos = itens.filter((i) => i.zona !== "vermelha");
  const destaques = [...candidatos.filter((i) => i.sinais.bot), ...candidatos.filter((i) => !i.sinais.bot)]
    .slice(0, MAX_DESTAQUES)
    .map((i) => `${i.numero !== null ? `#${i.numero} ` : ""}${limpaTitulo(i.titulo)}`);
  if (destaques.length > 0) linhas.push(`Para olhar primeiro: ${destaques.join("; ")}.`);

  linhas.push(`Decida aqui: ${urlDaPR}`);
  return linhas.join("\n");
}

// ---- Simulação do cherry-pick -------------------------------------------------------

/**
 * Lê a saída de `git merge-tree --write-tree --name-only`: a 1ª linha é o OID da árvore,
 * depois vêm os arquivos em conflito, até a primeira linha em branco. Árvore limpa = lista vazia.
 */
export function conflitosDoMergeTree(saida: string): string[] {
  const [, ...resto] = saida.split("\n");
  const arquivos: string[] = [];
  for (const linha of resto) {
    if (linha.trim() === "") break;
    arquivos.push(linha.trim());
  }
  return arquivos;
}

// ---- Filtro: só correção, segurança e mudança pequena --------------------------------

/**
 * Decisão de 2026-10-21: o fork não acompanha funcionalidade do upstream (3% dos PRs
 * aplicam limpo; o i18n que o fork nunca recebeu conflita em quase tudo). O garimpo passa a
 * propor só (a) correção de defeito e (b) segurança, e só quando a mudança é pequena.
 * "Pequena" é medida em arquivos tocados: é a única medida que o coletor tem sem ler código.
 */
const TITULO_DE_CORRECAO = /^(fix|perf|security|sec)(\([^)]*\))?!?:/i;
const TEMA_DE_SEGURANCA = /seguran|vulnerab|\bCVE-|GHSA|\bRCE\b|\bXSS\b|\bSSRF\b|injec|lgpd|anonimiz|rgpd/i;
const TEMA_DE_I18N = /i18n|idioma|língua|traduç|locale|espanhol|inglês|português/i;

export const MAX_ARQUIVOS_DE_CORRECAO = 12;
/** Correção de segurança pode ser grande (cascata de LGPD, por exemplo) e ainda valer. */
export const MAX_ARQUIVOS_DE_SEGURANCA = 40;

export function ehCandidato(item: { titulo: string; arquivos_total: number }): boolean {
  // i18n conflita por construção: o fork não tem o sistema. Nem correção dele entra.
  if (TEMA_DE_I18N.test(item.titulo)) return false;
  const seguranca = TEMA_DE_SEGURANCA.test(item.titulo);
  if (!seguranca && !TITULO_DE_CORRECAO.test(item.titulo)) return false;
  return item.arquivos_total <= (seguranca ? MAX_ARQUIVOS_DE_SEGURANCA : MAX_ARQUIVOS_DE_CORRECAO);
}
