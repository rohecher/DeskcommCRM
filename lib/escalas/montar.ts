/**
 * "Montar escala": o motor sugere o mês, a liderança revisa e publica.
 *
 * O ciclo tem três passos e o do meio é humano:
 *
 *   1. montar   — o motor gera os cultos do mês que ainda não têm escala, como
 *                 RASCUNHO. Só a liderança vê rascunho.
 *   2. revisar  — a liderança troca nomes e marca o que precisar (fases 2 e 3).
 *   3. publicar — o rascunho vira a escala oficial e todo mundo passa a ver.
 *
 * O que o motor NUNCA toca: culto publicado (é registro: a igreja já viu),
 * culto que já passou, e vaga de departamento externo (o louvor monta a dele).
 * Montar de novo um mês em rascunho regenera só o que o motor tinha gerado; o
 * que a liderança trocou à mão entra no motor como nome FIXADO e continua lá.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Falta } from "./dominio";
import { gerarLote } from "./gerar";
import { diaDaSemanaIso, limitesDoMes, type Mes } from "./mes";
import { chave } from "./normalizar";
import { carregarMotor, montarConfig } from "./repo";
import { rodadaDe } from "./rodada";

function ok<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`escalas/montar ${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/** As datas do mês em que há culto, pelos dias de `config.horario`. */
export function datasDeCulto(mes: Mes, horario: Record<string, string>): string[] {
  const { inicio, fim } = limitesDoMes(mes);
  const dias = new Set(Object.keys(horario));
  const datas: string[] = [];
  for (let d = Number(inicio.slice(8)); d <= Number(fim.slice(8)); d += 1) {
    const iso = `${mes}-${String(d).padStart(2, "0")}`;
    if (dias.has(diaDaSemanaIso(iso))) datas.push(iso);
  }
  return datas;
}

export interface CultoExistente {
  data: string;
  status: string;
}

export type MotivoPulado = "publicado" | "ja_passou";

/**
 * Quais datas o motor pode gerar agora.
 *
 * Culto sem escala → gera. Culto em rascunho → regenera. Culto publicado ou
 * aprovado → não toca. Data passada → não toca: gerar escala para ontem só
 * apagaria o registro do que aconteceu.
 */
export function planoDoMes(
  datas: readonly string[],
  existentes: readonly CultoExistente[],
  hoje: string,
): { gerar: string[]; pulados: { data: string; motivo: MotivoPulado }[] } {
  const status = new Map(existentes.map((c) => [c.data, c.status]));
  const gerar: string[] = [];
  const pulados: { data: string; motivo: MotivoPulado }[] = [];
  for (const data of datas) {
    const s = status.get(data);
    if (data < hoje) pulados.push({ data, motivo: "ja_passou" });
    else if (s && s !== "rascunho") pulados.push({ data, motivo: "publicado" });
    else gerar.push(data);
  }
  return { gerar, pulados };
}

export interface ResumoDaMontagem {
  gerados: { data: string; vagas: number; abertas: number }[];
  pulados: { data: string; motivo: MotivoPulado }[];
  faltas: (Falta & { data: string })[];
}

/** Lê o plano sem gerar nada — o que a janela mostra antes do "Montar". */
export async function previaDoMes(
  db: SupabaseClient,
  organizationId: string,
  mes: Mes,
  hoje: string,
): Promise<{ datas: string[]; gerar: string[]; pulados: { data: string; motivo: MotivoPulado }[] }> {
  const { inicio, fim } = limitesDoMes(mes);
  const [configRows, cultos] = await Promise.all([
    db
      .from("escala_config")
      .select("chave, valor")
      .eq("organization_id", organizationId)
      .then((r) => ok(r, "config") as { chave: string; valor: unknown }[]),
    db
      .from("escala_cultos")
      .select("data, status")
      .eq("organization_id", organizationId)
      .gte("data", inicio)
      .lte("data", fim)
      .then((r) => ok(r, "cultos") as CultoExistente[]),
  ]);
  const config = montarConfig(configRows);
  // Só os dias de culto da estrutura. Um encontro avulso que o louvor registrou
  // (sala de oração de segunda) não é dia de escala geral.
  const datas = datasDeCulto(mes, config.horario);
  return { datas, ...planoDoMes(datas, cultos, hoje) };
}

