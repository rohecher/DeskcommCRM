/**
 * Monta o texto do aviso do Telegram a partir do relatório do dia.
 *
 *   npx tsx scripts/upstream-garimpo/avisar.ts <AAAA-MM-DD> <url-da-pr> <arquivo-de-saida>
 *
 * Só escreve o texto num arquivo. Quem fala com o Telegram é o workflow (`curl`), para o
 * token nunca passar por código nosso.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { montarAviso, type ItemDoAviso } from "./coleta";

const [data, url, saida] = process.argv.slice(2);
if (!data || !url || !saida || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
  throw new Error("uso: avisar.ts <AAAA-MM-DD> <url-da-pr> <arquivo-de-saida>");
}

const relatorio = JSON.parse(readFileSync(`tasks/upstream-garimpo/relatorios/${data}.json`, "utf8")) as {
  itens: ItemDoAviso[];
};
writeFileSync(saida, `${montarAviso(data, relatorio.itens, url)}\n`);
