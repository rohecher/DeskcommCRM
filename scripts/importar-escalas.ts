/**
 * Importa o motor de escalas (Filhos que Servem) para as tabelas `escala_*`.
 *
 *   npx tsx scripts/importar-escalas.ts --dir "<pasta do motor>" --org <slug|uuid>
 *   npx tsx scripts/importar-escalas.ts --dir ... --org ... --dry-run
 *
 * Lê os dois JSON que o lado Python gera:
 *
 *   regras.json  (motor/exportar_regras.py) — as ~30 constantes de gerar.py
 *   dados.json   (motor/exportar_dados.py)  — os CSVs: voluntários, casais,
 *                                             apelidos, líderes, cultos, slots
 *
 * Por que os JSON e não os CSV direto: as funções de leitura do motor já lidam
 * com o BOM do Excel, com o separador `;`, com a grafia acentuada dos nomes e
 * com o fallback `(setor, None)` de `TIME_FIXO`/`POOL_EXTRA`, e já foram
 * exercitadas por todas as escalas de setembro e outubro. Reimplementar isso em
 * TypeScript criaria uma segunda leitura para divergir da primeira, e a
 * divergência aqui não dá erro: ela some com um voluntário da escala.
 *
 * ═══ NOME DESCONHECIDO ABORTA A IMPORTAÇÃO ═══
 *
 * Toda regra aponta para gente por NOME. Um nome que não casa com o cadastro não
 * levanta exceção em lugar nenhum: a pessoa simplesmente deixa de ser
 * considerada. Foi assim que `Lucélia Exemplo` escrita `Lucília` no `TIME_FIXO`
 * tirou a líder da Mesa da Comunhão da escala por um mês, em silêncio — o motor
 * ganhou `validar_nomes()` por causa disso. Aqui a mesma verificação é fronteira
 * de escrita: se um nome não resolve, nada é gravado.
 *
 * ═══ IDEMPOTENTE ═══
 *
 * Roda quantas vezes quiser: tudo entra por `upsert` na chave natural (nome do
 * voluntário, nome do setor, data do culto). Os slots de um culto são
 * substituídos, não somados — importar duas vezes não duplica a escala.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { anunciarDestino, credenciaisSupabaseDeTeste } from "./lib/env-de-teste";

// ── Argumentos ──────────────────────────────────────────────────────────────

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DIR = arg("dir");
const ORG = arg("org");
const DRY_RUN = process.argv.includes("--dry-run");

if (!DIR || !ORG) {
  console.error(
    "uso: tsx scripts/importar-escalas.ts --dir <pasta do motor> --org <slug|uuid> [--dry-run]",
  );
  process.exit(2);
}

// ── Formato dos JSON (o que o Python emite) ─────────────────────────────────

interface Subfuncao {
  nome: string;
  qtd: number;
  posicao: number;
  qtd_por_dia: Record<string, number>;
  time_fixo: string[];
  prioridade: string[];
  pool_extra: string[];
  por_frequencia: boolean;
  max_do_grupo: number | null;
  dupla_decente: boolean;
  casal_junto: boolean;
  /** [setor, subfunção] da vaga apontada, resolvido para uuid na 2ª passada. */
  mesmo_sexo_que: [string, string] | null;
  conjuge_de: [string, string] | null;
}

interface Setor {
  nome: string;
  posicao: number;
  nucleo: boolean;
  dupla_decente: boolean;
  casal_junto: boolean;
  so_casal: boolean;
  pool_pequeno: boolean;
  externo: boolean;
  rodizio_inverso_quinta: boolean;
  reforco_se_off: { setor: string; subfuncao: string; qtd: number }[];
  subfuncoes: Subfuncao[];
}

interface Regras {
  config: Record<string, unknown>;
  reserva: string[];
  setores: Setor[];
}

interface Voluntario {
  nome: string;
  sexo: "M" | "F" | null;
  status: string;
  departamento: string;
  dias_permitidos: string[];
  setores_bloqueados: string[];
  setores_permitidos: string[];
  ausente_de: string | null;
  ausente_ate: string | null;
  max_por_mes: number | null;
  telefone: string | null;
}

interface Slot {
  setor: string;
  subfuncao: string;
  nome: string | null;
  origem: string;
  motivo: string;
}

