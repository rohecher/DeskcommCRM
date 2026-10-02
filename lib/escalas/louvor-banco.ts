/**
 * A escala do louvor colada: prévia e gravação.
 *
 * A leitura do texto e o reconhecimento de nomes moram em `louvor.ts` (puros).
 * Aqui só entra o banco: quem existe, quem já foi do louvor, que cultos já há
 * nas datas, quem ficaria em dois lugares — e, ao salvar, as vagas do louvor.
 *
 * O louvor é departamento EXTERNO: as vagas entram com `origem = 'externo'`, e
 * o motor tira essas pessoas da escala geral daquele culto. Por isso a prévia
 * avisa quem já está escalado em outro setor: se o culto ainda é rascunho, é só
 * montar de novo; se já foi publicado, a liderança troca à mão.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { bonito } from "./formato";
import {
  chaveDeApelido,
  lerEscalaDoLouvor,
  reconhecerNome,
  type BaseDeNomes,
  type NomeDigitado,
  type Pessoa,
  type Reconhecimento,
} from "./louvor";
import { diaDaSemanaIso } from "./mes";
import { montarConfig } from "./repo";
import { rodadaDe } from "./rodada";

const SETOR_DO_LOUVOR = "M. LOUVOR";
/** As vagas do louvor vêm depois das da escala geral na ordem do culto. */
const POSICAO_DO_LOUVOR = 1000;

