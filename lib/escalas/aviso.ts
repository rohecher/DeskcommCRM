/**
 * O número de WhatsApp que manda os avisos da escala (spec `tasks/avisos-da-escala`, Fase 1).
 *
 * Guarda o ID da sessão (`channel_sessions.id`), não o telefone: o número pode mudar na
 * sessão e o id continua apontando para a mesma. Mora em `escala_config` (chave/valor por
 * organização), que existe para regra sem tabela, então não há migration.
 *
 * Canal de outra organização é recusado aqui, e não só pela RLS: o id vem de um formulário,
 * e aceitar o de outra igreja mandaria aviso pelo número dela.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAVE_CANAL_DE_AVISO = "aviso_canal_id";

export async function lerCanalDeAviso(db: SupabaseClient, organizationId: string): Promise<string | null> {
  const { data, error } = await db
    .from("escala_config")
    .select("valor")
    .eq("organization_id", organizationId)
    .eq("chave", CHAVE_CANAL_DE_AVISO)
    .maybeSingle();
  if (error) throw new Error(`escala_config: ${error.message}`);
  return typeof data?.valor === "string" ? data.valor : null;
}

export type ResultadoDeGravarCanal = { ok: true } | { ok: false; erro: "canal_invalido" };

export async function gravarCanalDeAviso(
  db: SupabaseClient,
  organizationId: string,
  canalId: string,
): Promise<ResultadoDeGravarCanal> {
  const { data: canal, error: erroCanal } = await db
    .from("channel_sessions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", canalId)
    .maybeSingle();
  if (erroCanal) throw new Error(`channel_sessions: ${erroCanal.message}`);
  if (!canal) return { ok: false, erro: "canal_invalido" };

  const { error } = await db
    .from("escala_config")
    .upsert(
      { organization_id: organizationId, chave: CHAVE_CANAL_DE_AVISO, valor: canalId },
      { onConflict: "organization_id,chave" },
    );
  if (error) throw new Error(`escala_config: ${error.message}`);
  return { ok: true };
}

export interface CanalParaEscolher {
  id: string;
  nome: string | null;
  telefone: string | null;
  conectado: boolean;
}

/** Os números de WhatsApp da organização que a liderança pode escolher. */
export async function listarCanaisDaOrg(db: SupabaseClient, organizationId: string): Promise<CanalParaEscolher[]> {
  const { data, error } = await db
    .from("channel_sessions")
    .select("id, display_name, phone_number, status")
    .eq("organization_id", organizationId)
    .order("created_at");
  if (error) throw new Error(`channel_sessions: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    nome: (c.display_name as string | null) ?? null,
    telefone: (c.phone_number as string | null) ?? null,
    conectado: c.status === "WORKING",
  }));
}
