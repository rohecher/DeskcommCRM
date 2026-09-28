/**
 * Monta a `EntradaMotor` a partir dos JSON que o lado Python exporta.
 *
 * Existe para o teste de paridade: alimentar o motor TypeScript com EXATAMENTE
 * os mesmos dados que o motor Python lê, sem banco no caminho, e comparar as
 * duas escalas. Se a comparação passasse pelo Postgres, uma divergência não
 * diria se o defeito é do motor ou da importação.
 *
 * `repo.ts` faz o mesmo trabalho a partir das tabelas `escala_*`, e é ele que o
 * app usa.
 */
import { construirPerfis, competencia, idadeMeses } from "./carga";
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
} from "./dominio";
import { chave, norm } from "./normalizar";
import {
  cargaPorPeriodo as calcularCargaPorPeriodo,
  vezesNaVaga as calcularVezesNaVaga,
} from "./carga";
import { equipeDoSetorNoDomingo, equipesPorRodada, vagasDoDomingo } from "./rodada";

/** O formato de `regras.json` (exportar_regras.py). */
export interface RegrasJson {
  config: {
    max_padrao: number;
    peso_rodizio: number;
    bonus_casa: number;
    peso_lider: number;
    papel_lideranca: string;
    semanas_descanso: number;
    quinta_apos_domingo: number;
    reserva_max_no_mes: number;
    meses_recentes: number;
    inativo_meses: number;
    horario: Record<string, string>;
    depto_externo: string[];
    depto_apelido: Record<string, string>;
    fixo_no_mes: string[];
  };
  reserva: string[];
  setores: {
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
    subfuncoes: {
      nome: string;
      qtd: number;
      posicao: number;
      qtd_por_dia: Record<string, number>;
      time_fixo: string[];
      prioridade: string[];
      pool_extra: string[];
      por_frequencia: boolean;
      max_do_grupo: number | null;
      dupla_decente: boolean;
      casal_junto: boolean;
      mesmo_sexo_que: [string, string] | null;
      conjuge_de: [string, string] | null;
    }[];
  }[];
}

/** O formato de `dados.json` (exportar_dados.py). */
export interface DadosJson {
  voluntarios: {
    nome: string;
    sexo: "M" | "F" | null;
    status: string;
    departamento: string;
    dias_permitidos: string[];
    setores_bloqueados: string[];
    setores_permitidos: string[];
    ausente_de: string | null;
    ausente_ate: string | null;
    max_por_mes: number | null;
    telefone: string | null;
  }[];
  casais: { a: string; b: string; confirmado: boolean }[];
  lideres: { setor: string; nome: string; papel: string }[];
  cultos: {
    data: string;
    dia_semana: string;
    setores_off: { setor: string; motivo: string }[];
    slots: { setor: string; subfuncao: string; nome: string | null; origem: string }[];
  }[];
  vetados: { data: string; setor: string; subfuncao: string; nome: string }[];
  historico: {
    nome: string;
    ano: number;
    mes: number;
    dia: number | null;
    dia_semana: string;
    setor: string;
    subfuncao: string;
  }[];
}

function converterConfig(j: RegrasJson): Config {
  const c = j.config;
  return {
    maxPadrao: c.max_padrao,
    pesoRodizio: c.peso_rodizio,
    bonusCasa: c.bonus_casa,
    pesoLider: c.peso_lider,
    papelLideranca: c.papel_lideranca,
    semanasDescanso: c.semanas_descanso,
    quintaAposDomingo: c.quinta_apos_domingo,
    reservaMaxNoMes: c.reserva_max_no_mes,
    mesesRecentes: c.meses_recentes,
    horario: c.horario,
    deptoExterno: c.depto_externo,
    deptoApelido: c.depto_apelido,
  };
}

function converterSetores(j: RegrasJson): Setor[] {
  return j.setores.map((s) => ({
    nome: s.nome,
    posicao: s.posicao,
    nucleo: s.nucleo,
    duplaDecente: s.dupla_decente,
    casalJunto: s.casal_junto,
    soCasal: s.so_casal,
    poolPequeno: s.pool_pequeno,
    externo: s.externo,
    rodizioInversoQuinta: s.rodizio_inverso_quinta,
    reforcoSeOff: s.reforco_se_off,
    subfuncoes: s.subfuncoes.map((x) => ({
      nome: x.nome,
      qtd: x.qtd,
      qtdPorDia: x.qtd_por_dia,
      timeFixo: x.time_fixo,
      prioridade: x.prioridade,
      poolExtra: x.pool_extra,
      porFrequencia: x.por_frequencia,
      maxDoGrupo: x.max_do_grupo,
      duplaDecente: x.dupla_decente,
      casalJunto: x.casal_junto,
      mesmoSexoQue: x.mesmo_sexo_que,
      conjugeDe: x.conjuge_de,
    })),
  }));
}

/**
 * A escala externa (louvor, mídia, dança) sai dos slots com `origem: "externo"`.
 *
 * Ela tem dois papéis e os dois importam: marca a pessoa como OCUPADA naquele
 * culto, e entra na carga da rodada — quem tocou numa rodada já serviu nela e
 * não deve ser chamado na seguinte. Sem o segundo, a pessoa alterna louvor e
 * escala geral e nunca folga.
 */
function extrairExterna(d: DadosJson): {
  externa: RegistroExterno[];
  ocupados: Map<string, Set<string>>;
} {
  const externa: RegistroExterno[] = [];
  const ocupados = new Map<string, Set<string>>();
  for (const culto of d.cultos) {
    for (const s of culto.slots) {
      if (s.origem !== "externo" || !s.nome) continue;
      externa.push({ data: culto.data, nome: s.nome });
      const s0 = ocupados.get(culto.data) ?? new Set<string>();
      s0.add(s.nome.trim());
      ocupados.set(culto.data, s0);
    }
  }
  return { externa, ocupados };
}

