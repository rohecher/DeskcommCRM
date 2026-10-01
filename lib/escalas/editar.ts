/**
 * Edição manual de UMA vaga: o que a janela "Incluir voluntário" lê e grava.
 *
 * A partir de out/2026 o Cajado é a fonte oficial da escala. Toda troca feita
 * aqui vira `origem = 'manual'`, que é a marca que diz "a liderança decidiu" —
 * a próxima geração do motor e qualquer importação precisam respeitá-la.
 *
 * A decisão de quem pode ou não ocupar a vaga mora em `vaga.ts` (pura, testada).
 * Este arquivo só junta os dados do banco e grava. O mesmo cálculo roda na
 * LEITURA (para montar a lista) e na GRAVAÇÃO (para recusar o que a lista não
 * ofereceria): a lista é conveniência, a validação no servidor é a regra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { RegraVoluntario } from "./dominio";
import { bonito } from "./formato";
import { norm } from "./normalizar";
import { hojeIso } from "./mes";
import { montarConfig } from "./repo";
import { motivoParaNaoMarcar, statusPermitidos, type StatusDaVaga } from "./status";
import { candidatosDaVaga, type CandidatosDaVaga } from "./vaga";

function ok<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`escalas/editar ${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

function um<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

type Embutido<T> = T | T[] | null;

export interface VagaParaEditar {
  slotId: string;
  cultoId: string;
  data: string;
  diaSemana: string;
  setor: string;
  subfuncao: string;
  origem: string;
  status: StatusDaVaga;
  statusObs: string;
  /** O que a janela oferece em "Marcar como", pela data do culto. */
  statusPermitidos: StatusDaVaga[];
  atual: { id: string; nome: string } | null;
  /** Vaga do louvor/mídia/dança: a escala vem do próprio departamento. */
  externa: boolean;
  candidatos: CandidatosDaVaga;
}

interface LinhaSlot {
  id: string;
  culto_id: string;
  setor_id: string;
  subfuncao_id: string | null;
  voluntario_id: string | null;
  origem: string;
  status: StatusDaVaga;
  status_obs: string;
  escala_setores: Embutido<{ nome: string; dupla_decente: boolean; externo: boolean }>;
  escala_subfuncoes: Embutido<{ nome: string; dupla_decente: boolean; time_fixo: string[] | null }>;
  escala_voluntarios: Embutido<{ nome: string }>;
}

/**
 * Tudo sobre a vaga e a lista de quem pode ocupá-la.
 *
 * `null` quando a vaga não existe ou é de outra organização — o chamador trata
 * os dois casos igual, para não confirmar a existência de um id alheio.
 */