interface Culto {
  data: string;
  dia_semana: string;
  hora: string | null;
  rodada_data: string;
  status: string;
  setores_off: { setor: string; motivo: string }[];
  slots: Slot[];
}

interface Dados {
  voluntarios: Voluntario[];
  apelidos: { apelido: string; nome: string; setor: string }[];
  casais: { a: string; b: string; confirmado: boolean }[];
  lideres: { setor: string; nome: string; papel: string; telefone: string | null }[];
  cultos: Culto[];
  vetados: { data: string; setor: string; subfuncao: string; nome: string; motivo: string }[];
}

function lerJson<T>(arquivo: string): T {
  const caminho = path.join(DIR!, arquivo);
  try {
    return JSON.parse(readFileSync(caminho, "utf8")) as T;
  } catch (e) {
    console.error(
      `não consegui ler ${caminho}: ${(e as Error).message}\n` +
        `Gere os dois JSON primeiro:\n` +
        `  python motor/exportar_regras.py\n` +
        `  python motor/exportar_dados.py`,
    );
    process.exit(2);
  }
}

// ── Início ──────────────────────────────────────────────────────────────────

const regras = lerJson<Regras>("regras.json");
const dados = lerJson<Dados>("dados.json");

/**
 * Todo nome citado por uma regra existe no cadastro que veio no mesmo export?
 *
 * Roda ANTES de abrir conexão, e é por isso que ela confere contra
 * `dados.voluntarios` e não contra o banco: um nome errado precisa reprovar
 * antes de o primeiro voluntário ser gravado, não depois — importação abortada
 * no meio deixa metade das regras aplicadas, que é pior que nenhuma.
 *
 * A checagem é conservadora de propósito: um nome que exista no banco (alguém
 * cadastrado na tela) mas não neste export reprova. Regra e cadastro saem do
 * mesmo par de arquivos, então divergir aí é sinal de export velho — e o erro
 * barato é reprovar, não escalar a pessoa errada.
 */
function validarNomes(): string[] {
  const cadastro = new Set(dados.voluntarios.map((v) => v.nome));
  const faltando: string[] = [];
  const ver = (nome: string, contexto: string) => {
    if (!cadastro.has(nome)) faltando.push(`${contexto}: "${nome}"`);
  };

  for (const s of regras.setores) {
    for (const sub of s.subfuncoes) {
      const onde = `${s.nome}/${sub.nome || "-"}`;
      for (const campo of ["time_fixo", "prioridade", "pool_extra"] as const) {
        for (const nome of sub[campo]) ver(nome, `${onde} ${campo}`);
      }
    }
  }
  for (const nome of regras.reserva) ver(nome, "RESERVA");
  for (const a of dados.apelidos) ver(a.nome, `apelido "${a.apelido}"`);
  for (const c of dados.casais) {
    ver(c.a, "casal");
    ver(c.b, "casal");
  }
  for (const l of dados.lideres) ver(l.nome, `líder de ${l.setor}`);
  for (const c of dados.cultos) {
    for (const s of c.slots) if (s.nome) ver(s.nome, `${c.data} ${s.setor}`);
  }
  for (const v of dados.vetados) ver(v.nome, `veto em ${v.data} ${v.setor}`);
  return faltando;
}

/** Referência entre vagas que aponta para subfunção inexistente na ESTRUTURA. */
function validarReferencias(): string[] {
  const vagas = new Set(
    regras.setores.flatMap((s) => s.subfuncoes.map((sub) => `${s.nome}\u0000${sub.nome}`)),
  );
  const erros: string[] = [];
  for (const s of regras.setores) {
    for (const sub of s.subfuncoes) {
      for (const campo of ["mesmo_sexo_que", "conjuge_de"] as const) {
        const ref = sub[campo];
        if (ref && !vagas.has(`${ref[0]}\u0000${ref[1]}`)) {
          erros.push(
            `${s.nome}/${sub.nome || "-"} ${campo} aponta para ${ref[0]}/${ref[1]}, que não existe`,
          );
        }
      }
    }
  }
  return erros;
}

