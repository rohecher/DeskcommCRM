import { beforeEach, describe, expect, it, vi } from "vitest";

import { salvarCanalDeAviso } from "@/app/app/escalas/_acoes";
import { audit } from "@/lib/audit";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { bancoDeMentira } from "@/tests/helpers/escalas-banco-de-mentira";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn(), resolveActiveOrg: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const USUARIO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG = "00000000-0000-4000-8000-000000000001";
const OUTRA_ORG = "00000000-0000-4000-8000-000000000002";
const CANAL = "11111111-1111-4111-8111-111111111111";
const CANAL_DA_OUTRA = "22222222-2222-4222-8222-222222222222";

/** Quem está logado e com qual papel na organização ativa (ou ninguém). */
function sessao(papel: "viewer" | "agent" | "manager" | "admin" | null) {
  vi.mocked(loadAuthUser).mockResolvedValue(
    papel === null ? null : ({ id: USUARIO, is_platform_admin: false } as never),
  );
  vi.mocked(resolveActiveOrg).mockResolvedValue(papel === null ? null : ({ orgId: ORG, role: papel } as never));
}

function banco() {
  const b = bancoDeMentira({
    channel_sessions: [
      { id: CANAL, organization_id: ORG },
      { id: CANAL_DA_OUTRA, organization_id: OUTRA_ORG },
    ],
  });
  vi.mocked(createClient).mockResolvedValue(b.db);
  return b;
}

beforeEach(() => vi.clearAllMocks());

describe("salvarCanalDeAviso", () => {
  it("a liderança escolhe o número: grava na organização da sessão e deixa auditoria", async () => {
    sessao("manager");
    const { tabelas } = banco();

    expect(await salvarCanalDeAviso(CANAL)).toEqual({ ok: true });

    expect(tabelas.escala_config).toEqual([
      { organization_id: ORG, chave: "aviso_canal_id", valor: CANAL },
    ]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "escala.canal_de_aviso_definido",
        organizationId: ORG,
        actorUserId: USUARIO,
        resourceId: null,
        metadata: { canal_id: CANAL },
      }),
    );
  });

  it("a Secretaria vê a escala mas não escolhe o número: 403, nada gravado, sem auditoria", async () => {
    sessao("agent");
    const { tabelas } = banco();

    expect(await salvarCanalDeAviso(CANAL)).toEqual({ ok: false, erro: "forbidden_role" });
    expect(tabelas.escala_config).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it("sem login não há nada a fazer", async () => {
    sessao(null);
    const { tabelas } = banco();

    expect(await salvarCanalDeAviso(CANAL)).toEqual({ ok: false, erro: "unauthenticated" });
    expect(tabelas.escala_config).toEqual([]);
  });

  it("entrada que não é um id é recusada antes de tocar no banco", async () => {
    sessao("manager");
    const { tabelas } = banco();

    expect(await salvarCanalDeAviso("não-é-um-uuid")).toEqual({ ok: false, erro: "invalid_request" });
    expect(tabelas.escala_config).toEqual([]);
  });

  it("canal de outra organização é recusado e não gera auditoria de sucesso", async () => {
    sessao("manager");
    const { tabelas } = banco();

    expect(await salvarCanalDeAviso(CANAL_DA_OUTRA)).toEqual({ ok: false, erro: "canal_invalido" });
    expect(tabelas.escala_config).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });
});
