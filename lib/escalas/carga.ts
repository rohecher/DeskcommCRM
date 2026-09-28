/**
 * Carga e perfil: quanto cada pessoa serviu, e o que ela costuma servir.
 *
 * O motor prefere quem está descansado a quem tem mais histórico no setor — a
 * liderança escala quem folgou, não quem é mais especialista. Por isso a carga
 * pesa `pesoRodizio` vezes mais que a afinidade na nota, e por isso ela precisa
 * estar certa: carga subestimada faz a mesma pessoa servir quatro cultos
 * seguidos, que foi exatamente a reclamação sobre a dupla da Cafeteria.
 */
import type { Perfil, RegistroExterno, RegistroHistorico } from "./dominio";
import { chave } from "./normalizar";
import { dataDoRegistro, diasEntre } from "./rodada";

/** Incrementa um contador em Map, tratando ausência como zero. */
export function inc<K>(m: Map<K, number>, k: K, quanto = 1): void {
  m.set(k, (m.get(k) ?? 0) + quanto);
}

/** Competência (ano, mes) do registro. */
export function competencia(r: RegistroHistorico): [number, number] {
  return [r.ano, r.mes];
}

export function idadeMeses(comp: [number, number], hoje: Date): number {
  return (hoje.getUTCFullYear() - comp[0]) * 12 + (hoje.getUTCMonth() + 1 - comp[1]);
}

/**
 * Nome → em quantos cultos DISTINTOS serviu na janela.
 *
 * Distintos, não linhas: quem cobre duas subfunções no mesmo culto trabalhou uma
 * vez, não duas. Contar linhas puniria quem topa dobrar função numa noite
 * apertada, que é o oposto do incentivo que a escala deve dar.
 */
export function cargaPorPeriodo(
  historico: RegistroHistorico[],
  externa: RegistroExterno[],
  ateIso: string,
  semanas: number,
): Map<string, number> {
  const dias = new Map<string, Set<string>>();
  const naJanela = (d: string) => {
    const atras = diasEntre(ateIso, d);
    return atras >= 0 && atras <= semanas * 7;
  };
  const juntar = (nome: string, d: string) => {
    const s = dias.get(nome) ?? new Set<string>();
    s.add(d);
    dias.set(nome, s);
  };
  for (const r of historico) {
    const d = dataDoRegistro(r);
    if (d && naJanela(d)) juntar(r.nome, d);
  }
  for (const r of externa) {
    if (naJanela(r.data)) juntar(r.nome.trim(), r.data);
  }
  const saida = new Map<string, number>();
  for (const [nome, s] of dias) saida.set(nome, s.size);
  return saida;
}

/**
 * `chave(nome, setor, subfuncao)` → vezes que pegou ESSA vaga na janela.
 *
 * Sem isso o desempate por afinidade entrega sempre a mesma vaga à mesma
 * pessoa: todos empatam na carga e quem tem mais histórico no setor ganha toda
 * vez. É o que mantém o rodízio DENTRO do setor, não só entre setores.
 */
export function vezesNaVaga(
  historico: RegistroHistorico[],
  ateIso: string,
  semanas: number,
): Map<string, number> {
  const conta = new Map<string, number>();
  for (const r of historico) {
    const d = dataDoRegistro(r);
    if (!d) continue;
    const atras = diasEntre(ateIso, d);
    if (atras < 0 || atras > semanas * 7) continue;
    inc(conta, chave(r.nome, r.setor, r.subfuncao));
  }
  return conta;
}

/**
 * Nome → perfil. A ORDEM DE INSERÇÃO IMPORTA e é a do histórico.
 *
 * `gerar()` percorre os candidatos nesta ordem, e a ordenação por nota é
 * ESTÁVEL: duas pessoas com a mesma nota saem na ordem em que apareceram aqui.
 * Reordenar este Map (por nome, por exemplo) mudaria escalas que a liderança já
 * aprovou, sem mudar regra nenhuma. O Python depende do mesmo detalhe, porque
 * `dict` preserva inserção desde a 3.7.
 */
export function construirPerfis(
  historico: RegistroHistorico[],
  hoje: Date,
  mesesRecentes: number,
): Map<string, Perfil> {
  const perfis = new Map<string, Perfil>();
  const doNome = (nome: string): Perfil => {
    let p = perfis.get(nome);
    if (!p) {
      p = {
        setores: new Map(),
        dias: new Map(),
        subs: new Map(),
        ultima: null,
        ultimaData: null,
        total: 0,
        recente: 0,
      };
      perfis.set(nome, p);
    }
    return p;
  };

  for (const r of historico) {
    const p = doNome(r.nome);
    inc(p.setores, r.setor);
    inc(p.dias, r.diaSemana);
    if (r.subfuncao) {
      const porSub = p.subs.get(r.setor) ?? new Map<string, number>();
      inc(porSub, r.subfuncao);
      p.subs.set(r.setor, porSub);
    }
    p.total += 1;
    const comp = competencia(r);
    if (
      p.ultima === null ||
      comp[0] > p.ultima[0] ||
      (comp[0] === p.ultima[0] && comp[1] > p.ultima[1])
    ) {
      p.ultima = comp;
    }
    const exata = dataDoRegistro(r);
    if (exata && (p.ultimaData === null || exata > p.ultimaData)) p.ultimaData = exata;
  }

  // `recente` é contado em segunda passada, como no Python: a janela de meses
  // recentes é a mesma que define o modelo de demanda.
  for (const r of historico) {
    if (idadeMeses(competencia(r), hoje) <= mesesRecentes) {
      const p = perfis.get(r.nome);
      if (p) p.recente += 1;
    }
  }
  return perfis;
}

/** Perfil vazio para quem a liderança está trazendo agora (o `poolExtra`). */
export function garantirPerfil(perfis: Map<string, Perfil>, nome: string): void {
  if (perfis.has(nome)) return;
  perfis.set(nome, {
    setores: new Map(),
    dias: new Map(),
    subs: new Map(),
    ultima: null,
    ultimaData: null,
    total: 0,
    recente: 0,
  });
}
