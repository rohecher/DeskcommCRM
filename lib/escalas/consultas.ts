/**
 * As leituras das TELAS de escala.
 *
 * Separado de `repo.ts` de propósito: aquele monta a entrada do motor (histórico
 * inteiro, perfis, pesos) e é caro; estas respondem perguntas de tela ("o que vai
 * ter no culto de domingo?", "quem está suspenso?") e precisam ser baratas.
 * Misturar os dois faria a tela de voluntários carregar 4.970 registros de
 * histórico para mostrar uma lista de nomes.
 *
 * Todas recebem o client de quem está olhando. Com o client do servidor a RLS já
 * restringe à organização; o filtro `organization_id` explícito é defesa em
 * profundidade, no padrão do resto do repo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { hojeIso, limitesDoMes, tipoDoCulto, type Mes, type TipoDeCulto } from "./mes";

/** Lança em erro do PostgREST — tela que erra em silêncio mostra dado incompleto. */
function ok<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`escalas/consultas ${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/**
 * Join embutido do PostgREST, normalizado.
 *
 * `select("…, escala_setores(nome)")` devolve OBJETO quando a relação é para um
 * só registro, mas sem schema tipado o supabase-js infere array — e em algumas
 * versões devolve array mesmo. Ler `.nome` direto funciona em teste e volta
 * `undefined` em produção, o que na tela aparece como campo vazio, não como erro.
 */
function um<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Relação embutida como o supabase-js a tipa sem schema. */
type Embutido<T> = T | T[] | null;

/**
 * Lê TODAS as linhas, de 1.000 em 1.000.
 *
 * O PostgREST do Supabase devolve no máximo 1.000 linhas por requisição, sem
 * erro nenhum: a resposta só vem cortada. O histórico tem mais de 5.000
 * registros, e lê-lo numa chamada só fazia a tela de voluntários contar uma
 * fração dele — "última vez: out/2025" para quem serviu na semana passada.
 */
async function todas<T>(
  pagina: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  onde: string,
): Promise<T[]> {
  const TAM = 1000;
  const linhas: T[] = [];
  for (let de = 0; ; de += TAM) {
    const lote = ok(await pagina(de, de + TAM - 1), onde) as T[];
    linhas.push(...lote);
    if (lote.length < TAM) return linhas;
  }
}

export interface CultoResumo {
  id: string;
  data: string;
  diaSemana: string;
  hora: string | null;
  rodadaData: string;
  status: string;
  vagas: number;
  abertas: number;
  setoresOff: number;
}

/**
 * Os cultos, do mais recente para o mais antigo.
 *
 * `abertas` conta vaga sem nome, e a tela mostra esse número em destaque: a
 * liderança pediu que a vaga apareça vazia justamente para ser vista. Um card
 * que só mostrasse "42 escalados" esconderia o que falta.
 */
export async function listarCultos(
  db: SupabaseClient,
  organizationId: string,
  limite = 24,
): Promise<CultoResumo[]> {
  const cultos = ok(
    await db
      .from("escala_cultos")
      .select("id, data, dia_semana, hora, rodada_data, status")
      .eq("organization_id", organizationId)
      .order("data", { ascending: false })
      .limit(limite),
    "cultos",
  ) as {
    id: string;
    data: string;
    dia_semana: string;
    hora: string | null;
    rodada_data: string;
    status: string;
  }[];
  if (cultos.length === 0) return [];

  const ids = cultos.map((c) => c.id);
  const slots = ok(
    await db
      .from("escala_slots")
      .select("culto_id, voluntario_id")
      .eq("organization_id", organizationId)
      .in("culto_id", ids),
    "slots",
  ) as { culto_id: string; voluntario_id: string | null }[];
  const offs = ok(
    await db
      .from("escala_setor_off")
      .select("culto_id")
      .eq("organization_id", organizationId)
      .in("culto_id", ids),
    "setor_off",
  ) as { culto_id: string }[];

  return cultos.map((c) => {
    const meus = slots.filter((s) => s.culto_id === c.id);
    return {
      id: c.id,
      data: c.data,
      diaSemana: c.dia_semana,
      hora: c.hora,
      rodadaData: c.rodada_data,
      status: c.status,
      vagas: meus.length,
      abertas: meus.filter((s) => !s.voluntario_id).length,
      setoresOff: offs.filter((o) => o.culto_id === c.id).length,
    };
  });
}

export interface VagaNaTela {
  setor: string;
  subfuncao: string;
  nome: string | null;
  origem: string;
  motivo: string;
  posicao: number;
}

export interface CultoDetalhe {
  culto: CultoResumo;
  /** Setor → vagas, na ordem em que a escala foi montada. */
  porSetor: { setor: string; off: string | null; vagas: VagaNaTela[] }[];
}

/** A escala de um culto, agrupada por setor, incluindo os setores desligados. */
export async function escalaDoCulto(
  db: SupabaseClient,
  organizationId: string,
  dataIso: string,
): Promise<CultoDetalhe | null> {
  const culto = (
    await db
      .from("escala_cultos")
      .select("id, data, dia_semana, hora, rodada_data, status")
      .eq("organization_id", organizationId)
      .eq("data", dataIso)
      .maybeSingle()
  ).data as {
    id: string;
    data: string;
    dia_semana: string;
    hora: string | null;
    rodada_data: string;
    status: string;
  } | null;
  if (!culto) return null;

  const slots = ok(
    await db
      .from("escala_slots")
      .select(
        "posicao, origem, motivo, voluntario_id, escala_setores!inner(nome, posicao), escala_subfuncoes(nome), escala_voluntarios(nome)",
      )
      .eq("organization_id", organizationId)
      .eq("culto_id", culto.id)
      .order("posicao"),
    "slots do culto",
  ) as {
    posicao: number;
    origem: string;
    motivo: string;
    voluntario_id: string | null;
    escala_setores: Embutido<{ nome: string; posicao: number }>;
    escala_subfuncoes: Embutido<{ nome: string }>;
    escala_voluntarios: Embutido<{ nome: string }>;
  }[];

  const offs = ok(
    await db
      .from("escala_setor_off")
      .select("motivo, escala_setores!inner(nome)")
      .eq("organization_id", organizationId)
      .eq("culto_id", culto.id),
    "off do culto",
  ) as { motivo: string; escala_setores: Embutido<{ nome: string }> }[];
  const offPorSetor = new Map(
    offs.flatMap((o) => {
      const setor = um(o.escala_setores);
      return setor ? [[setor.nome, o.motivo] as const] : [];
    }),
  );

  const grupos = new Map<string, VagaNaTela[]>();
  const ordemSetor = new Map<string, number>();
  for (const s of slots) {
    const setor = um(s.escala_setores)?.nome;
    if (!setor) continue;
    ordemSetor.set(setor, Math.min(ordemSetor.get(setor) ?? 9999, s.posicao));
    const lista = grupos.get(setor) ?? [];
    lista.push({
      setor,
      subfuncao: um(s.escala_subfuncoes)?.nome ?? "",
      nome: um(s.escala_voluntarios)?.nome ?? null,
      origem: s.origem,
      motivo: s.motivo,
      posicao: s.posicao,
    });
    grupos.set(setor, lista);
  }
  // Setor OFF pode não ter slot nenhum; ele precisa aparecer na tela dizendo que
  // está desligado, senão a equipe daquele setor não sabe que não é escala dela.
  for (const setor of offPorSetor.keys()) if (!grupos.has(setor)) grupos.set(setor, []);

  const porSetor = [...grupos.entries()]
    .sort((a, b) => (ordemSetor.get(a[0]) ?? 9999) - (ordemSetor.get(b[0]) ?? 9999))
    .map(([setor, vagas]) => ({ setor, off: offPorSetor.get(setor) ?? null, vagas }));

  return {
    culto: {
      id: culto.id,
      data: culto.data,
      diaSemana: culto.dia_semana,
      hora: culto.hora,
      rodadaData: culto.rodada_data,
      status: culto.status,
      vagas: slots.length,
      abertas: slots.filter((s) => !s.voluntario_id).length,
      setoresOff: offs.length,
    },
    porSetor,
  };
}

export interface VagaDoMes extends VagaNaTela {
  /** Id do slot — é o que a janela de edição recebe. */
  id: string;
  /** Ordem do SETOR na estrutura — a tabela do mês alinha as linhas por ela. */
  setorPosicao: number;
}

export interface CultoDoMes {
  culto: CultoResumo;
  tipo: TipoDeCulto;
  /** Setor → vagas, na ordem da estrutura. Setor desligado vem com `off`. */
  porSetor: { setor: string; off: string | null; vagas: VagaDoMes[] }[];
}

/**
 * Os cultos de um mês, em ORDEM DE DATA, já com as vagas.
 *
 * É a leitura da tela mensal: cards e tabela saem da mesma resposta. Três
 * requisições no total, não uma por culto — um mês tem de 8 a 13 encontros, e
 * abrir um por um deixaria a tela esperando em série.
 */
export async function escalaDoMes(
  db: SupabaseClient,
  organizationId: string,
  mes: Mes,
): Promise<CultoDoMes[]> {
  const { inicio, fim } = limitesDoMes(mes);
  const cultos = ok(
    await db
      .from("escala_cultos")
      .select("id, data, dia_semana, hora, rodada_data, status")
      .eq("organization_id", organizationId)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: true }),
    "cultos do mes",
  ) as {
    id: string;
    data: string;
    dia_semana: string;
    hora: string | null;
    rodada_data: string;
    status: string;
  }[];
  if (cultos.length === 0) return [];

  const ids = cultos.map((c) => c.id);
  const [slots, offs] = await Promise.all([
    todas<{
      id: string;
      culto_id: string;
      posicao: number;
      origem: string;
      motivo: string;
      voluntario_id: string | null;
      escala_setores: Embutido<{ nome: string; posicao: number }>;
      escala_subfuncoes: Embutido<{ nome: string }>;
      escala_voluntarios: Embutido<{ nome: string }>;
    }>(
      (de, ate) =>
        db
          .from("escala_slots")
          .select(
            "id, culto_id, posicao, origem, motivo, voluntario_id, escala_setores!inner(nome, posicao), escala_subfuncoes(nome), escala_voluntarios(nome)",
          )
          .eq("organization_id", organizationId)
          .in("culto_id", ids)
          .order("culto_id")
          .order("posicao")
          // Desempate estável: sem ele, duas vagas com a mesma posição podem
          // trocar de página entre requisições e uma delas sumir da tela.
          .order("id")
          .range(de, ate),
      "slots do mes",
    ),
    todas<{ culto_id: string; motivo: string; escala_setores: Embutido<{ nome: string; posicao: number }> }>(
      (de, ate) =>
        db
          .from("escala_setor_off")
          .select("culto_id, motivo, escala_setores!inner(nome, posicao)")
          .eq("organization_id", organizationId)
          .in("culto_id", ids)
          .order("culto_id")
          .range(de, ate),
      "off do mes",
    ),
  ]);

  return cultos.map((c) => {
    const meus = slots.filter((s) => s.culto_id === c.id);
    const meusOff = offs.filter((o) => o.culto_id === c.id);

    const grupos = new Map<string, { off: string | null; posicao: number; vagas: VagaDoMes[] }>();
    for (const s of meus) {
      const setor = um(s.escala_setores);
      if (!setor) continue;
      const g = grupos.get(setor.nome) ?? { off: null, posicao: setor.posicao, vagas: [] };
      g.vagas.push({
        id: s.id,
        setor: setor.nome,
        setorPosicao: setor.posicao,
        subfuncao: um(s.escala_subfuncoes)?.nome ?? "",
        nome: um(s.escala_voluntarios)?.nome ?? null,
        origem: s.origem,
        motivo: s.motivo,
        posicao: s.posicao,
      });
      grupos.set(setor.nome, g);
    }
    // Setor desligado aparece mesmo sem vaga: a equipe dele precisa ler que não
    // é escala dela, e não concluir que foi esquecida.
    for (const o of meusOff) {
      const setor = um(o.escala_setores);
      if (!setor) continue;
      const g = grupos.get(setor.nome) ?? { off: null, posicao: setor.posicao, vagas: [] };
      g.off = o.motivo;
      grupos.set(setor.nome, g);
    }

    const porSetor = [...grupos.entries()]
      .sort((a, b) => a[1].posicao - b[1].posicao || a[0].localeCompare(b[0], "pt-BR"))
      .map(([setor, g]) => ({
        setor,
        off: g.off,
        vagas: g.vagas.sort((a, b) => a.posicao - b.posicao),
      }));

    return {
      culto: {
        id: c.id,
        data: c.data,
        diaSemana: c.dia_semana,
        hora: c.hora,
        rodadaData: c.rodada_data,
        status: c.status,
        vagas: meus.length,
        abertas: meus.filter((s) => !s.voluntario_id).length,
        setoresOff: meusOff.length,
      },
      tipo: tipoDoCulto(meus.map((s) => s.origem)),
      porSetor,
    };
  });
}

export interface VoluntarioNaTela {
  id: string;
  nome: string;
  status: string;
  sexo: string | null;
  departamento: string;
  telefone: string | null;
  reserva: boolean;
  ausenteDe: string | null;
  ausenteAte: string | null;
  maxPorMes: number | null;
  conjuge: string | null;
  /** Setores que a pessoa lidera (papel começando em LIDER ou não — a tela mostra o papel). */
  lideranca: { setor: string | null; papel: string }[];
  /** Vezes no histórico e a última competência em que serviu. */
  vezes: number;
  ultima: string | null;
}

/**
 * O cadastro, com o que a liderança precisa para decidir.
 *
 * `vezes` e `ultima` vêm de uma agregação do histórico — e não do histórico
 * inteiro carregado em memória. A tela responde "quem está parado?", que é a
 * pergunta que antecede "quem eu chamo?".
 */
export async function listarVoluntarios(
  db: SupabaseClient,
  organizationId: string,
): Promise<VoluntarioNaTela[]> {
  // As quatro leituras em paralelo: `Promise.all` sobre as PROMESSAS, não sobre
  // `ok(await …)` — aquilo resolveria uma a uma e o paralelismo seria decorativo.
  const [rVols, rCasais, rLideres, hist, servidos] = await Promise.all([
    db
      .from("escala_voluntarios")
      .select(
        "id, nome, status, sexo, departamento, telefone, reserva, ausente_de, ausente_ate, max_por_mes",
      )
      .eq("organization_id", organizationId)
      .order("nome"),
    db
      .from("escala_casais")
      .select("voluntario_a, voluntario_b, confirmado")
      .eq("organization_id", organizationId),
    db
      .from("escala_lideres")
      .select("voluntario_id, papel, escala_setores(nome)")
      .eq("organization_id", organizationId),
    todas<{ voluntario_id: string; ano: number; mes: number }>(
      (de, ate) =>
        db
          .from("escala_historico")
          .select("voluntario_id, ano, mes")
          .eq("organization_id", organizationId)
          .order("id")
          .range(de, ate),
      "historico",
    ),
    // Os cultos do Cajado que já aconteceram também contam para a "última vez":
    // quem serviu na semana passada precisa aparecer assim, e não pelo mês em que
    // o histórico importado parou.
    todas<{ voluntario_id: string; escala_cultos: Embutido<{ data: string }> }>(
      (de, ate) =>
        db
          .from("escala_slots")
          .select("voluntario_id, escala_cultos!inner(data)")
          .eq("organization_id", organizationId)
          .not("voluntario_id", "is", null)
          .lte("escala_cultos.data", hojeIso())
          .order("id")
          .range(de, ate),
      "slots servidos",
    ),
  ]);
  const vols = ok(rVols, "voluntarios");
  const casais = ok(rCasais, "casais");
  const lideres = ok(rLideres, "lideres");

  const linhas = vols as {
    id: string;
    nome: string;
    status: string;
    sexo: string | null;
    departamento: string;
    telefone: string | null;
    reserva: boolean;
    ausente_de: string | null;
    ausente_ate: string | null;
    max_por_mes: number | null;
  }[];
  const nomeDoId = new Map(linhas.map((v) => [v.id, v.nome]));

  const conjugeDe = new Map<string, string>();
  for (const c of casais as { voluntario_a: string; voluntario_b: string; confirmado: boolean }[]) {
    if (!c.confirmado) continue;
    const a = nomeDoId.get(c.voluntario_a);
    const b = nomeDoId.get(c.voluntario_b);
    if (a && b) {
      conjugeDe.set(c.voluntario_a, b);
      conjugeDe.set(c.voluntario_b, a);
    }
  }

  const lideranca = new Map<string, { setor: string | null; papel: string }[]>();
  for (const l of lideres as {
    voluntario_id: string;
    papel: string;
    escala_setores: Embutido<{ nome: string }>;
  }[]) {
    const lista = lideranca.get(l.voluntario_id) ?? [];
    lista.push({ setor: um(l.escala_setores)?.nome ?? null, papel: l.papel });
    lideranca.set(l.voluntario_id, lista);
  }

  const vezes = new Map<string, number>();
  const ultima = new Map<string, string>();
  const marcar = (id: string, comp: string) => {
    const atual = ultima.get(id);
    if (!atual || comp > atual) ultima.set(id, comp);
  };
  for (const h of hist) {
    vezes.set(h.voluntario_id, (vezes.get(h.voluntario_id) ?? 0) + 1);
    marcar(h.voluntario_id, `${h.ano}-${String(h.mes).padStart(2, "0")}`);
  }
  // Dos cultos do Cajado sai só a "última vez". `vezes` segue sendo o histórico:
  // as escalas importadas também estão nele, e somar as duas fontes contaria o
  // mesmo culto duas vezes.
  for (const s of servidos) {
    const data = um(s.escala_cultos)?.data;
    if (data) marcar(s.voluntario_id, data.slice(0, 7));
  }

  return linhas.map((v) => ({
    id: v.id,
    nome: v.nome,
    status: v.status,
    sexo: v.sexo,
    departamento: v.departamento,
    telefone: v.telefone,
    reserva: v.reserva,
    ausenteDe: v.ausente_de,
    ausenteAte: v.ausente_ate,
    maxPorMes: v.max_por_mes,
    conjuge: conjugeDe.get(v.id) ?? null,
    lideranca: lideranca.get(v.id) ?? [],
    vezes: vezes.get(v.id) ?? 0,
    ultima: ultima.get(v.id) ?? null,
  }));
}

export interface SubfuncaoNaTela {
  nome: string;
  qtd: number;
  qtdPorDia: Record<string, number>;
  timeFixo: string[];
  prioridade: string[];
  poolExtra: string[];
  porFrequencia: boolean;
  maxDoGrupo: number | null;
  duplaDecente: boolean;
  casalJunto: boolean;
  mesmoSexoQue: string | null;
  conjugeDe: string | null;
}

export interface SetorNaTela {
  nome: string;
  posicao: number;
  nucleo: boolean;
  duplaDecente: boolean;
  casalJunto: boolean;
  soCasal: boolean;
  poolPequeno: boolean;
  externo: boolean;
  ativo: boolean;
  reforcoSeOff: { setor: string; subfuncao: string; qtd: number }[];
  lideres: string[];
  subfuncoes: SubfuncaoNaTela[];
}

/** A estrutura: setores, subfunções, quantidades e as regras de cada vaga. */
export async function listarSetores(
  db: SupabaseClient,
  organizationId: string,
): Promise<SetorNaTela[]> {
  const [rSetores, rSubs, rVols, rLideres] = await Promise.all([
    db
      .from("escala_setores")
      .select(
        "id, nome, posicao, nucleo, dupla_decente, casal_junto, so_casal, pool_pequeno, externo, ativo, reforco_se_off",
      )
      .eq("organization_id", organizationId)
      .order("posicao")
      .order("nome"),
    db
      .from("escala_subfuncoes")
      .select(
        "id, setor_id, nome, qtd, qtd_por_dia, posicao, time_fixo, prioridade, pool_extra, por_frequencia, max_do_grupo, dupla_decente, casal_junto, mesmo_sexo_que_id, conjuge_de_id",
      )
      .eq("organization_id", organizationId)
      .order("posicao")
      .order("nome"),
    db.from("escala_voluntarios").select("id, nome").eq("organization_id", organizationId),
    db
      .from("escala_lideres")
      .select("setor_id, papel, escala_voluntarios(nome)")
      .eq("organization_id", organizationId),
  ]);
  const setores = ok(rSetores, "setores");
  const subs = ok(rSubs, "subfuncoes");
  const vols = ok(rVols, "voluntarios");
  const lideres = ok(rLideres, "lideres");

  const nomeDoId = new Map(
    (vols as { id: string; nome: string }[]).map((v) => [v.id, v.nome] as const),
  );
  const nomes = (ids: string[] | null) =>
    (ids ?? []).map((id) => nomeDoId.get(id)).filter((n): n is string => Boolean(n));

  const linhasSub = subs as {
    id: string;
    setor_id: string;
    nome: string;
    qtd: number;
    qtd_por_dia: Record<string, number>;
    time_fixo: string[];
    prioridade: string[];
    pool_extra: string[];
    por_frequencia: boolean;
    max_do_grupo: number | null;
    dupla_decente: boolean;
    casal_junto: boolean;
    mesmo_sexo_que_id: string | null;
    conjuge_de_id: string | null;
  }[];
  const linhasSetor = setores as {
    id: string;
    nome: string;
    posicao: number;
    nucleo: boolean;
    dupla_decente: boolean;
    casal_junto: boolean;
    so_casal: boolean;
    pool_pequeno: boolean;
    externo: boolean;
    ativo: boolean;
    reforco_se_off: { setor: string; subfuncao: string; qtd: number }[];
  }[];

  const setorDoId = new Map(linhasSetor.map((s) => [s.id, s.nome] as const));
  const rotuloDaVaga = (id: string | null): string | null => {
    if (!id) return null;
    const sub = linhasSub.find((x) => x.id === id);
    if (!sub) return null;
    const setor = setorDoId.get(sub.setor_id) ?? "?";
    return sub.nome ? `${setor} / ${sub.nome}` : setor;
  };

  const lideresPorSetor = new Map<string, string[]>();
  for (const l of lideres as {
    setor_id: string | null;
    papel: string;
    escala_voluntarios: Embutido<{ nome: string }>;
  }[]) {
    const quem = um(l.escala_voluntarios);
    if (!l.setor_id || !quem) continue;
    const lista = lideresPorSetor.get(l.setor_id) ?? [];
    lista.push(`${quem.nome} (${l.papel})`);
    lideresPorSetor.set(l.setor_id, lista);
  }

  return linhasSetor.map((s) => ({
    nome: s.nome,
    posicao: s.posicao,
    nucleo: s.nucleo,
    duplaDecente: s.dupla_decente,
    casalJunto: s.casal_junto,
    soCasal: s.so_casal,
    poolPequeno: s.pool_pequeno,
    externo: s.externo,
    ativo: s.ativo,
    reforcoSeOff: s.reforco_se_off ?? [],
    lideres: lideresPorSetor.get(s.id) ?? [],
    subfuncoes: linhasSub
      .filter((x) => x.setor_id === s.id)
      .map((x) => ({
        nome: x.nome,
        qtd: x.qtd,
        qtdPorDia: x.qtd_por_dia ?? {},
        timeFixo: nomes(x.time_fixo),
        prioridade: nomes(x.prioridade),
        poolExtra: nomes(x.pool_extra),
        porFrequencia: x.por_frequencia,
        maxDoGrupo: x.max_do_grupo,
        duplaDecente: x.dupla_decente,
        casalJunto: x.casal_junto,
        mesmoSexoQue: rotuloDaVaga(x.mesmo_sexo_que_id),
        conjugeDe: rotuloDaVaga(x.conjuge_de_id),
      })),
  }));
}

/** As chaves de `escala_config`, para a tela de regras mostrar os pesos. */
export async function lerConfig(
  db: SupabaseClient,
  organizationId: string,
): Promise<{ chave: string; valor: unknown }[]> {
  return (
    ok(
      await db
        .from("escala_config")
        .select("chave, valor")
        .eq("organization_id", organizationId)
        .order("chave"),
      "config",
    ) as { chave: string; valor: unknown }[]
  ).slice();
}

export interface LinhaCobertura {
  nome: string;
  status: string;
  departamento: string;
  /** Competência (`2026-09`) → vezes que serviu. */
  porMes: Record<string, number>;
  total: number;
}

export interface Cobertura {
  /** Competências presentes, da mais recente para a mais antiga. */
  meses: string[];
  linhas: LinhaCobertura[];
  /** Ativos que não serviram em nenhum dos meses mostrados. */
  deFora: { nome: string; departamento: string; ultima: string | null }[];
}

/**
 * Quem serviu, mês a mês — e quem está ATIVO no cadastro e não apareceu.
 *
 * A segunda metade é o ponto da tela. A pergunta que a liderança fez foi
 * exatamente essa: "o legal agora é criar histórico base do cadastro x quem
 * serviu no mês; ex.: Roberto não foi escalado em setembro mas está ativo".
 * Uma tabela só de quem serviu não responde isso — quem ficou de fora não
 * aparece em lugar nenhum, e é justamente quem precisa ser chamado.
 */
export async function cobertura(
  db: SupabaseClient,
  organizationId: string,
  quantosMeses = 6,
): Promise<Cobertura> {
  const [rVols, registros] = await Promise.all([
    db
      .from("escala_voluntarios")
      .select("id, nome, status, departamento")
      .eq("organization_id", organizationId)
      .order("nome"),
    todas<{ voluntario_id: string; ano: number; mes: number }>(
      (de, ate) =>
        db
          .from("escala_historico")
          .select("voluntario_id, ano, mes")
          .eq("organization_id", organizationId)
          .order("id")
          .range(de, ate),
      "historico",
    ),
  ]);
  const vols = ok(rVols, "voluntarios");

  const linhasVol = vols as { id: string; nome: string; status: string; departamento: string }[];

  const comp = (r: { ano: number; mes: number }) => `${r.ano}-${String(r.mes).padStart(2, "0")}`;
  const todos = [...new Set(registros.map(comp))].sort().reverse();
  const meses = todos.slice(0, quantosMeses);
  const janela = new Set(meses);

  const porPessoa = new Map<string, Map<string, number>>();
  const ultimaDe = new Map<string, string>();
  for (const r of registros) {
    const c = comp(r);
    const atual = ultimaDe.get(r.voluntario_id);
    if (!atual || c > atual) ultimaDe.set(r.voluntario_id, c);
    if (!janela.has(c)) continue;
    const m = porPessoa.get(r.voluntario_id) ?? new Map<string, number>();
    m.set(c, (m.get(c) ?? 0) + 1);
    porPessoa.set(r.voluntario_id, m);
  }

  const linhas: LinhaCobertura[] = [];
  const deFora: Cobertura["deFora"] = [];
  for (const v of linhasVol) {
    const m = porPessoa.get(v.id);
    if (m && m.size > 0) {
      const porMes: Record<string, number> = {};
      let total = 0;
      for (const mes of meses) {
        const n = m.get(mes) ?? 0;
        porMes[mes] = n;
        total += n;
      }
      linhas.push({
        nome: v.nome,
        status: v.status,
        departamento: v.departamento,
        porMes,
        total,
      });
    } else if (v.status === "ATIVO") {
      deFora.push({
        nome: v.nome,
        departamento: v.departamento,
        ultima: ultimaDe.get(v.id) ?? null,
      });
    }
  }
  linhas.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

  return { meses, linhas, deFora };
}
