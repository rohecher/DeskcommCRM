/**
 * A ÚNICA camada do motor de escalas que toca o banco.
 *
 * `gerar()` é função pura e recebe `EntradaMotor` em memória. Quem monta essa
 * entrada a partir das tabelas `escala_*` é este arquivo; quem monta a partir dos
 * JSON exportados do motor Python é `de-json.ts`, usado pelo teste de paridade.
 * Os dois produzem a MESMA estrutura, e é isso que permite provar o motor sem
 * banco e usá-lo com banco sem reescrever nada.
 *
 * ═══ O MOTOR TRABALHA COM NOMES, NÃO COM uuid ═══
 *
 * As colunas `time_fixo`, `prioridade` e `pool_extra` guardam `uuid[]`, e aqui
 * elas são traduzidas para nomes. Parece um passo desnecessário — seria "mais
 * limpo" o motor usar uuid o tempo todo. Não é: o nome é o que a liderança lê,
 * o que aparece na escala publicada, e o que o teste de paridade compara contra
 * o motor original. Um motor que decide por uuid produz um diff ilegível quando
 * divergir, e divergir é o caso em que a legibilidade importa.
 *
 * ═══ A ORDEM DO HISTÓRICO É PARTE DO RESULTADO ═══
 *
 * `construirPerfis` insere as pessoas no Map na ordem em que o histórico as
 * apresenta, e `gerar()` percorre candidatos nessa ordem com ordenação ESTÁVEL:
 * duas pessoas com a mesma nota saem na ordem de inserção. Então a cláusula
 * `order by` abaixo não é cosmética — ela participa de quem é escalado.
 *
 * Por isso o `order by` começa em `ordem` — a posição na planilha de origem,
 * guardada pela migration 0148 — e só cai no critério cronológico (ano, mês,
 * dia, setor, subfunção, id) para o histórico importado antes dela.
 *
 * A medida que motivou a 0148: ordenando apenas cronologicamente, a escala saía
 * com AS MESMAS PESSOAS em todas as 210 vagas, mas 56 das 324 linhas em ordem
 * trocada dentro da vaga — e a marca "casal" fica na SEGUNDA linha da dupla,
 * então a troca muda o que a escala publicada mostra. `tests/prova-escalas-repo.ts`
 * refaz a comparação contra a planilha e hoje devolve zero divergências.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { cargaPorPeriodo, construirPerfis, competencia, idadeMeses, vezesNaVaga } from "./carga";
import { modeloDemanda } from "./demanda";
import type {
  Config,
  EntradaMotor,
  EstadoLote,
  RegistroExterno,
  RegistroHistorico,
  RegraVoluntario,
  Setor,
  SexoVoluntario,
  Subfuncao,
} from "./dominio";
import { chave, norm } from "./normalizar";
import { equipeDoSetorNoDomingo, equipesPorRodada, vagasDoDomingo } from "./rodada";

/** Quantas linhas por página ao ler o histórico (o PostgREST limita a resposta). */
const PAGINA = 1000;

const CONFIG_PADRAO: Config = {
  maxPadrao: 0,
  pesoRodizio: 3,
  bonusCasa: 1.5,
  pesoLider: -1,
  papelLideranca: "LIDER",
  semanasDescanso: 8,
  quintaAposDomingo: 4,
  reservaMaxNoMes: 1,
  mesesRecentes: 8,
  horario: { QUINTA: "19:20", DOMINGO: "19:00" },
  deptoExterno: ["DANCA", "M. DANCA", "M. LOUVOR", "LOUVOR", "MIDIA", "MULTIMIDIA", "SOM"],
  deptoApelido: {},
};

interface LinhaVoluntario {
  id: string;
  nome: string;
  sexo: string | null;
  status: string;
  departamento: string;
  dias_permitidos: string[];
  setores_bloqueados: string[];
  setores_permitidos: string[];
  ausente_de: string | null;
  ausente_ate: string | null;
  max_por_mes: number | null;
  reserva: boolean;
}