export async function carregarVaga(
  db: SupabaseClient,
  organizationId: string,
  slotId: string,
): Promise<VagaParaEditar | null> {
  const slot = (
    await db
      .from("escala_slots")
      .select(
        "id, culto_id, setor_id, subfuncao_id, voluntario_id, origem, status, status_obs, escala_setores!inner(nome, dupla_decente, externo), escala_subfuncoes(nome, dupla_decente, time_fixo), escala_voluntarios(nome)",
      )
      .eq("organization_id", organizationId)
      .eq("id", slotId)
      .maybeSingle()
  ).data as LinhaSlot | null;
  if (!slot) return null;

  const setor = um(slot.escala_setores);
  const sub = um(slot.escala_subfuncoes);
  if (!setor) return null;

  const [culto, configRows, vols, casais, doCulto, hist] = await Promise.all([
    db
      .from("escala_cultos")
      .select("data, dia_semana")
      .eq("organization_id", organizationId)
      .eq("id", slot.culto_id)
      .single()
      .then((r) => ok(r, "culto") as { data: string; dia_semana: string }),
    db
      .from("escala_config")
      .select("chave, valor")
      .eq("organization_id", organizationId)
      .then((r) => ok(r, "config") as { chave: string; valor: unknown }[]),
    db
      .from("escala_voluntarios")
      .select(
        "id, nome, sexo, status, departamento, dias_permitidos, setores_bloqueados, setores_permitidos, ausente_de, ausente_ate, max_por_mes",
      )
      .eq("organization_id", organizationId)
      .order("nome")
      .then(
        (r) =>
          ok(r, "voluntarios") as {
            id: string;
            nome: string;
            sexo: string | null;
            status: string;
            departamento: string;
            dias_permitidos: string[] | null;
            setores_bloqueados: string[] | null;
            setores_permitidos: string[] | null;
            ausente_de: string | null;
            ausente_ate: string | null;
            max_por_mes: number | null;
          }[],
      ),
    db
      .from("escala_casais")
      .select("voluntario_a, voluntario_b, confirmado")
      .eq("organization_id", organizationId)
      .then((r) => ok(r, "casais") as { voluntario_a: string; voluntario_b: string; confirmado: boolean }[]),
    db
      .from("escala_slots")
      .select(
        "id, setor_id, subfuncao_id, voluntario_id, origem, escala_setores!inner(nome), escala_subfuncoes(nome)",
      )
      .eq("organization_id", organizationId)
      .eq("culto_id", slot.culto_id)
      .then(
        (r) =>
          ok(r, "slots do culto") as {
            id: string;
            setor_id: string;
            subfuncao_id: string | null;
            voluntario_id: string | null;
            origem: string;
            escala_setores: Embutido<{ nome: string }>;
            escala_subfuncoes: Embutido<{ nome: string }>;
          }[],
      ),
    experienciaNoSetor(db, organizationId, setor.nome),
  ]);

  const config = montarConfig(configRows);
  const nomeDoId = new Map(vols.map((v) => [v.id, v.nome]));

  const regras = new Map<string, RegraVoluntario>();
  const sexo = new Map<string, string>();
  for (const v of vols) {
    regras.set(v.nome, {
      status: v.status,
      departamento: v.departamento,
      dias: v.dias_permitidos ?? [],
      bloqueados: (v.setores_bloqueados ?? []).map(norm),
      permitidos: (v.setores_permitidos ?? []).map(norm),
      de: v.ausente_de ?? "",
      ate: v.ausente_ate ?? "",
      max: v.max_por_mes,
    });
    if (v.sexo === "M" || v.sexo === "F") sexo.set(v.nome, v.sexo);
  }

  const mapaCasais = new Map<string, string>();
  for (const c of casais) {
    if (!c.confirmado) continue;
    const a = nomeDoId.get(c.voluntario_a);
    const b = nomeDoId.get(c.voluntario_b);
    if (a && b) {
      mapaCasais.set(a, b);
      mapaCasais.set(b, a);
    }
  }

  // Onde cada pessoa já está NESTE culto, sem contar a vaga que está sendo editada.
  const ocupados = new Map<string, string>();
  const parceiros: string[] = [];
  let mesmaFuncao = 0;
  for (const s of doCulto) {
    const ehMesmaFuncao = s.setor_id === slot.setor_id && s.subfuncao_id === slot.subfuncao_id;
    if (ehMesmaFuncao) mesmaFuncao += 1;
    if (s.id === slot.id || !s.voluntario_id) continue;
    const nome = nomeDoId.get(s.voluntario_id);
    if (!nome) continue;
    const setorNome = um(s.escala_setores)?.nome ?? "";
    const subNome = um(s.escala_subfuncoes)?.nome ?? "";
    ocupados.set(
      nome,
      s.origem === "externo"
        ? `${bonito(setorNome).toLocaleLowerCase("pt-BR")}${subNome ? ` · ${bonito(subNome)}` : ""}`
        : subNome
          ? `${bonito(subNome)} (${bonito(setorNome).toLocaleLowerCase("pt-BR")})`
          : bonito(setorNome).toLocaleLowerCase("pt-BR"),
    );
    if (ehMesmaFuncao) parceiros.push(nome);
  }

  const atualNome = slot.voluntario_id ? (nomeDoId.get(slot.voluntario_id) ?? null) : null;
  const timeFixo = (sub?.time_fixo ?? [])
    .map((id) => nomeDoId.get(id))
    .filter((n): n is string => Boolean(n));

  const candidatos = candidatosDaVaga({
    setor: setor.nome,
    diaSemana: culto.dia_semana,
    dataIso: culto.data,
    voluntarios: vols.map((v) => ({ id: v.id, nome: v.nome })),
    regras,
    config,
    ocupados,
    timeFixo,
    // Mesma regra de `exigeDecencia` do motor: vaga de DUPLA em setor ou função isolada.
    exigeDecencia: mesmaFuncao === 2 && (setor.dupla_decente || Boolean(sub?.dupla_decente)),
    parceiros,
    sexo,
    casais: mapaCasais,
    experiencia: hist,
    atual: atualNome,
  });

  return {
    slotId: slot.id,
    cultoId: slot.culto_id,
    data: culto.data,
    diaSemana: culto.dia_semana,
    setor: setor.nome,
    subfuncao: sub?.nome ?? "",
    origem: slot.origem,
    status: slot.status,
    statusObs: slot.status_obs,
    statusPermitidos: statusPermitidos(culto.data, hojeIso(), Boolean(slot.voluntario_id)),
    atual: slot.voluntario_id && atualNome ? { id: slot.voluntario_id, nome: atualNome } : null,
    externa: setor.externo || slot.origem === "externo",
    candidatos,
  };
}