function ok<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`escalas/louvor ${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

function um<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

async function setorDoLouvor(db: SupabaseClient, org: string): Promise<string> {
  const r = await db
    .from("escala_setores")
    .select("id")
    .eq("organization_id", org)
    .eq("nome", SETOR_DO_LOUVOR)
    .maybeSingle();
  const id = (r.data as { id: string } | null)?.id;
  if (!id) throw new Error(`escalas/louvor: o setor ${SETOR_DO_LOUVOR} não existe nesta organização`);
  return id;
}

/** Quem pode aparecer na escala do louvor e como reconhecê-lo. */
async function baseDeNomes(db: SupabaseClient, org: string, setorId: string): Promise<BaseDeNomes> {
  const [vols, apelidos, hist, slots] = await Promise.all([
    db
      .from("escala_voluntarios")
      .select("id, nome, status, departamento")
      .eq("organization_id", org)
      .order("nome")
      .then((r) => ok(r, "voluntarios") as { id: string; nome: string; status: string; departamento: string }[]),
    db
      .from("escala_apelidos")
      .select("apelido, setor, voluntario_id")
      .eq("organization_id", org)
      .then((r) => ok(r, "apelidos") as { apelido: string; setor: string; voluntario_id: string }[]),
    db
      .from("escala_historico")
      .select("voluntario_id")
      .eq("organization_id", org)
      .eq("setor", SETOR_DO_LOUVOR)
      .limit(1000)
      .then((r) => ok(r, "historico do louvor") as { voluntario_id: string }[]),
    db
      .from("escala_slots")
      .select("voluntario_id")
      .eq("organization_id", org)
      .eq("setor_id", setorId)
      .not("voluntario_id", "is", null)
      .limit(1000)
      .then((r) => ok(r, "vagas do louvor") as { voluntario_id: string }[]),
  ]);

  // Inativo não aparece: quem saiu não volta para a escala por um apelido velho.
  const ativos = vols.filter((v) => v.status !== "INATIVO");
  const doLouvor = new Set<string>([
    ...vols.filter((v) => /LOUVOR/.test(v.departamento)).map((v) => v.id),
    ...hist.map((h) => h.voluntario_id),
    ...slots.map((s) => s.voluntario_id),
  ]);
  const mapa = new Map<string, string>();
  // Apelido de outro setor ("Thiago@ESTACIONAMENTO") não vale no louvor.
  for (const a of apelidos) {
    if (a.setor && a.setor !== SETOR_DO_LOUVOR) continue;
    mapa.set(chaveDeApelido(a.apelido), a.voluntario_id);
  }
  return {
    pessoas: ativos.map((v) => ({ id: v.id, nome: v.nome })),
    apelidos: mapa,
    doLouvor,
    doDepartamento: new Set(vols.filter((v) => /LOUVOR/.test(v.departamento)).map((v) => v.id)),
  };
}

export interface NomeNaPrevia extends NomeDigitado {
  reconhecimento: Reconhecimento;
}

export interface BlocoNaPrevia {
  datas: { data: string; status: string | null; conflitos: { nome: string; onde: string }[] }[];
  oracao: boolean;
  paleta: string | null;
  itens: { funcao: string; rotulo: string; nomes: NomeNaPrevia[] }[];
}

export interface PreviaDoLouvor {
  blocos: BlocoNaPrevia[];
  ignoradas: string[];
  /** Para a lista de escolha: quem é do louvor vem primeiro. */
  pessoas: (Pessoa & { doLouvor: boolean })[];
}

export async function previaDoLouvor(
  db: SupabaseClient,
  org: string,
  texto: string,
  mes: string,
): Promise<PreviaDoLouvor> {
  const setorId = await setorDoLouvor(db, org);
  const base = await baseDeNomes(db, org, setorId);
  const { blocos, ignoradas } = lerEscalaDoLouvor(texto, mes);

  const todasAsDatas = [...new Set(blocos.flatMap((b) => b.datas))];
  const cultos = todasAsDatas.length
    ? (ok(
        await db
          .from("escala_cultos")
          .select("id, data, status")
          .eq("organization_id", org)
          .in("data", todasAsDatas),
        "cultos",
      ) as { id: string; data: string; status: string }[])
    : [];
  const cultoDaData = new Map(cultos.map((c) => [c.data, c]));

  // Quem já está na escala GERAL desses cultos: o conflito que a prévia mostra.
  const ocupadoEm = new Map<string, Map<string, string>>();
  if (cultos.length > 0) {
    const slots = ok(
      await db
        .from("escala_slots")
        .select("culto_id, voluntario_id, origem, escala_setores!inner(nome), escala_subfuncoes(nome)")
        .eq("organization_id", org)
        .in(
          "culto_id",
          cultos.map((c) => c.id),
        )
        .neq("origem", "externo")
        .not("voluntario_id", "is", null),
      "escala geral",
    ) as {
      culto_id: string;
      voluntario_id: string;
      escala_setores: { nome: string } | { nome: string }[] | null;
      escala_subfuncoes: { nome: string } | { nome: string }[] | null;
    }[];
    const dataDoCulto = new Map(cultos.map((c) => [c.id, c.data]));
    for (const s of slots) {
      const data = dataDoCulto.get(s.culto_id);
      if (!data) continue;
      const setor = um(s.escala_setores)?.nome ?? "";
      const sub = um(s.escala_subfuncoes)?.nome ?? "";
      const m = ocupadoEm.get(data) ?? new Map<string, string>();
      m.set(s.voluntario_id, sub ? `${bonito(sub)} (${bonito(setor).toLocaleLowerCase("pt-BR")})` : bonito(setor));
      ocupadoEm.set(data, m);
    }
  }

  const previa: BlocoNaPrevia[] = blocos.map((b) => {
    const itens = b.itens.map((i) => ({
      funcao: i.funcao,
      rotulo: bonito(i.funcao),
      nomes: i.nomes.map((n) => ({ ...n, reconhecimento: reconhecerNome(n, base) })),
    }));
    const reconhecidos = itens.flatMap((i) =>
      i.nomes.flatMap((n) =>
        n.reconhecimento.tipo === "certo" || n.reconhecimento.tipo === "aproximado" ? [n.reconhecimento.pessoa] : [],
      ),
    );
    return {
      oracao: b.oracao,
      paleta: b.paleta,
      itens,
      datas: b.datas.map((data) => ({
        data,
        status: cultoDaData.get(data)?.status ?? null,
        conflitos: reconhecidos.flatMap((p) => {
          const onde = ocupadoEm.get(data)?.get(p.id);
          return onde ? [{ nome: p.nome, onde }] : [];
        }),
      })),
    };
  });

  const pessoas = base.pessoas
    .map((p) => ({ ...p, doLouvor: base.doLouvor.has(p.id) }))
    .sort((a, b) => Number(b.doLouvor) - Number(a.doLouvor) || a.nome.localeCompare(b.nome, "pt-BR"));
  return { blocos: previa, ignoradas, pessoas };
}

export interface LouvorParaGravar {
  blocos: {
    datas: string[];
    paleta: string | null;
    itens: { funcao: string; pessoas: string[] }[];
  }[];
  /** O que a liderança confirmou à mão: "Rayssa" é a Rhayssa. Vira apelido. */
  apelidos: { apelido: string; voluntarioId: string }[];
}

/**
 * Grava a escala do louvor nas datas da mensagem.
 *
 * Por data: cria o culto se ainda não existe (em RASCUNHO — quem publica é a
 * liderança, junto com o resto do mês), troca as vagas do louvor daquele culto
 * pelas da mensagem e guarda a paleta. As vagas da escala geral não são tocadas.
 */
export async function gravarLouvor(
  db: SupabaseClient,
  org: string,
  entrada: LouvorParaGravar,
): Promise<{ cultos: number; vagas: number; apelidos: number }> {
  const setorId = await setorDoLouvor(db, org);

  const [configRows, voluntarios, subs] = await Promise.all([
    db
      .from("escala_config")
      .select("chave, valor")
      .eq("organization_id", org)
      .then((r) => ok(r, "config") as { chave: string; valor: unknown }[]),
    db
      .from("escala_voluntarios")
      .select("id")
      .eq("organization_id", org)
      .then((r) => new Set((ok(r, "voluntarios") as { id: string }[]).map((v) => v.id))),
    db
      .from("escala_subfuncoes")
      .select("id, nome, posicao")
      .eq("organization_id", org)
      .eq("setor_id", setorId)
      .then((r) => ok(r, "funcoes do louvor") as { id: string; nome: string; posicao: number }[]),
  ]);
  const config = montarConfig(configRows);

  // Ninguém de fora da organização entra por aqui, nem por id forjado.
  for (const b of entrada.blocos) {
    for (const i of b.itens) {
      for (const id of i.pessoas) {
        if (!voluntarios.has(id)) throw new Error("escalas/louvor: voluntário de outra organização");
      }
    }
  }

  // As funções do louvor passam a existir como subfunções do setor. O motor não
  // gera vaga para setor externo, então isto só dá nome às vagas.
  const funcaoId = new Map(subs.map((s) => [s.nome, s.id]));
  const novas = [...new Set(entrada.blocos.flatMap((b) => b.itens.map((i) => i.funcao)))].filter(
    (f) => !funcaoId.has(f),
  );
  if (novas.length > 0) {
    const proxima = subs.reduce((m, s) => Math.max(m, s.posicao), 0) + 1;
    const ins = await db
      .from("escala_subfuncoes")
      .insert(novas.map((nome, i) => ({ organization_id: org, setor_id: setorId, nome, qtd: 1, posicao: proxima + i })))
      .select("id, nome");
    if (ins.error) throw new Error(`escalas/louvor funcoes: ${ins.error.message}`);
    for (const s of ins.data as { id: string; nome: string }[]) funcaoId.set(s.nome, s.id);
  }

  let cultos = 0;
  let vagas = 0;
  for (const bloco of entrada.blocos) {
    for (const data of bloco.datas) {
      const existente = (
        await db.from("escala_cultos").select("id").eq("organization_id", org).eq("data", data).maybeSingle()
      ).data as { id: string } | null;
      let cultoId = existente?.id;
      if (!cultoId) {
        const dia = diaDaSemanaIso(data);
        const novo = await db
          .from("escala_cultos")
          .insert({
            organization_id: org,
            data,
            dia_semana: dia,
            hora: config.horario[dia] ?? null,
            rodada_data: rodadaDe(data, config.quintaAposDomingo),
            status: "rascunho",
          })
          .select("id")
          .single();
        if (novo.error) throw new Error(`escalas/louvor culto ${data}: ${novo.error.message}`);
        cultoId = (novo.data as { id: string }).id;
      }

      const del = await db
        .from("escala_slots")
        .delete()
        .eq("organization_id", org)
        .eq("culto_id", cultoId)
        .eq("setor_id", setorId)
        .eq("origem", "externo");
      if (del.error) throw new Error(`escalas/louvor limpar ${data}: ${del.error.message}`);

      const linhas = bloco.itens.flatMap((i) =>
        i.pessoas.map((voluntarioId) => ({
          organization_id: org,
          culto_id: cultoId,
          setor_id: setorId,
          subfuncao_id: funcaoId.get(i.funcao) ?? null,
          voluntario_id: voluntarioId,
          origem: "externo",
          motivo: bloco.paleta ? `paleta: ${bloco.paleta}` : "",
        })),
      );
      if (linhas.length > 0) {
        const ins = await db
          .from("escala_slots")
          .insert(linhas.map((l, i) => ({ ...l, posicao: POSICAO_DO_LOUVOR + i })));
        if (ins.error) throw new Error(`escalas/louvor vagas ${data}: ${ins.error.message}`);
      }
      cultos += 1;
      vagas += linhas.length;
    }
  }

  // Aprende: o que a liderança confirmou vira apelido do louvor para a próxima.
  let apelidos = 0;
  const vistos = new Set<string>();
  for (const a of entrada.apelidos) {
    const apelido = a.apelido.trim().slice(0, 60);
    const k = chaveDeApelido(apelido);
    if (!k || vistos.has(k) || !voluntarios.has(a.voluntarioId)) continue;
    vistos.add(k);
    const r = await db
      .from("escala_apelidos")
      .upsert(
        { organization_id: org, apelido, voluntario_id: a.voluntarioId, setor: SETOR_DO_LOUVOR },
        { onConflict: "organization_id,apelido,setor", ignoreDuplicates: true },
      );
    if (!r.error) apelidos += 1;
  }

  return { cultos, vagas, apelidos };
}

/** Há escala do louvor em algum culto destas datas? Para o aviso do "Montar". */
export async function louvorLancado(db: SupabaseClient, org: string, datas: string[]): Promise<boolean> {
  if (datas.length === 0) return true;
  const r = await db
    .from("escala_slots")
    .select("id, escala_cultos!inner(data)", { count: "exact", head: true })
    .eq("organization_id", org)
    .eq("origem", "externo")
    .in("escala_cultos.data", datas);
  return (r.count ?? 0) > 0;
}