interface LinhaSubfuncao {
  id: string;
  setor_id: string;
  nome: string;
  qtd: number;
  qtd_por_dia: Record<string, number>;
  posicao: number;
  time_fixo: string[];
  prioridade: string[];
  pool_extra: string[];
  por_frequencia: boolean;
  max_do_grupo: number | null;
  dupla_decente: boolean;
  casal_junto: boolean;
  mesmo_sexo_que_id: string | null;
  conjuge_de_id: string | null;
}

interface LinhaSetor {
  id: string;
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
  ativo: boolean;
}

/** Lança em erro do PostgREST: silêncio aqui vira escala com gente faltando. */
function ok<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`escalas/repo ${onde}: ${r.error.message}`);
  if (r.data === null) throw new Error(`escalas/repo ${onde}: resposta sem dados`);
  return r.data;
}

/** `escala_config` (chave → jsonb) por cima dos padrões. */
export function montarConfig(linhas: { chave: string; valor: unknown }[]): Config {
  const c: Config = { ...CONFIG_PADRAO };
  const num = (v: unknown, atual: number) => (typeof v === "number" ? v : atual);
  for (const { chave: k, valor } of linhas) {
    switch (k) {
      case "max_padrao":
        c.maxPadrao = num(valor, c.maxPadrao);
        break;
      case "peso_rodizio":
        c.pesoRodizio = num(valor, c.pesoRodizio);
        break;
      case "bonus_casa":
        c.bonusCasa = num(valor, c.bonusCasa);
        break;
      case "peso_lider":
        c.pesoLider = num(valor, c.pesoLider);
        break;
      case "semanas_descanso":
        c.semanasDescanso = num(valor, c.semanasDescanso);
        break;
      case "quinta_apos_domingo":
        c.quintaAposDomingo = num(valor, c.quintaAposDomingo);
        break;
      case "reserva_max_no_mes":
        c.reservaMaxNoMes = num(valor, c.reservaMaxNoMes);
        break;
      case "meses_recentes":
        c.mesesRecentes = num(valor, c.mesesRecentes);
        break;
      case "papel_lideranca":
        if (typeof valor === "string") c.papelLideranca = valor;
        break;
      case "horario":
        if (valor && typeof valor === "object") c.horario = valor as Record<string, string>;
        break;
      case "depto_externo":
        if (Array.isArray(valor)) c.deptoExterno = valor as string[];
        break;
      case "depto_apelido":
        if (valor && typeof valor === "object") c.deptoApelido = valor as Record<string, string>;
        break;
      default:
        // Chave que o motor não conhece fica no banco sem efeito. É de propósito:
        // a tela de regras pode guardar coisa que só ela usa, e uma chave nova
        // não deve derrubar a geração da escala.
        break;
    }
  }
  return c;
}

export interface OpcoesCarregar {
  /** As datas que serão geradas. Define a janela de carga (`max`) e o mês alvo. */
  datas: string[];
  /** Data de referência para "meses recentes". Explícita para o resultado não depender do relógio. */
  hojeIso: string;
}

export interface MotorCarregado {
  entrada: EntradaMotor;
  estado: EstadoLote;
}

/**
 * Lê tudo que o motor precisa da organização e devolve entrada + estado.
 *
 * Usa o client que o chamador passar: com o client do servidor (RLS ligada), a
 * leitura já vem restrita à organização de quem pediu; com o admin client, o
 * filtro `organization_id` explícito abaixo é a única fronteira — e é por isso
 * que ele não é opcional em lugar nenhum daqui.
 */