/** Nome → vezes no setor, a partir do histórico (paginado: são milhares de linhas). */
async function experienciaNoSetor(
  db: SupabaseClient,
  organizationId: string,
  setor: string,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  const TAM = 1000;
  for (let de = 0; ; de += TAM) {
    const lote = ok(
      await db
        .from("escala_historico")
        .select("voluntario_id")
        .eq("organization_id", organizationId)
        .eq("setor", setor)
        .order("id")
        .range(de, de + TAM - 1),
      "historico do setor",
    ) as { voluntario_id: string }[];
    for (const h of lote) ids.set(h.voluntario_id, (ids.get(h.voluntario_id) ?? 0) + 1);
    if (lote.length < TAM) break;
  }
  if (ids.size === 0) return new Map();
  const nomes = ok(
    await db.from("escala_voluntarios").select("id, nome").eq("organization_id", organizationId),
    "nomes",
  ) as { id: string; nome: string }[];
  const porNome = new Map<string, number>();
  for (const v of nomes) {
    const n = ids.get(v.id);
    if (n) porNome.set(v.nome, n);
  }
  return porNome;
}

/** `antes`/`depois` são ids de voluntário — vão para a auditoria, que não guarda nome. */
export type ResultadoDaTroca =
  | { ok: true; antes: string | null; depois: string | null }
  | { ok: false; erro: "nao_encontrada" | "vaga_externa" | "nao_pode"; motivo?: string };

/**
 * Grava a troca. `voluntarioId = null` deixa a vaga aberta.
 *
 * Recalcula a lista ANTES de gravar: entre abrir a janela e salvar, outra pessoa
 * pode ter colocado o mesmo voluntário em outra vaga do culto. Quem está em
 * `naoPode` é recusado; `comAviso` passa — a liderança viu o aviso e escolheu.
 */
export async function trocarVoluntario(
  db: SupabaseClient,
  organizationId: string,
  slotId: string,
  voluntarioId: string | null,
): Promise<ResultadoDaTroca> {
  const vaga = await carregarVaga(db, organizationId, slotId);
  if (!vaga) return { ok: false, erro: "nao_encontrada" };
  if (vaga.externa) return { ok: false, erro: "vaga_externa" };

  if (voluntarioId) {
    if (vaga.atual?.id === voluntarioId) return { ok: true, antes: voluntarioId, depois: voluntarioId };
    const { pode, comAviso, naoPode } = vaga.candidatos;
    const escolhido = [...pode, ...comAviso].find((c) => c.id === voluntarioId);
    if (!escolhido) {
      const recusado = naoPode.find((c) => c.id === voluntarioId);
      return { ok: false, erro: "nao_pode", motivo: recusado?.motivo ?? "não está no cadastro desta igreja" };
    }
  }

  const { error } = await db
    .from("escala_slots")
    // O status volta a "escalado": a confirmação (ou o pedido de troca) era da
    // pessoa anterior, e herdá-lo diria "confirmado" de quem nem foi avisado.
    .update({
      voluntario_id: voluntarioId,
      origem: "manual",
      status: "escalado",
      status_em: new Date().toISOString(),
      status_obs: "",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", slotId);
  if (error) throw new Error(`escalas/editar gravar: ${error.message}`);

  return { ok: true, antes: vaga.atual?.id ?? null, depois: voluntarioId };
}

export type ResultadoDoStatus =
  | { ok: true; antes: StatusDaVaga }
  | { ok: false; erro: "nao_encontrada" | "vaga_externa" | "nao_pode"; motivo?: string };

/**
 * Marca o status da vaga: confirmado, pediu troca, presente, faltou — ou volta a
 * escalado. A regra de calendário (`status.ts`) é conferida AQUI, no servidor; a
 * janela só esconde o botão que não vale.
 */
export async function marcarStatus(
  db: SupabaseClient,
  organizationId: string,
  slotId: string,
  status: StatusDaVaga,
  obs: string,
): Promise<ResultadoDoStatus> {
  const slot = (
    await db
      .from("escala_slots")
      .select("id, voluntario_id, origem, status, escala_cultos!inner(data), escala_setores!inner(externo)")
      .eq("organization_id", organizationId)
      .eq("id", slotId)
      .maybeSingle()
  ).data as {
    id: string;
    voluntario_id: string | null;
    origem: string;
    status: StatusDaVaga;
    escala_cultos: Embutido<{ data: string }>;
    escala_setores: Embutido<{ externo: boolean }>;
  } | null;
  if (!slot) return { ok: false, erro: "nao_encontrada" };
  const data = um(slot.escala_cultos)?.data;
  if (!data) return { ok: false, erro: "nao_encontrada" };
  if (slot.origem === "externo" || um(slot.escala_setores)?.externo) return { ok: false, erro: "vaga_externa" };

  const motivo = motivoParaNaoMarcar(status, data, hojeIso(), Boolean(slot.voluntario_id));
  if (motivo) return { ok: false, erro: "nao_pode", motivo };

  const { error } = await db
    .from("escala_slots")
    .update({
      status,
      status_em: new Date().toISOString(),
      // Só a troca guarda motivo; os outros status limpam o texto antigo para
      // não ficar um "viagem a trabalho" pendurado numa vaga confirmada.
      status_obs: status === "troca_solicitada" ? obs : "",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", slotId);
  if (error) throw new Error(`escalas/editar status: ${error.message}`);
  return { ok: true, antes: slot.status };
}