/**
 * O histórico que o motor lê = a extração das planilhas MAIS a escala aprovada.
 *
 * `carregar_historico()` soma os dois porque o que a liderança de fato usou é o
 * que ensina o critério real de rodízio. Os slots aprovados já vêm dentro de
 * `historico` no export, então aqui só se converte.
 */
function converterHistorico(d: DadosJson): RegistroHistorico[] {
  return d.historico.map((h) => ({
    nome: h.nome,
    ano: h.ano,
    mes: h.mes,
    dia: h.dia,
    diaSemana: h.dia_semana,
    setor: h.setor,
    subfuncao: h.subfuncao,
  }));
}

export interface MotorPronto {
  entrada: EntradaMotor;
  estado: EstadoLote;
}

/**
 * Monta motor e estado para gerar `datas`.
 *
 * `hoje` e `ate` são explícitos porque o motor Python usa `date.today()` e
 * `max(datas)`: a janela de meses recentes depende do primeiro, e a janela de
 * carga do segundo. Deixar implícito faria o teste de paridade mudar de
 * resultado conforme o dia em que roda.
 */
export function montarMotor(
  regrasJson: RegrasJson,
  dados: DadosJson,
  datas: string[],
  hojeIso: string,
): MotorPronto {
  const config = converterConfig(regrasJson);
  const setores = converterSetores(regrasJson);
  const historico = converterHistorico(dados);
  const { externa, ocupados } = extrairExterna(dados);

  const hoje = new Date(`${hojeIso}T00:00:00Z`);
  const perfis = construirPerfis(historico, hoje, config.mesesRecentes);

  const recentes = historico.filter(
    (r) => idadeMeses(competencia(r), hoje) <= config.mesesRecentes,
  );

  const regras = new Map<string, RegraVoluntario>();
  for (const v of dados.voluntarios) {
    regras.set(v.nome, {
      status: v.status,
      departamento: v.departamento,
      dias: v.dias_permitidos,
      // O motor guarda estes dois JÁ normalizados e compara com `norm(setor)`.
      bloqueados: v.setores_bloqueados.map(norm),
      permitidos: v.setores_permitidos.map(norm),
      de: v.ausente_de ?? "",
      ate: v.ausente_ate ?? "",
      max: v.max_por_mes,
    });
  }

  const casais = new Map<string, string>();
  for (const c of dados.casais) {
    // Só par confirmado: o derivado do histórico é sugestão para a liderança
    // confirmar, e tratar sugestão como casamento poria duas pessoas sozinhas
    // numa vaga isolada com base num palpite.
    if (!c.confirmado) continue;
    casais.set(c.a, c.b);
    casais.set(c.b, c.a);
  }

  const sexo = new Map<string, SexoVoluntario>();
  for (const v of dados.voluntarios) if (v.sexo) sexo.set(v.nome, v.sexo);

  const lideres = new Map<string, Set<string>>();
  for (const l of dados.lideres) {
    // Só papel que COMEÇA com "LIDER" pesa. Supervisor de culto, coordenador
    // geral e pastor são funções, não liderança de equipe — quem supervisiona o
    // culto é escalado como qualquer outro.
    if (!norm(l.papel).startsWith(config.papelLideranca)) continue;
    const s = lideres.get(l.setor) ?? new Set<string>();
    s.add(l.nome);
    lideres.set(l.setor, s);
  }

  const rejeitados = new Map<string, Set<string>>();
  for (const v of dados.vetados) {
    // (data, setor): trocar de subfunção não contorna o veto.
    const k = chave(v.data, v.setor);
    const s = rejeitados.get(k) ?? new Set<string>();
    s.add(v.nome.trim());
    rejeitados.set(k, s);
  }

  const fixados = new Map<string, string[]>();
  const setoresOff = new Map<string, Map<string, string>>();
  for (const culto of dados.cultos) {
    for (const s of culto.slots) {
      if (s.origem !== "fixado" || !s.nome) continue;
      const k = chave(culto.data, s.setor, s.subfuncao);
      fixados.set(k, [...(fixados.get(k) ?? []), s.nome]);
    }
    if (culto.setores_off.length > 0) {
      const m = setoresOff.get(chave(culto.data)) ?? new Map<string, string>();
      for (const o of culto.setores_off) m.set(o.setor, o.motivo);
      setoresOff.set(chave(culto.data), m);
    }
  }

  const ate = datas.reduce((a, b) => (a > b ? a : b));
  const estado: EstadoLote = {
    cargaMes: new Map(),
    cargaPeriodo: calcularCargaPorPeriodo(historico, externa, ate, config.semanasDescanso),
    naVaga: calcularVezesNaVaga(historico, ate, config.semanasDescanso),
    rodadas: equipesPorRodada(historico, externa, config.quintaAposDomingo),
    vagasDomingo: vagasDoDomingo(historico),
    equipeDomingo: equipeDoSetorNoDomingo(historico),
  };

  // Quem já serviu no MÊS ALVO conta para o rodízio desde a primeira vaga.
  const [anoAlvo, mesAlvo] = [Number(datas[0]!.slice(0, 4)), Number(datas[0]!.slice(5, 7))];
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
    reserva: new Set(regrasJson.reserva),
    rejeitados,
    fixados,
    setoresOff,
  };

  return { entrada, estado };
}
