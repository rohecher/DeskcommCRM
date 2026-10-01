"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { audit } from "@/lib/audit";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { carregarVaga, marcarStatus, trocarVoluntario, type VagaParaEditar } from "@/lib/escalas/editar";
import { hojeIso, mesValido } from "@/lib/escalas/mes";
import {
  descartarRascunho,
  montarMes,
  previaDoMes,
  publicarMes,
  type ResumoDaMontagem,
} from "@/lib/escalas/montar";
import { obsLimpa, statusValido } from "@/lib/escalas/status";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Quem pode mexer na escala: Líder de Ministério para cima.
 *
 * A Secretaria vê a escala mas não troca nome — a escala é decisão da liderança,
 * e o papel vem da membership resolvida no servidor, nunca do cliente.
 */
async function quemEdita() {
  const user = await loadAuthUser();
  if (!user) return { ok: false as const, erro: "unauthenticated" };
  const org = await resolveActiveOrg(user);
  if (!org) return { ok: false as const, erro: "forbidden_tenant" };
  if (!user.is_platform_admin && ROLE_RANK[org.role] < ROLE_RANK.manager) {
    return { ok: false as const, erro: "forbidden_role" };
  }
  return { ok: true as const, user, org };
}

export type OpcoesDaVaga = { ok: true; vaga: VagaParaEditar } | { ok: false; erro: string };

/** A janela abre e pede a lista de quem pode ocupar a vaga. */
export async function opcoesDaVaga(slotId: string): Promise<OpcoesDaVaga> {
  if (typeof slotId !== "string" || !UUID.test(slotId)) return { ok: false, erro: "invalid_request" };
  const quem = await quemEdita();
  if (!quem.ok) return { ok: false, erro: quem.erro };

  const db = await createClient();
  const vaga = await carregarVaga(db, quem.org.orgId, slotId);
  if (!vaga) return { ok: false, erro: "not_found" };
  return { ok: true, vaga };
}

export type ResultadoDeSalvar = { ok: true } | { ok: false; erro: string; motivo?: string };

/** Grava a troca (ou deixa a vaga aberta, com `voluntarioId = null`). */
export async function salvarVaga(slotId: string, voluntarioId: string | null): Promise<ResultadoDeSalvar> {
  if (typeof slotId !== "string" || !UUID.test(slotId)) return { ok: false, erro: "invalid_request" };
  if (voluntarioId !== null && (typeof voluntarioId !== "string" || !UUID.test(voluntarioId))) {
    return { ok: false, erro: "invalid_request" };
  }
  const quem = await quemEdita();
  if (!quem.ok) return { ok: false, erro: quem.erro };

  const db = await createClient();
  const r = await trocarVoluntario(db, quem.org.orgId, slotId, voluntarioId);
  if (!r.ok) return { ok: false, erro: r.erro, motivo: r.motivo };

  const hdrs = await headers();
  await audit({
    action: "escala.vaga_alterada",
    actorUserId: quem.user.id,
    organizationId: quem.org.orgId,
    resourceType: "escala_slot",
    resourceId: slotId,
    requestId: hdrs.get("x-request-id"),
    // Ids, não nomes: o log de auditoria guarda por anos e não é lugar de dado pessoal.
    metadata: { voluntario_antes: r.antes, voluntario_depois: r.depois },
  });

  revalidatePath("/app/escalas", "layout");
  return { ok: true };
}

/** Marca o status da vaga. A regra de calendário é conferida em `marcarStatus`. */
export async function salvarStatus(slotId: string, status: string, obs: string): Promise<ResultadoDeSalvar> {
  if (typeof slotId !== "string" || !UUID.test(slotId) || !statusValido(status)) {
    return { ok: false, erro: "invalid_request" };
  }
  const quem = await quemEdita();
  if (!quem.ok) return { ok: false, erro: quem.erro };

  const db = await createClient();
  const r = await marcarStatus(db, quem.org.orgId, slotId, status, obsLimpa(obs));
  if (!r.ok) return { ok: false, erro: r.erro, motivo: r.motivo };

  const hdrs = await headers();
  await audit({
    action: "escala.vaga_status_alterado",
    actorUserId: quem.user.id,
    organizationId: quem.org.orgId,
    resourceType: "escala_slot",
    resourceId: slotId,
    requestId: hdrs.get("x-request-id"),
    // A observação fica na vaga, não aqui: pode trazer motivo pessoal ("cirurgia
    // da mãe"), e o log de auditoria guarda por anos.
    metadata: { status_antes: r.antes, status_depois: status },
  });

  revalidatePath("/app/escalas", "layout");
  return { ok: true };
}