const problemasDeNome = [...validarNomes(), ...validarReferencias()];
if (problemasDeNome.length > 0) {
  console.error(
    `\n${problemasDeNome.length} regra(s) apontam para algo que não existe. NADA foi gravado.\n` +
      `Nome que não casa não dá erro no motor — só tira a pessoa da escala em silêncio.\n`,
  );
  for (const p of problemasDeNome) console.error(`  ✗ ${p}`);
  process.exit(1);
}

const totalSlotsJson = dados.cultos.reduce((n, c) => n + c.slots.length, 0);
console.info(
  `JSON conferido: ${dados.voluntarios.length} voluntários, ${regras.setores.length} setores, ` +
    `${dados.cultos.length} cultos, ${totalSlotsJson} slots — todas as regras resolvem.`,
);

if (DRY_RUN) {
  console.info("--dry-run: nada gravado, nenhuma conexão aberta.");
  process.exit(0);
}

const credenciais = credenciaisSupabaseDeTeste();
anunciarDestino("importar-escalas", credenciais);

const db: SupabaseClient = createClient(credenciais.url, credenciais.serviceRole, {
  auth: { persistSession: false },
});

/** Lança em erro do PostgREST — silêncio aqui é dado faltando depois. */
function ok<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`${onde}: ${r.error.message}`);
  if (r.data === null) throw new Error(`${onde}: resposta sem dados`);
  return r.data;
}

async function resolverOrg(): Promise<string> {
  const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ORG!);
  const q = db.from("organizations").select("id, display_name, slug");
  const r = ehUuid ? await q.eq("id", ORG!).maybeSingle() : await q.eq("slug", ORG!).maybeSingle();
  if (r.error) throw new Error(`organizations: ${r.error.message}`);
  if (!r.data)
    throw new Error(`organização "${ORG}" não existe (procurei por ${ehUuid ? "id" : "slug"})`);
  console.info(`organização: ${r.data.display_name} (${r.data.slug})`);
  return r.data.id as string;
}

