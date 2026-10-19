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