export type PreviaDaMontagem =
  | { ok: true; datas: string[]; gerar: string[]; pulados: { data: string; motivo: string }[] }
  | { ok: false; erro: string };

/** O que "Montar escala" vai fazer neste mês, antes de fazer. */
export async function previaDaMontagem(mes: string): Promise<PreviaDaMontagem> {
  if (!mesValido(mes)) return { ok: false, erro: "invalid_request" };
  const quem = await quemEdita();
  if (!quem.ok) return { ok: false, erro: quem.erro };
  const db = await createClient();
  return { ok: true, ...(await previaDoMes(db, quem.org.orgId, mes, hojeIso())) };
}

export type ResultadoDaMontagem = { ok: true; resumo: ResumoDaMontagem } | { ok: false; erro: string };

/** Chama o motor e grava o mês como rascunho. */
export async function montarEscala(mes: string): Promise<ResultadoDaMontagem> {
  if (!mesValido(mes)) return { ok: false, erro: "invalid_request" };
  const quem = await quemEdita();
  if (!quem.ok) return { ok: false, erro: quem.erro };
  const db = await createClient();
  const resumo = await montarMes(db, quem.org.orgId, mes, hojeIso());

  const hdrs = await headers();
  await audit({
    action: "escala.mes_montado",
    actorUserId: quem.user.id,
    organizationId: quem.org.orgId,
    resourceType: "escala_mes",
    resourceId: mes,
    requestId: hdrs.get("x-request-id"),
    metadata: {
      cultos: resumo.gerados.length,
      vagas: resumo.gerados.reduce((n, g) => n + g.vagas, 0),
      abertas: resumo.gerados.reduce((n, g) => n + g.abertas, 0),
    },
  });
  revalidatePath("/app/escalas", "layout");
  return { ok: true, resumo };
}

export type ResultadoDoMes = { ok: true; cultos: number } | { ok: false; erro: string };

/** O rascunho do mês vira a escala oficial. */
export async function publicarEscala(mes: string): Promise<ResultadoDoMes> {
  if (!mesValido(mes)) return { ok: false, erro: "invalid_request" };
  const quem = await quemEdita();
  if (!quem.ok) return { ok: false, erro: quem.erro };
  const db = await createClient();
  const cultos = await publicarMes(db, quem.org.orgId, mes);
  const hdrs = await headers();
  await audit({
    action: "escala.mes_publicado",
    actorUserId: quem.user.id,
    organizationId: quem.org.orgId,
    resourceType: "escala_mes",
    resourceId: mes,
    requestId: hdrs.get("x-request-id"),
    metadata: { cultos },
  });
  revalidatePath("/app/escalas", "layout");
  return { ok: true, cultos };
}

/** Joga fora o rascunho do mês (o publicado não é tocado). */
export async function descartarEscala(mes: string): Promise<ResultadoDoMes> {
  if (!mesValido(mes)) return { ok: false, erro: "invalid_request" };
  const quem = await quemEdita();
  if (!quem.ok) return { ok: false, erro: quem.erro };
  const db = await createClient();
  const cultos = await descartarRascunho(db, quem.org.orgId, mes);
  const hdrs = await headers();
  await audit({
    action: "escala.rascunho_descartado",
    actorUserId: quem.user.id,
    organizationId: quem.org.orgId,
    resourceType: "escala_mes",
    resourceId: mes,
    requestId: hdrs.get("x-request-id"),
    metadata: { cultos },
  });
  revalidatePath("/app/escalas", "layout");
  return { ok: true, cultos };
}
