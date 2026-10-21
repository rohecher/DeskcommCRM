import { describe, expect, it } from "vitest";

import { gravarCanalDeAviso, lerCanalDeAviso, listarCanaisDaOrg } from "@/lib/escalas/aviso";
import { bancoDeMentira } from "@/tests/helpers/escalas-banco-de-mentira";

const ORG = "00000000-0000-4000-8000-000000000001";
const OUTRA_ORG = "00000000-0000-4000-8000-000000000002";
const CANAL = "11111111-1111-4111-8111-111111111111";
const CANAL_DA_OUTRA = "22222222-2222-4222-8222-222222222222";

const sessoes = [
  { id: CANAL, organization_id: ORG },
  { id: CANAL_DA_OUTRA, organization_id: OUTRA_ORG },
];

describe("o número que manda os avisos da escala", () => {
  it("sem nada escolhido, não há número", async () => {
    const { db } = bancoDeMentira({ channel_sessions: sessoes });
    expect(await lerCanalDeAviso(db, ORG)).toBeNull();
  });

  it("guarda o canal da própria organização e devolve o mesmo id", async () => {
    const { db } = bancoDeMentira({ channel_sessions: sessoes });

    expect(await gravarCanalDeAviso(db, ORG, CANAL)).toEqual({ ok: true });
    expect(await lerCanalDeAviso(db, ORG)).toBe(CANAL);
  });

  it("recusa o canal de outra organização, e não grava nada", async () => {
    const { db, tabelas } = bancoDeMentira({ channel_sessions: sessoes });

    expect(await gravarCanalDeAviso(db, ORG, CANAL_DA_OUTRA)).toEqual({
      ok: false,
      erro: "canal_invalido",
    });
    expect(tabelas.escala_config).toEqual([]);
    expect(await lerCanalDeAviso(db, ORG)).toBeNull();
  });

  it("escolher de novo troca o número, sem duplicar a linha", async () => {
    const outro = "33333333-3333-4333-8333-333333333333";
    const { db, tabelas } = bancoDeMentira({
      channel_sessions: [...sessoes, { id: outro, organization_id: ORG }],
    });

    await gravarCanalDeAviso(db, ORG, CANAL);
    await gravarCanalDeAviso(db, ORG, outro);

    expect(await lerCanalDeAviso(db, ORG)).toBe(outro);
    expect(tabelas.escala_config).toHaveLength(1);
  });

  it("o número de uma organização não aparece para a outra", async () => {
    const { db } = bancoDeMentira({ channel_sessions: sessoes });
    await gravarCanalDeAviso(db, ORG, CANAL);

    expect(await lerCanalDeAviso(db, OUTRA_ORG)).toBeNull();
  });
});

describe("os números que a igreja pode escolher", () => {
  it("lista só os da própria organização, dizendo quais estão conectados", async () => {
    const { db } = bancoDeMentira({
      channel_sessions: [
        { id: CANAL, organization_id: ORG, display_name: "Secretaria", phone_number: "+5511900000001", status: "WORKING" },
        { id: "33333333-3333-4333-8333-333333333333", organization_id: ORG, display_name: null, phone_number: null, status: "STOPPED" },
        { id: CANAL_DA_OUTRA, organization_id: OUTRA_ORG, display_name: "Outra igreja", phone_number: "+5511900000002", status: "WORKING" },
      ],
    });

    expect(await listarCanaisDaOrg(db, ORG)).toEqual([
      { id: CANAL, nome: "Secretaria", telefone: "+5511900000001", conectado: true },
      { id: "33333333-3333-4333-8333-333333333333", nome: null, telefone: null, conectado: false },
    ]);
  });

  it("sem nenhum número conectado, a lista é vazia", async () => {
    const { db } = bancoDeMentira({ channel_sessions: [] });
    expect(await listarCanaisDaOrg(db, ORG)).toEqual([]);
  });
});
