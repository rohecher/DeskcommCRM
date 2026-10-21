/**
 * Coletor diário do garimpo do upstream (spec: tasks/upstream-garimpo/spec.md §5.1 a 5.4 e 5.8).
 *
 *   npx tsx scripts/upstream-garimpo/coletar.ts [--data AAAA-MM-DD]
 *
 * Pré-requisito: o remote `upstream` existe e `upstream/main` está buscado (o workflow faz).
 *
 * SÓ LÊ o upstream e SÓ ESCREVE em `tasks/upstream-garimpo/`. Não classifica valor
 * (isso é a sessão do Claude, §5.5 a 5.7), não aplica nada, não faz push.
 *
 * O marcador `ultimo-analisado.txt` só anda DEPOIS de o relatório ser escrito: um dia que
 * falha no meio não pode pular PRs. Sem marcador (primeira execução), começa nas últimas
 * 24h do upstream, não na base de 2026-08-10 (que são 10 mil commits).
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { conflitosDoMergeTree, ehCandidato, fragmentosDeRelease, lerMerge, sinaisDe, type Sinais } from "./coleta";
import { classificarArquivo, exigePortarAMao, precisaRenumerar, zonaDoPR, type Zona } from "./zonas";

const PASTA = "tasks/upstream-garimpo";
const MARCADOR = `${PASTA}/ultimo-analisado.txt`;
const MAX_ARQUIVOS_LISTADOS = 40;
const MAX_FRAGMENTO = 400;

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).trim();
}

/**
 * "Esse PR aplica limpo no fork?" Mesma conta de um cherry-pick (a base é o pai do PR), feita
 * em memória. Mede o que a zona não mede: o fork está a milhares de commits do upstream, e um
 * arquivo que o fork NUNCA tocou (verde) pode estar numa versão que o conserto não reconhece,
 * ou nem existir. Medido em 2026-10-20: 2 dos 3 itens "verdes e pequenos" do primeiro lote.
 */
function simularCherryPick(sha: string): { limpo: boolean; conflitos: string[] } {
  try {
    execFileSync("git", ["merge-tree", "--write-tree", "--name-only", `--merge-base=${sha}^1`, "HEAD", sha], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { limpo: true, conflitos: [] };
  } catch (e) {
    // Saída 1 = há conflito (a lista vem no stdout). Qualquer outra coisa é falha de verdade.
    const err = e as { status?: number; stdout?: string };
    if (err.status !== 1) throw e;
    return { limpo: false, conflitos: conflitosDoMergeTree(err.stdout ?? "").slice(0, MAX_ARQUIVOS_LISTADOS) };
  }
}

function linhas(s: string): string[] {
  return s.split("\n").filter(Boolean);
}

interface Item {
  /** Correção, segurança ou mudança pequena (`ehCandidato`). Só estes vão para o relatório e o aviso. */
  candidato: boolean;
  sha: string;
  numero: number | null;
  titulo: string;
  zona: Zona;
  arquivos_total: number;
  por_zona: Record<Zona, number>;
  arquivos: string[];
  renumerar: string[];
  portar_a_mao: string[];
  /** Simulação do cherry-pick sobre o fork de hoje (`git merge-tree`), sem tocar a árvore. */
  cherry_pick: { limpo: boolean; conflitos: string[] };
  sinais: Sinais;
  fragmentos: { arquivo: string; trecho: string }[];
}

function argData(): string {
  const i = process.argv.indexOf("--data");
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`--data inválida: ${v}`);
  return v ?? new Date().toISOString().slice(0, 10);
}

function saidaDoWorkflow(chave: string, valor: string): void {
  const f = process.env.GITHUB_OUTPUT;
  if (f) appendFileSync(f, `${chave}=${valor}\n`);
}

function tabela(itens: Item[]): string {
  const cab = "| PR | Zona | Título | Arquivos | Aplica limpo? | Sinais |\n|---|---|---|---|---|---|";
  const rows = itens.map((i) => {
    const sinais = Object.entries(i.sinais).filter(([, v]) => v).map(([k]) => k).join(", ") || "—";
    const pr = i.numero !== null ? `#${i.numero}` : i.sha.slice(0, 9);
    const titulo = i.titulo.replace(/\|/g, "\\|");
    return `| ${pr} | ${i.zona} | ${titulo} | ${i.arquivos_total} | ${i.cherry_pick.limpo ? "sim" : `não (${i.cherry_pick.conflitos.length})`} | ${sinais} |`;
  });
  return [cab, ...rows].join("\n");
}

