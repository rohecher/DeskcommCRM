/**
 * O que toda tela de escala precisa antes de consultar qualquer coisa: quem está
 * olhando e de qual organização.
 *
 * O client é o do SERVIDOR (RLS ligada), nunca o admin: estas telas são abertas
 * por usuário final em fluxo normal, e é exatamente o caso que `lib/supabase/admin.ts`
 * proíbe. As consultas ainda filtram `organization_id` explicitamente — a RLS é a
 * fronteira, o filtro é a defesa em profundidade.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function contextoDeEscala() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  // Sem organização ativa não há escala nenhuma para mostrar. O layout de /app já
  // trata onboarding e suspensão; aqui só resta o caso de convite não aceito.
  if (!activeOrg) redirect("/app");

  const db = await createClient();
  return { user, activeOrg, db, orgId: activeOrg.orgId };
}
