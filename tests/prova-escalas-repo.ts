/**
 * Sonda: a escala gerada a partir do BANCO é igual à gerada a partir dos JSON?
 *
 * Só leitura. É o que fecha o porte: o teste de paridade prova o motor contra o
 * Python usando os JSON, e esta sonda prova que `repo.ts` entrega ao motor
 * exatamente a mesma entrada que `de-json.ts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { montarMotor, type DadosJson, type RegrasJson } from "@/lib/escalas/de-json";
import { gerarLote } from "@/lib/escalas/gerar";
import { carregarMotor } from "@/lib/escalas/repo";

const DIR = process.argv[2]!;
const SLUG = process.argv[3] ?? "avivar-church";
const ler = <T>(f: string): T => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as T;

const esperado = ler<{ hoje: string; datas: string[] }>("esperado.json");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const linha = (l: { data: string; setor: string; subfuncao: string; nome: string; obs: string }) =>
  `${l.data} ${l.setor} / ${l.subfuncao || "-"} = ${l.nome || "(vaga aberta)"}${l.obs ? ` [${l.obs}]` : ""}`;

async function main() {
  const org = await db.from("organizations").select("id, display_name").eq("slug", SLUG).single();
  if (org.error) throw new Error(org.error.message);
  console.info(`organização: ${org.data.display_name}`);

  const doBanco = await carregarMotor(db, org.data.id as string, {
    datas: esperado.datas,
    hojeIso: esperado.hoje,
  });
  const escalaBanco = gerarLote(esperado.datas, doBanco.entrada, doBanco.estado).flatMap(
    (c) => c.escala,
  );

  const doJson = montarMotor(
    ler<RegrasJson>("regras.json"),
    ler<DadosJson>("dados.json"),
    esperado.datas,
    esperado.hoje,
  );
  const escalaJson = gerarLote(esperado.datas, doJson.entrada, doJson.estado).flatMap(
    (c) => c.escala,
  );

  console.info(`banco: ${escalaBanco.length} linhas | json: ${escalaJson.length} linhas`);
  console.info(
    `entrada — historico banco=${doBanco.entrada.historico.length} json=${doJson.entrada.historico.length} | ` +
      `setores ${doBanco.entrada.setores.length}/${doJson.entrada.setores.length} | ` +
      `regras ${doBanco.entrada.regras.size}/${doJson.entrada.regras.size} | ` +
      `casais ${doBanco.entrada.casais.size}/${doJson.entrada.casais.size} | ` +
      `perfis ${doBanco.entrada.perfis.size}/${doJson.entrada.perfis.size} | ` +
      `reserva ${doBanco.entrada.reserva.size}/${doJson.entrada.reserva.size} | ` +
      `fixados ${doBanco.entrada.fixados.size}/${doJson.entrada.fixados.size} | ` +
      `vetos ${doBanco.entrada.rejeitados.size}/${doJson.entrada.rejeitados.size} | ` +
      `off ${doBanco.entrada.setoresOff.size}/${doJson.entrada.setoresOff.size} | ` +
      `externa ${doBanco.entrada.externa.length}/${doJson.entrada.externa.length}`,
  );

  const a = escalaJson.map(linha);
  const b = escalaBanco.map(linha);
  let difs = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) difs += 1;
  }
  console.info(`linhas divergentes (posição importa): ${difs} de ${a.length}`);

  // O CONJUNTO por vaga é o mesmo? Se for, a divergência acima é só de POSIÇÃO
  // dentro da vaga — empate de nota resolvido pela ordem de inserção do
  // histórico, que difere entre o CSV e o `order by` do SQL.
  const agrupa = (ls: typeof escalaJson) => {
    const m = new Map<string, string[]>();
    for (const l of ls) {
      const k = `${l.data}|${l.setor}|${l.subfuncao}`;
      m.set(k, [...(m.get(k) ?? []), l.nome]);
    }
    for (const v of m.values()) v.sort();
    return m;
  };
  const ma = agrupa(escalaJson);
  const mb = agrupa(escalaBanco);
  let difConjunto = 0;
  for (const k of new Set([...ma.keys(), ...mb.keys()])) {
    if ((ma.get(k) ?? []).join(" | ") !== (mb.get(k) ?? []).join(" | ")) {
      difConjunto += 1;
      if (difConjunto <= 10) {
        console.info(
          `CONJUNTO DIFERE ${k}\n   json:  ${(ma.get(k) ?? []).join(", ")}\n   banco: ${(mb.get(k) ?? []).join(", ")}`,
        );
      }
    }
  }
  console.info(`vagas com CONJUNTO diferente: ${difConjunto} de ${ma.size}`);
  if (difConjunto === 0 && difs === 0) console.info("IGUAL em tudo");
  else if (difConjunto === 0)
    console.info("MESMAS PESSOAS em todas as vagas; difere só a ordem interna");
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
