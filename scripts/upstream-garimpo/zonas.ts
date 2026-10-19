/**
 * Zonas do garimpo do upstream (spec: tasks/upstream-garimpo/spec.md §4).
 *
 * A zona de um arquivo diz o que a rotina pode propor sobre ele quando um PR do
 * DeskcommCRM o toca. É CALCULADA aqui, não decidida à mão em cada relatório —
 * senão cada dia classificaria de um jeito.
 *
 *   vermelha  a rotina nunca propõe tocar (domínio do Cajado, doutrina, baseline)
 *   amarela   o fork já modificou o arquivo: o ganho entra, o texto volta a ser pastoral
 *   verde     o fork não tocou: cherry-pick limpo
 *
 * Função pura, sem git e sem disco, para o teste não depender do estado do repo.
 * Quem sabe quais arquivos o fork modificou é o chamador
 * (`git diff --name-only <merge-base> HEAD`).
 */

export type Zona = "verde" | "amarela" | "vermelha";

/** Prefixos de diretório (terminam em `/`) e arquivos exatos que são do Cajado. */
const VERMELHAS_PREFIXO = [
  "lib/escalas/",
  "app/app/escalas/",
  "docs/agents/",
  "tasks/upstream-garimpo/",
];

const VERMELHAS_EXATAS = new Set([
  "scripts/importar-escalas.ts",
  "lib/branding.ts",
  "docs/decisoes.md",
  "docs/escalas-glossario.md",
  "docs/dominio-nao-e-venda.md",
  "CLAUDE.md",
  "AGENTS.md",
  // O baseline do upstream nunca é importado: o do fork tem apêndice próprio e o bloco
  // `VARREDURA anon` precisa ser o último (decisão de 2026-10-19). Portar à mão.
  "supabase/baseline.sql",
  // Numeração do fork diverge da do upstream (0144–0149 são migrations diferentes).
  "supabase/migrations/MANIFEST.md",
]);

const MIGRATION = /^supabase\/migrations\/\d{14}_\d{4}_[^/]+\.sql$/;
const MIGRATION_DE_ESCALAS = /^supabase\/migrations\/\d{14}_\d{4}_[^/]*escala[^/]*\.sql$/;

export function classificarArquivo(caminho: string, modificadosPeloFork: ReadonlySet<string>): Zona {
  if (
    VERMELHAS_EXATAS.has(caminho) ||
    MIGRATION_DE_ESCALAS.test(caminho) ||
    VERMELHAS_PREFIXO.some((p) => caminho.startsWith(p))
  ) {
    return "vermelha";
  }
  return modificadosPeloFork.has(caminho) ? "amarela" : "verde";
}

const GRAVIDADE: Record<Zona, number> = { verde: 0, amarela: 1, vermelha: 2 };

/** O PR herda a pior zona entre os seus arquivos. Sem arquivos, nada a conflitar. */
export function zonaDoPR(zonas: readonly Zona[]): Zona {
  return zonas.reduce<Zona>((pior, z) => (GRAVIDADE[z] > GRAVIDADE[pior] ? z : pior), "verde");
}

/**
 * Migration que vem do upstream nunca entra com o número original: as 0144–0149 de lá
 * são outras que as do fork. Renumera para depois da última do fork.
 */
export function precisaRenumerar(caminho: string): boolean {
  return MIGRATION.test(caminho);
}
