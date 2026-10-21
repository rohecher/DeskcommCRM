/**
 * Quando e em que ritmo os avisos da escala saem (spec `tasks/avisos-da-escala`, seção 3).
 *
 * O ritmo NÃO é fixo: depende de quantas pessoas estão na escala da semana e do que o número
 * de WhatsApp aguenta. Uma igreja com 35 pessoas termina em duas horas; uma com 1.500 precisa de
 * dias, e o plano diz isso em vez de estourar a regra de antibanimento para caber no prazo.
 *
 * Funções puras: sem relógio, sem banco, sem WhatsApp. Quem envia lê o plano e respeita o bloco
 * da hora corrente.
 */

const UMA_HORA = 3_600_000;
/** Brasília: UTC-3, sem horário de verão desde 2019. */
const FUSO_BRASILIA_MINUTOS = -180;

export function capacidadePorHora(p: { tetoPorHora: number; limiteDiario: number; horasDaJanela: number }): number {
  // O limite diário do número manda quando é menor: 300 por dia em 15 horas de janela são 20 por hora.
  return Math.max(1, Math.min(p.tetoPorHora, Math.floor(p.limiteDiario / p.horasDaJanela)));
}

export interface EntradaDoDisparo {
  /** Quantas mensagens vão sair. */
  total: number;
  /** Quando a convocação abre (as horas anteriores não contam). */
  abreEm: Date;
  /** Até quando era desejável terminar. */
  prazo: Date;
  /** Mensagens por hora (`capacidadePorHora`). */
  capacidade: number;
  /** Janela do dia em hora local: [inicio, fim). */
  janelaInicio: number;
  janelaFim: number;
  /** Dias da semana sem envio (0 = domingo). */
  diasSemEnvio: readonly number[];
  fusoMinutos?: number;
}

export interface BlocoDeEnvio {
  inicio: Date;
  quantidade: number;
}

export interface PlanoDeDisparo {
  blocos: BlocoDeEnvio[];
  terminaEm: Date | null;
  horasNecessarias: number;
  cabeNoPrazo: boolean;
}

export function planejarDisparo(e: EntradaDoDisparo): PlanoDeDisparo {
  if (!Number.isInteger(e.capacidade) || e.capacidade < 1) {
    throw new Error(`capacidade inválida: ${e.capacidade}`);
  }
  if (e.total <= 0) return { blocos: [], terminaEm: null, horasNecessarias: 0, cabeNoPrazo: true };

  const fuso = e.fusoMinutos ?? FUSO_BRASILIA_MINUTOS;
  const liberada = (quando: Date): boolean => {
    const local = new Date(quando.getTime() + fuso * 60_000);
    const hora = local.getUTCHours();
    return hora >= e.janelaInicio && hora < e.janelaFim && !e.diasSemEnvio.includes(local.getUTCDay());
  };

  // Começa na próxima virada de hora: dividir a hora corrente pela metade só complicaria o ritmo.
  let inicio = new Date(Math.ceil(e.abreEm.getTime() / UMA_HORA) * UMA_HORA);
  let faltam = e.total;
  const blocos: BlocoDeEnvio[] = [];
  // Um ano de horas: se a regra não deixar nenhuma hora livre, falha alto em vez de girar para sempre.
  for (let guarda = 0; faltam > 0; guarda++) {
    if (guarda > 24 * 366) throw new Error("nenhuma hora livre para enviar: confira a janela e os dias sem envio");
    if (liberada(inicio)) {
      const quantidade = Math.min(e.capacidade, faltam);
      blocos.push({ inicio: new Date(inicio), quantidade });
      faltam -= quantidade;
    }
    inicio = new Date(inicio.getTime() + UMA_HORA);
  }

  const terminaEm = new Date(blocos[blocos.length - 1]!.inicio.getTime() + UMA_HORA);
  return { blocos, terminaEm, horasNecessarias: blocos.length, cabeNoPrazo: terminaEm.getTime() <= e.prazo.getTime() };
}