function main(): void {
  const data = argData();
  const tip = git("rev-parse", "upstream/main");

  let de: string;
  if (existsSync(MARCADOR)) {
    de = readFileSync(MARCADOR, "utf8").trim();
  } else {
    de = git("rev-list", "-1", "--before=24 hours ago", "upstream/main");
  }
  if (de === tip) {
    console.info("Nada novo no upstream desde o último marcador.");
    saidaDoWorkflow("novo", "false");
    return;
  }

  const base = git("merge-base", "HEAD", "upstream/main");
  const modificados = new Set(linhas(git("diff", "--name-only", base, "HEAD")));

  const bruto = git("log", "--first-parent", "--reverse", "--format=%H%x1f%s%x1f%b%x1e", `${de}..${tip}`);
  const itens: Item[] = bruto
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((registro) => {
      const [sha = "", assunto = "", corpo = ""] = registro.split("\x1f");
      const arquivos = linhas(git("diff", "--name-only", `${sha}^1`, sha));
      const zonas = arquivos.map((f) => classificarArquivo(f, modificados));
      const cherryPick = simularCherryPick(sha);
      // Conflito é, no mínimo, amarelo: "verde" prometeria um cherry-pick limpo que não existe.
      if (!cherryPick.limpo) zonas.push("amarela");
      const porZona: Record<Zona, number> = { verde: 0, amarela: 0, vermelha: 0 };
      for (const z of zonas) porZona[z] += 1;
      const { numero, titulo } = lerMerge(assunto, corpo);
      return {
        candidato: ehCandidato({ titulo, arquivos_total: arquivos.length }),
        sha,
        numero,
        titulo,
        zona: zonaDoPR(zonas),
        arquivos_total: arquivos.length,
        por_zona: porZona,
        arquivos: arquivos.slice(0, MAX_ARQUIVOS_LISTADOS),
        renumerar: arquivos.filter(precisaRenumerar),
        portar_a_mao: arquivos.filter(exigePortarAMao),
        cherry_pick: cherryPick,
        sinais: sinaisDe(arquivos),
        fragmentos: fragmentosDeRelease(arquivos).map((arquivo) => ({
          arquivo,
          trecho: git("show", `${sha}:${arquivo}`).slice(0, MAX_FRAGMENTO),
        })),
      };
    });

  if (itens.length === 0) {
    console.info("Nenhum item novo na linha principal do upstream.");
    saidaDoWorkflow("novo", "false");
    return;
  }

  const candidatos = itens.filter((i) => i.candidato);
  if (candidatos.length === 0) {
    // Sem correção nem segurança no intervalo: nenhuma PR, nenhum aviso. O marcador fica onde
    // está e o próximo intervalo simplesmente inclui estes itens de novo (sem custo).
    console.info(`${itens.length} itens novos no upstream, nenhum é correção, segurança ou mudança pequena.`);
    saidaDoWorkflow("novo", "false");
    return;
  }

  mkdirSync(path.join(PASTA, "relatorios"), { recursive: true });
  // O JSON guarda TODOS os itens, com o campo `candidato`: quem quiser auditar o filtro vê o que ficou de fora.
  const json = { data, de, ate: tip, total: itens.length, total_candidatos: candidatos.length, itens };
  writeFileSync(`${PASTA}/relatorios/${data}.json`, `${JSON.stringify(json, null, 2)}\n`);

  const contagem = (z: Zona) => candidatos.filter((i) => i.zona === z).length;
  const md = [
    `# Garimpo do upstream — ${data}`,
    "",
    `${candidatos.length} correções pequenas entre ${itens.length} itens novos em \`${de.slice(0, 9)}..${tip.slice(0, 9)}\`: ` +
      `${contagem("verde")} aplicam limpas, ${contagem("amarela")} pedem cuidado, ${contagem("vermelha")} mexem em área do Cajado.`,
    "",
    "Só entram correção de defeito, segurança e mudança pequena (decisão de 2026-10-21). Funcionalidade, documento, teste isolado e i18n ficam de fora; o JSON guarda todos, com `candidato: false`.",
    "",
    tabela(candidatos),
    "",
  ].join("\n");
  writeFileSync(`${PASTA}/relatorios/${data}.md`, md);

  // Por último: se qualquer passo acima falhar, o marcador fica onde estava.
  writeFileSync(MARCADOR, `${tip}\n`);

  console.info(`Relatório de ${data}: ${candidatos.length} candidatos de ${itens.length} itens.`);
  saidaDoWorkflow("novo", "true");
  saidaDoWorkflow("data", data);
  saidaDoWorkflow("total", String(candidatos.length));
  saidaDoWorkflow("vermelhos", String(contagem("vermelha")));
}

main();