export async function carregarMotor(
  db: SupabaseClient,
  organizationId: string,
  opcoes: OpcoesCarregar,
): Promise<MotorCarregado> {
  const org = organizationId;

  const [configRows, setorRows, subRows, volRows, casalRows, liderRows] = await Promise.all([
    ok(await db.from("escala_config").select("chave, valor").eq("organization_id", org), "config"),
    ok(
      await db
        .from("escala_setores")
        .select(
          "id, nome, posicao, nucleo, dupla_decente, casal_junto, so_casal, pool_pequeno, externo, rodizio_inverso_quinta, reforco_se_off, ativo",
        )
        .eq("organization_id", org)
        .order("posicao")
        .order("nome"),
      "setores",
    ),
    ok(
      await db
        .from("escala_subfuncoes")
        .select(
          "id, setor_id, nome, qtd, qtd_por_dia, posicao, time_fixo, prioridade, pool_extra, por_frequencia, max_do_grupo, dupla_decente, casal_junto, mesmo_sexo_que_id, conjuge_de_id",
        )
        .eq("organization_id", org)
        .order("posicao")
        .order("nome"),
      "subfuncoes",
    ),
    ok(
      await db
        .from("escala_voluntarios")
        .select(
          "id, nome, sexo, status, departamento, dias_permitidos, setores_bloqueados, setores_permitidos, ausente_de, ausente_ate, max_por_mes, reserva",
        )
        .eq("organization_id", org)
        .order("nome"),
      "voluntarios",
    ),
    ok(
      await db
        .from("escala_casais")
        .select("voluntario_a, voluntario_b, confirmado")
        .eq("organization_id", org),
      "casais",
    ),
    ok(
      await db
        .from("escala_lideres")
        .select("setor_id, voluntario_id, papel")
        .eq("organization_id", org),
      "lideres",
    ),
  ]);

  const config = montarConfig(configRows as { chave: string; valor: unknown }[]);

  const nomeDoId = new Map<string, string>();
  for (const v of volRows as LinhaVoluntario[]) nomeDoId.set(v.id, v.nome);
  /** uuid[] → nomes, descartando quem não existe mais (FK de array não protege). */
  const nomes = (ids: string[]): string[] =>
    ids.map((id) => nomeDoId.get(id)).filter((n): n is string => Boolean(n));

  const setorDoId = new Map<string, LinhaSetor>();
  for (const s of setorRows as LinhaSetor[]) setorDoId.set(s.id, s);
  const subDoId = new Map<string, LinhaSubfuncao>();
  for (const s of subRows as LinhaSubfuncao[]) subDoId.set(s.id, s);

  /** Referência entre vagas: uuid → [setor, subfunção], que é como o motor lê. */
  const refDaVaga = (id: string | null): [string, string] | null => {
    if (!id) return null;
    const sub = subDoId.get(id);
    const setor = sub ? setorDoId.get(sub.setor_id) : undefined;
    return sub && setor ? [setor.nome, sub.nome] : null;
  };

  const setores: Setor[] = (setorRows as LinhaSetor[])
    .filter((s) => s.ativo)
    .map((s) => {
      const subfuncoes: Subfuncao[] = (subRows as LinhaSubfuncao[])
        .filter((x) => x.setor_id === s.id)
        .map((x) => ({
          nome: x.nome,
          qtd: x.qtd,
          qtdPorDia: x.qtd_por_dia ?? {},
          timeFixo: nomes(x.time_fixo ?? []),
          prioridade: nomes(x.prioridade ?? []),
          poolExtra: nomes(x.pool_extra ?? []),
          porFrequencia: x.por_frequencia,
          maxDoGrupo: x.max_do_grupo,
          duplaDecente: x.dupla_decente,
          casalJunto: x.casal_junto,
          mesmoSexoQue: refDaVaga(x.mesmo_sexo_que_id),
          conjugeDe: refDaVaga(x.conjuge_de_id),
        }));
      return {
        nome: s.nome,
        posicao: s.posicao,
        nucleo: s.nucleo,
        duplaDecente: s.dupla_decente,
        casalJunto: s.casal_junto,
        soCasal: s.so_casal,
        poolPequeno: s.pool_pequeno,
        externo: s.externo,
        rodizioInversoQuinta: s.rodizio_inverso_quinta,
        reforcoSeOff: s.reforco_se_off ?? [],
        subfuncoes,
      };
    });

  const regras = new Map<string, RegraVoluntario>();
  const sexo = new Map<string, SexoVoluntario>();
  const reserva = new Set<string>();
  for (const v of volRows as LinhaVoluntario[]) {
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
    if (v.reserva) reserva.add(v.nome);
  }

  const casais = new Map<string, string>();
  for (const c of casalRows as {
    voluntario_a: string;
    voluntario_b: string;
    confirmado: boolean;
  }[]) {
    // Só par confirmado: o derivado do histórico é sugestão para a liderança
    // conferir, e tratar sugestão como casamento poria duas pessoas sozinhas
    // numa vaga isolada com base num palpite.
    if (!c.confirmado) continue;
    const a = nomeDoId.get(c.voluntario_a);
    const b = nomeDoId.get(c.voluntario_b);
    if (!a || !b) continue;
    casais.set(a, b);
    casais.set(b, a);
  }

  const lideres = new Map<string, Set<string>>();
  for (const l of liderRows as {
    setor_id: string | null;
    voluntario_id: string;
    papel: string;
  }[]) {
    // Liderança geral (setor_id null) não pesa em vaga nenhuma: ela existe para
    // receber aviso de ausência. E só papel que COMEÇA com "LIDER" pesa —
    // supervisionar o culto não é liderar uma equipe.
    if (!l.setor_id) continue;
    if (!norm(l.papel).startsWith(config.papelLideranca)) continue;
    const setor = setorDoId.get(l.setor_id);
    const nome = nomeDoId.get(l.voluntario_id);
    if (!setor || !nome) continue;
    const s = lideres.get(setor.nome) ?? new Set<string>();
    s.add(nome);
    lideres.set(setor.nome, s);
  }

  // ── Histórico, paginado ───────────────────────────────────────────────────
  const historico: RegistroHistorico[] = [];
  for (let de = 0; ; de += PAGINA) {
    const pagina = ok(
      await db
        .from("escala_historico")
        .select("voluntario_id, ano, mes, dia, dia_semana, setor, subfuncao, ordem, id")
        .eq("organization_id", org)
        // `ordem` é a posição na planilha de origem (migration 0148) e vem
        // primeiro porque É o desempate que o motor usa. `nullsFirst: false`
        // manda o histórico importado antes da 0148 para o fim, onde ele cai no
        // critério cronológico — o comportamento de antes, para quem não
        // reimportou.
        .order("ordem", { nullsFirst: false })
        .order("ano")
        .order("mes")
        .order("dia", { nullsFirst: true })
        .order("setor")
        .order("subfuncao")
        .order("id")
        .range(de, de + PAGINA - 1),
      "historico",
    ) as {
      voluntario_id: string;
      ano: number;
      mes: number;
      dia: number | null;
      dia_semana: string;
      setor: string;
      subfuncao: string;
    }[];
    for (const h of pagina) {
      const nome = nomeDoId.get(h.voluntario_id);
      if (!nome) continue;
      historico.push({
        nome,
        ano: h.ano,
        mes: h.mes,
        dia: h.dia,
        diaSemana: h.dia_semana,
        setor: h.setor,
        subfuncao: h.subfuncao,
      });
    }
    if (pagina.length < PAGINA) break;
  }

  // ── Cultos já registrados: escala externa, fixados, setores OFF e vetos ──
  const cultoRows = ok(
    await db.from("escala_cultos").select("id, data").eq("organization_id", org),
    "cultos",
  ) as { id: string; data: string }[];
  const dataDoCulto = new Map<string, string>(cultoRows.map((c) => [c.id, c.data]));

  const slotRows = ok(
    await db
      .from("escala_slots")
      .select("culto_id, setor_id, subfuncao_id, voluntario_id, origem, vetados, posicao")
      .eq("organization_id", org)
      .order("culto_id")
      .order("posicao"),
    "slots",
  ) as {
    culto_id: string;
    setor_id: string;
    subfuncao_id: string | null;
    voluntario_id: string | null;
    origem: string;
    vetados: string[];
    posicao: number;
  }[];

  const externa: RegistroExterno[] = [];
  const ocupados = new Map<string, Set<string>>();
  const fixados = new Map<string, string[]>();
  const rejeitados = new Map<string, Set<string>>();

  for (const s of slotRows) {
    const data = dataDoCulto.get(s.culto_id);
    const setor = setorDoId.get(s.setor_id);
    if (!data || !setor) continue;
    const sub = s.subfuncao_id ? (subDoId.get(s.subfuncao_id)?.nome ?? "") : "";
    const nome = s.voluntario_id ? nomeDoId.get(s.voluntario_id) : undefined;

    if (s.origem === "externo" && nome) {
      externa.push({ data, nome });
      const set = ocupados.get(data) ?? new Set<string>();
      set.add(nome);
      ocupados.set(data, set);
    }
    if (s.origem === "fixado" && nome) {
      const k = chave(data, setor.nome, sub);
      fixados.set(k, [...(fixados.get(k) ?? []), nome]);
    }
    // Veto é por (data, setor): trocar de subfunção não contorna.
    for (const id of s.vetados ?? []) {
      const vetado = nomeDoId.get(id);
      if (!vetado) continue;
      const k = chave(data, setor.nome);
      const set = rejeitados.get(k) ?? new Set<string>();
      set.add(vetado);
      rejeitados.set(k, set);
    }
  }

  const offRows = ok(
    await db
      .from("escala_setor_off")
      .select("culto_id, setor_id, motivo")
      .eq("organization_id", org),
    "setor_off",
  ) as { culto_id: string; setor_id: string; motivo: string }[];
  const setoresOff = new Map<string, Map<string, string>>();
  for (const o of offRows) {
    const data = dataDoCulto.get(o.culto_id);
    const setor = setorDoId.get(o.setor_id);
    if (!data || !setor) continue;
    const m = setoresOff.get(chave(data)) ?? new Map<string, string>();
    m.set(setor.nome, o.motivo);
    setoresOff.set(chave(data), m);
  }

  // ── Perfis, demanda e estado do lote ─────────────────────────────────────
  const hoje = new Date(`${opcoes.hojeIso}T00:00:00Z`);
  const perfis = construirPerfis(historico, hoje, config.mesesRecentes);
  const recentes = historico.filter(
    (r) => idadeMeses(competencia(r), hoje) <= config.mesesRecentes,
  );

  const ate = opcoes.datas.reduce((a, b) => (a > b ? a : b));
  const estado: EstadoLote = {
    cargaMes: new Map(),
    cargaPeriodo: cargaPorPeriodo(historico, externa, ate, config.semanasDescanso),
    naVaga: vezesNaVaga(historico, ate, config.semanasDescanso),
    rodadas: equipesPorRodada(historico, externa, config.quintaAposDomingo),
    vagasDomingo: vagasDoDomingo(historico),
    equipeDomingo: equipeDoSetorNoDomingo(historico),
  };

  // Quem já serviu no MÊS ALVO conta para o rodízio desde a primeira vaga.
  const anoAlvo = Number(opcoes.datas[0]!.slice(0, 4));
  const mesAlvo = Number(opcoes.datas[0]!.slice(5, 7));
  for (const r of recentes) {
    if (r.ano === anoAlvo && r.mes === mesAlvo) {
      estado.cargaMes.set(r.nome, (estado.cargaMes.get(r.nome) ?? 0) + 1);
    }
  }

  const entrada: EntradaMotor = {
    config,
    setores,
    regras,
    perfis,
    casais,
    sexo,
    lideres,
    historico,
    externa,
    demanda: modeloDemanda(recentes),
    ocupados,
    reserva,
    rejeitados,
    fixados,
    setoresOff,
  };

  return { entrada, estado };
}
