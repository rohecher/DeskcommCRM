/**
 * O status de uma vaga e QUANDO cada um pode ser marcado.
 *
 * O banco (migration 0149) só garante que o valor é um dos cinco. A regra de
 * calendário mora aqui, porque é regra de negócio e precisa de teste:
 *
 *   confirmado / troca_solicitada — de hoje em diante. Confirmar presença num
 *     culto que já passou não diz nada; o que serve ali é presente/faltou.
 *   presente / faltou — do dia do culto em diante. Marcar falta antes do culto
 *     seria adivinhar.
 *   escalado — sempre: é o "desfazer" de qualquer marcação.
 *
 * Vaga sem nome não tem status além de escalado: não há quem confirmar.
 */

export const STATUS_DA_VAGA = [
  "escalado",
  "confirmado",
  "troca_solicitada",
  "presente",
  "faltou",
] as const;

export type StatusDaVaga = (typeof STATUS_DA_VAGA)[number];

export function statusValido(s: unknown): s is StatusDaVaga {
  return typeof s === "string" && (STATUS_DA_VAGA as readonly string[]).includes(s);
}

/** Os rótulos da legenda — os mesmos do sistema que a liderança já usava. */
export const ROTULO_DO_STATUS: Record<StatusDaVaga, string> = {
  escalado: "Escalado",
  confirmado: "Confirmado",
  troca_solicitada: "Pediu troca",
  presente: "Presente",
  faltou: "Faltou",
};

/** Quais status podem ser marcados nesta vaga, hoje. */
export function statusPermitidos(
  dataCulto: string,
  hoje: string,
  temVoluntario: boolean,
): StatusDaVaga[] {
  if (!temVoluntario) return ["escalado"];
  const lista: StatusDaVaga[] = ["escalado"];
  if (dataCulto >= hoje) lista.push("confirmado", "troca_solicitada");
  if (dataCulto <= hoje) lista.push("presente", "faltou");
  return lista;
}

/** O motivo da recusa, ou vazio quando pode. Texto para a tela. */
export function motivoParaNaoMarcar(
  status: StatusDaVaga,
  dataCulto: string,
  hoje: string,
  temVoluntario: boolean,
): string {
  if (statusPermitidos(dataCulto, hoje, temVoluntario).includes(status)) return "";
  if (!temVoluntario) return "a vaga está sem ninguém";
  if (status === "presente" || status === "faltou") return "o culto ainda não aconteceu";
  return "o culto já passou";
}

/** Observação guardada com o status: curta, sem quebra de linha. */
export function obsLimpa(obs: unknown): string {
  if (typeof obs !== "string") return "";
  return obs.replace(/\s+/g, " ").trim().slice(0, 200);
}