/**
 * Gera o mês e grava como rascunho.
 *
 * Não é transacional — o supabase-js não abre transação. A ordem minimiza o
 * estrago de uma falha no meio: cada culto é gravado inteiro (culto, depois as
 * vagas) antes do próximo, e o que já foi gravado é rascunho, que a liderança
 * pode montar de novo ou descartar.
 */
export async function montarMes(
  db: SupabaseClient,
  organizationId: string,
  mes: Mes,
  hoje: string,
): Promise<ResumoDaMontagem> {
  const previa = await previaDoMes(db, organizationId, mes, hoje);
  const resumo: ResumoDaMontagem = { gerados: [], pulados: previa.pulados, faltas: [] };
  if (previa.gerar.length === 0) return resumo;

  const [setores, subs, vols, rascunhos] = await Promise.all([
    db
      .from("escala_setores")
      .select("id, nome")
      .eq("organization_id", organizationId)
      .then((r) => ok(r, "setores") as { id: string; nome: string }[]),
    db
      .from("escala_subfuncoes")
      .select("id, setor_id, nome")
      .eq("organization_id", organizationId)
      .then((r) => ok(r, "subfuncoes") as { id: string; setor_id: string; nome: string }[]),
    db
      .from("escala_voluntarios")
      .select("id, nome")
      .eq("organization_id", organizationId)
      .then((r) => ok(r, "voluntarios") as { id: string; nome: string }[]),
    db
      .from("escala_cultos")
      .select("id, data")
      .eq("organization_id", organizationId)
      .eq("status", "rascunho")
      .in("data", previa.gerar)
      .then((r) => ok(r, "rascunhos") as { id: string; data: string }[]),
  ]);
  const setorPorNome = new Map(setores.map((s) => [s.nome, s.id]));
  const nomeDoSetor = new Map(setores.map((s) => [s.id, s.nome]));
  const subPorChave = new Map(subs.map((s) => [chave(s.setor_id, s.nome), s.id]));
  const nomeDaSub = new Map(subs.map((s) => [s.id, s.nome]));
  const volPorNome = new Map(vols.map((v) => [v.nome, v.id]));
  const nomeDoVol = new Map(vols.map((v) => [v.id, v.nome]));

  // O que a liderança já trocou à mão nos rascunhos sobrevive à nova montagem:
  // vira nome fixado na entrada do motor e volta com a marca de "manual".
  const manuais = new Set<string>();
  const fixadosDaLideranca = new Map<string, string[]>();
  if (rascunhos.length > 0) {
    const dataDoRascunho = new Map(rascunhos.map((c) => [c.id, c.data]));
    const slots = ok(
      await db
        .from("escala_slots")
        .select("culto_id, setor_id, subfuncao_id, voluntario_id, origem")
        .eq("organization_id", organizationId)
        .in(
          "culto_id",
          rascunhos.map((c) => c.id),
        )
        .in("origem", ["manual", "fixado"]),
      "slots manuais",
    ) as { culto_id: string; setor_id: string; subfuncao_id: string | null; voluntario_id: string | null; origem: string }[];
    for (const s of slots) {
      const data = dataDoRascunho.get(s.culto_id);
      const setor = nomeDoSetor.get(s.setor_id);
      const nome = s.voluntario_id ? nomeDoVol.get(s.voluntario_id) : undefined;
      if (!data || !setor || !nome) continue;
      const sub = s.subfuncao_id ? (nomeDaSub.get(s.subfuncao_id) ?? "") : "";
      const k = chave(data, setor, sub);
      fixadosDaLideranca.set(k, [...(fixadosDaLideranca.get(k) ?? []), nome]);
      if (s.origem === "manual") manuais.add(chave(data, setor, sub, nome));
    }
  }

  const { entrada, estado } = await carregarMotor(db, organizationId, {
    datas: previa.gerar,
    hojeIso: hoje,
  });
  for (const [k, nomes] of fixadosDaLideranca) {
    entrada.fixados.set(k, [...new Set([...(entrada.fixados.get(k) ?? []), ...nomes])]);
  }

  const resultados = gerarLote(previa.gerar, entrada, estado);
  const idDoRascunho = new Map(rascunhos.map((c) => [c.data, c.id]));

  for (const r of resultados) {
    const diaSemana = diaDaSemanaIso(r.data);
    let cultoId = idDoRascunho.get(r.data);
    if (cultoId) {
      // Regenera: sai tudo que não é do louvor; o que era manual volta abaixo.
      const del = await db
        .from("escala_slots")
        .delete()
        .eq("organization_id", organizationId)
        .eq("culto_id", cultoId)
        .neq("origem", "externo");
      if (del.error) throw new Error(`escalas/montar limpar ${r.data}: ${del.error.message}`);
    } else {
      // INSERT, não upsert: um upsert sobrescreveria o status de um culto que
      // alguém criou ou publicou entre a prévia e agora. Com insert, a data já
      // existente bate no índice único e fica como está.
      const novo = await db
        .from("escala_cultos")
        .insert({
          organization_id: organizationId,
          data: r.data,
          dia_semana: diaSemana,
          hora: entrada.config.horario[diaSemana] ?? null,
          rodada_data: rodadaDe(r.data, entrada.config.quintaAposDomingo),
          status: "rascunho",
        })
        .select("id")
        .single();
      if (novo.error) {
        if (novo.error.code === "23505") {
          resumo.pulados.push({ data: r.data, motivo: "publicado" });
          continue;
        }
        throw new Error(`escalas/montar culto ${r.data}: ${novo.error.message}`);
      }
      cultoId = (novo.data as { id: string }).id;
    }

    const linhas = r.escala.filter((l) => !l.obs.startsWith("OFF"));
    const vagas = linhas.flatMap((l, i) => {
      const setorId = setorPorNome.get(l.setor);
      if (!setorId) return [];
      const sub = l.subfuncao ? (subPorChave.get(chave(setorId, l.subfuncao)) ?? null) : null;
      const volId = l.nome ? (volPorNome.get(l.nome) ?? null) : null;
      const origem = l.nome
        ? manuais.has(chave(r.data, l.setor, l.subfuncao, l.nome))
          ? "manual"
          : (entrada.fixados.get(chave(r.data, l.setor, l.subfuncao)) ?? []).includes(l.nome)
            ? "fixado"
            : "gerado"
        : "gerado";
      return [
        {
          organization_id: organizationId,
          culto_id: cultoId,
          setor_id: setorId,
          subfuncao_id: sub,
          voluntario_id: volId,
          origem,
          motivo: l.nome ? "" : l.obs,
          posicao: i + 1,
        },
      ];
    });
    if (vagas.length > 0) {
      const ins = await db.from("escala_slots").insert(vagas);
      if (ins.error) throw new Error(`escalas/montar vagas ${r.data}: ${ins.error.message}`);
    }
    resumo.gerados.push({
      data: r.data,
      vagas: vagas.length,
      abertas: vagas.filter((v) => !v.voluntario_id).length,
    });
    for (const f of r.faltas) resumo.faltas.push({ ...f, data: r.data });
  }
  return resumo;
}

/** Rascunho do mês vira escala oficial. Devolve quantos cultos foram publicados. */
export async function publicarMes(db: SupabaseClient, organizationId: string, mes: Mes): Promise<number> {
  const { inicio, fim } = limitesDoMes(mes);
  const r = await db
    .from("escala_cultos")
    .update({ status: "publicado", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("status", "rascunho")
    .gte("data", inicio)
    .lte("data", fim)
    .select("id");
  if (r.error) throw new Error(`escalas/montar publicar: ${r.error.message}`);
  return (r.data ?? []).length;
}

/**
 * Joga o rascunho fora. As vagas vão junto (cascade). Só rascunho: culto
 * publicado é registro e não sai por aqui.
 */
export async function descartarRascunho(db: SupabaseClient, organizationId: string, mes: Mes): Promise<number> {
  const { inicio, fim } = limitesDoMes(mes);
  const r = await db
    .from("escala_cultos")
    .delete()
    .eq("organization_id", organizationId)
    .eq("status", "rascunho")
    .gte("data", inicio)
    .lte("data", fim)
    .select("id");
  if (r.error) throw new Error(`escalas/montar descartar: ${r.error.message}`);
  return (r.data ?? []).length;
}