async function importar() {
  const orgId = await resolverOrg();

  // ── 1. Voluntários ───────────────────────────────────────────────────────
  //
  // Primeiro de todos: cada regra depois daqui aponta para gente por nome, e
  // não há a quem apontar antes disto existir.
  const reserva = new Set(regras.reserva);
  const filasVoluntarios = dados.voluntarios.map((v) => ({
    organization_id: orgId,
    nome: v.nome,
    sexo: v.sexo,
    status: v.status,
    departamento: v.departamento,
    dias_permitidos: v.dias_permitidos,
    setores_bloqueados: v.setores_bloqueados,
    setores_permitidos: v.setores_permitidos,
    ausente_de: v.ausente_de,
    ausente_ate: v.ausente_ate,
    max_por_mes: v.max_por_mes,
    reserva: reserva.has(v.nome),
    telefone: v.telefone,
  }));

  if (!DRY_RUN) {
    ok(
      await db
        .from("escala_voluntarios")
        .upsert(filasVoluntarios, { onConflict: "organization_id,nome" })
        .select("id"),
      "upsert escala_voluntarios",
    );
  }

  const voluntarios = new Map<string, string>();
  for (const l of ok(
    await db.from("escala_voluntarios").select("id, nome").eq("organization_id", orgId),
    "select escala_voluntarios",
  ) as { id: string; nome: string }[]) {
    voluntarios.set(l.nome, l.id);
  }
  console.info(`voluntários: ${voluntarios.size}`);

  // Os nomes já foram conferidos contra o export antes de qualquer escrita
  // (validarNomes). O que sobra é o caso em que o upsert gravou menos linhas do
  // que mandei — e aí o mapa mentiria calado, com `undefined` virando `null`
  // numa coluna que aceita null.
  const semId = dados.voluntarios.filter((v) => !voluntarios.has(v.nome)).map((v) => v.nome);
  if (semId.length > 0) {
    throw new Error(
      `${semId.length} voluntário(s) não voltaram do banco depois do upsert: ${semId.slice(0, 5).join(", ")}`,
    );
  }

  // ── 2. Setores ───────────────────────────────────────────────────────────
  ok(
    await db
      .from("escala_setores")
      .upsert(
        regras.setores.map((s) => ({
          organization_id: orgId,
          nome: s.nome,
          posicao: s.posicao,
          nucleo: s.nucleo,
          dupla_decente: s.dupla_decente,
          casal_junto: s.casal_junto,
          so_casal: s.so_casal,
          pool_pequeno: s.pool_pequeno,
          externo: s.externo,
          rodizio_inverso_quinta: s.rodizio_inverso_quinta,
          reforco_se_off: s.reforco_se_off,
        })),
        { onConflict: "organization_id,nome" },
      )
      .select("id"),
    "upsert escala_setores",
  );

  const setores = new Map<string, string>();
  for (const l of ok(
    await db.from("escala_setores").select("id, nome").eq("organization_id", orgId),
    "select escala_setores",
  ) as { id: string; nome: string }[]) {
    setores.set(l.nome, l.id);
  }

  // ── 3. Subfunções ────────────────────────────────────────────────────────
  //
  // Duas passadas: `mesmo_sexo_que`/`conjuge_de` apontam para OUTRA subfunção,
  // que pode ainda não existir na primeira volta (Cozinha/Auxiliar aponta para
  // Cozinha/Cozinheiro).
  const filasSub = regras.setores.flatMap((s) =>
    s.subfuncoes.map((sub) => ({
      organization_id: orgId,
      setor_id: setores.get(s.nome)!,
      nome: sub.nome,
      qtd: sub.qtd,
      posicao: sub.posicao,
      qtd_por_dia: sub.qtd_por_dia,
      time_fixo: sub.time_fixo.map((n) => voluntarios.get(n)!),
      prioridade: sub.prioridade.map((n) => voluntarios.get(n)!),
      pool_extra: sub.pool_extra.map((n) => voluntarios.get(n)!),
      por_frequencia: sub.por_frequencia,
      max_do_grupo: sub.max_do_grupo,
      dupla_decente: sub.dupla_decente,
      casal_junto: sub.casal_junto,
    })),
  );
  if (filasSub.length > 0) {
    ok(
      await db
        .from("escala_subfuncoes")
        .upsert(filasSub, { onConflict: "setor_id,nome" })
        .select("id"),
      "upsert escala_subfuncoes",
    );
  }

  const subfuncoes = new Map<string, string>(); // "SETOR\u0000subfunção" → uuid
  for (const l of ok(
    await db
      .from("escala_subfuncoes")
      .select("id, nome, escala_setores!inner(nome)")
      .eq("organization_id", orgId),
    "select escala_subfuncoes",
  ) as { id: string; nome: string; escala_setores: { nome: string } }[]) {
    subfuncoes.set(`${l.escala_setores.nome}\u0000${l.nome}`, l.id);
  }
  const chaveSub = (setor: string, sub: string) => `${setor}\u0000${sub}`;

  // 2ª passada: as referências entre vagas.
  for (const s of regras.setores) {
    for (const sub of s.subfuncoes) {
      if (!sub.mesmo_sexo_que && !sub.conjuge_de) continue;
      const alvo = (ref: [string, string] | null) =>
        ref ? (subfuncoes.get(chaveSub(ref[0], ref[1])) ?? null) : null;
      ok(
        await db
          .from("escala_subfuncoes")
          .update({
            mesmo_sexo_que_id: alvo(sub.mesmo_sexo_que),
            conjuge_de_id: alvo(sub.conjuge_de),
          })
          .eq("id", subfuncoes.get(chaveSub(s.nome, sub.nome))!)
          .select("id"),
        `update referências de ${s.nome}/${sub.nome}`,
      );
    }
  }
  console.info(`setores: ${setores.size}, subfunções: ${subfuncoes.size}`);

  // ── 4. Apelidos, casais, líderes ─────────────────────────────────────────
  if (dados.apelidos.length > 0) {
    ok(
      await db
        .from("escala_apelidos")
        .upsert(
          dados.apelidos.map((a) => ({
            organization_id: orgId,
            apelido: a.apelido,
            voluntario_id: voluntarios.get(a.nome)!,
            setor: a.setor,
          })),
          { onConflict: "organization_id,apelido,setor" },
        )
        .select("id"),
      "upsert escala_apelidos",
    );
  }

  // O par é não ordenado — o unique é sobre least/greatest, que o PostgREST não
  // sabe usar como `onConflict`. Apagar e reinserir é o caminho curto e deixa o
  // estado igual ao dos CSV, que são a fonte.
  ok(
    await db.from("escala_casais").delete().eq("organization_id", orgId).select("id"),
    "delete escala_casais",
  );
  if (dados.casais.length > 0) {
    ok(
      await db
        .from("escala_casais")
        .insert(
          dados.casais.map((c) => ({
            organization_id: orgId,
            voluntario_a: voluntarios.get(c.a)!,
            voluntario_b: voluntarios.get(c.b)!,
            confirmado: c.confirmado,
          })),
        )
        .select("id"),
      "insert escala_casais",
    );
  }

  // Líder de setor que não está na ESTRUTURA (`PASTOR`, `GERAL` no lideres.csv)
  // entra com setor_id NULL = liderança da igreja inteira (migration 0146). É
  // quem recebe o aviso de ausência quando o setor não tem líder próprio.
  ok(
    await db.from("escala_lideres").delete().eq("organization_id", orgId).select("id"),
    "delete escala_lideres",
  );
  if (dados.lideres.length > 0) {
    const semSetor = dados.lideres.filter((l) => !setores.has(l.setor));
    if (semSetor.length > 0) {
      console.info(
        `liderança geral (sem setor na estrutura): ` +
          semSetor.map((l) => `${l.nome} [${l.setor}]`).join(", "),
      );
    }
    ok(
      await db
        .from("escala_lideres")
        .insert(
          dados.lideres.map((l) => ({
            organization_id: orgId,
            setor_id: setores.get(l.setor) ?? null,
            voluntario_id: voluntarios.get(l.nome)!,
            papel: l.papel,
          })),
        )
        .select("id"),
      "insert escala_lideres",
    );
  }
  console.info(
    `apelidos: ${dados.apelidos.length}, casais: ${dados.casais.length}, ` +
      `líderes: ${dados.lideres.length}`,
  );

  // ── 5. Cultos, setores OFF e slots ───────────────────────────────────────
  ok(
    await db
      .from("escala_cultos")
      .upsert(
        dados.cultos.map((c) => ({
          organization_id: orgId,
          data: c.data,
          dia_semana: c.dia_semana,
          hora: c.hora,
          rodada_data: c.rodada_data,
          status: c.status,
        })),
        { onConflict: "organization_id,data" },
      )
      .select("id"),
    "upsert escala_cultos",
  );

  const cultos = new Map<string, string>();
  for (const l of ok(
    await db.from("escala_cultos").select("id, data").eq("organization_id", orgId),
    "select escala_cultos",
  ) as { id: string; data: string }[]) {
    cultos.set(l.data, l.id);
  }

  // Vetos: quem a liderança TIROU daquela vaga.
  //
  // Subfunção VAZIA num setor que TEM subfunções não é a vaga sem nome — é veto
  // no setor inteiro naquele culto. É assim que o `rejeitados.csv` registra
  // "Gustavo fora dos Atalaias no 27/09" e "Andressa, Andreza e Regina fora do
  // Boas Vindas no 20/09": a liderança tirou a pessoa do setor, não de uma
  // subfunção específica. Casar só por (data, setor, subfunção) descartava cinco
  // dos oito vetos sem dizer nada, e o motor recolocaria essa gente na próxima
  // geração — a correção da liderança se perderia calada.
  const vetosPorVaga = new Map<string, string[]>();
  const vetosPorSetor = new Map<string, string[]>();
  for (const v of dados.vetados) {
    const id = voluntarios.get(v.nome)!;
    const alvo = v.subfuncao ? vetosPorVaga : vetosPorSetor;
    const k = v.subfuncao
      ? `${v.data}\u0000${v.setor}\u0000${v.subfuncao}`
      : `${v.data}\u0000${v.setor}`;
    alvo.set(k, [...(alvo.get(k) ?? []), id]);
  }
  /** Quantos slots cada veto alcançou — zero é erro, não detalhe. */
  const vetosAplicados = new Map<string, number>();

  let totalSlots = 0;
  for (const c of dados.cultos) {
    const cultoId = cultos.get(c.data)!;

    // Substituir, não somar: importar duas vezes não pode duplicar a escala.
    ok(
      await db.from("escala_slots").delete().eq("culto_id", cultoId).select("id"),
      `delete slots de ${c.data}`,
    );
    ok(
      await db.from("escala_setor_off").delete().eq("culto_id", cultoId).select("id"),
      `delete setores off de ${c.data}`,
    );

    const off = c.setores_off.filter((o) => setores.has(o.setor));
    if (off.length > 0) {
      ok(
        await db
          .from("escala_setor_off")
          .insert(
            off.map((o) => ({
              organization_id: orgId,
              culto_id: cultoId,
              setor_id: setores.get(o.setor)!,
              motivo: o.motivo,
            })),
          )
          .select("id"),
        `insert setores off de ${c.data}`,
      );
    }

    // Setor de slot que não está na ESTRUTURA nem em IGNORAR (departamento que
    // apareceu só na escala real) nasce aqui como setor externo: descartar a
    // linha apagaria história de quem serviu.
    for (const s of c.slots) {
      if (setores.has(s.setor)) continue;
      const criado = ok(
        await db
          .from("escala_setores")
          .upsert(
            {
              organization_id: orgId,
              nome: s.setor,
              posicao: 900,
              externo: true,
            },
            { onConflict: "organization_id,nome" },
          )
          .select("id")
          .single(),
        `criar setor externo ${s.setor}`,
      );
      setores.set(s.setor, (criado as { id: string }).id);
      console.info(`setor externo criado a partir da escala real: ${s.setor}`);
    }

    const filas = c.slots.map((s, i) => {
      const subId = subfuncoes.get(chaveSub(s.setor, s.subfuncao)) ?? null;
      const kVaga = `${c.data}\u0000${s.setor}\u0000${s.subfuncao}`;
      const kSetor = `${c.data}\u0000${s.setor}`;
      const daVaga = vetosPorVaga.get(kVaga) ?? [];
      const doSetor = vetosPorSetor.get(kSetor) ?? [];
      if (daVaga.length > 0) vetosAplicados.set(kVaga, (vetosAplicados.get(kVaga) ?? 0) + 1);
      if (doSetor.length > 0) vetosAplicados.set(kSetor, (vetosAplicados.get(kSetor) ?? 0) + 1);
      const vetos = [...new Set([...daVaga, ...doSetor])];
      return {
        organization_id: orgId,
        culto_id: cultoId,
        setor_id: setores.get(s.setor)!,
        subfuncao_id: subId,
        voluntario_id: s.nome ? voluntarios.get(s.nome)! : null,
        origem: s.origem,
        motivo: s.motivo,
        vetados: vetos,
        posicao: i,
      };
    });
    if (filas.length > 0) {
      ok(await db.from("escala_slots").insert(filas).select("id"), `insert slots de ${c.data}`);
      totalSlots += filas.length;
    }
  }
  // Veto que não alcançou slot nenhum é correção da liderança indo para o lixo:
  // o motor recoloca a pessoa na próxima geração e ninguém fica sabendo.
  const vetosPerdidos = [...vetosPorVaga.keys(), ...vetosPorSetor.keys()].filter(
    (k) => !vetosAplicados.has(k),
  );
  if (vetosPerdidos.length > 0) {
    throw new Error(
      `${vetosPerdidos.length} veto(s) não alcançaram nenhuma vaga: ` +
        vetosPerdidos.map((k) => k.split("\u0000").join("/")).join(", "),
    );
  }
  console.info(
    `cultos: ${dados.cultos.length}, slots: ${totalSlots}, ` +
      `vetos aplicados: ${vetosAplicados.size}/${vetosPorVaga.size + vetosPorSetor.size} vagas`,
  );

  // ── 6. Config ────────────────────────────────────────────────────────────
  const filasConfig = Object.entries(regras.config).map(([chave, valor]) => ({
    organization_id: orgId,
    chave,
    valor,
  }));
  ok(
    await db
      .from("escala_config")
      .upsert(filasConfig, { onConflict: "organization_id,chave" })
      .select("chave"),
    "upsert escala_config",
  );
  console.info(`config: ${filasConfig.length} chaves`);
}

importar().catch((e: Error) => {
  console.error(`\nimportação falhou: ${e.message}`);
  process.exit(1);
});
