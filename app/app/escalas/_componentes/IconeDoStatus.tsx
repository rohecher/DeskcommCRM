import { ROTULO_DO_STATUS, type StatusDaVaga } from "@/lib/escalas/status";
import { ArrowsClockwise, CalendarBlank, CheckCircle, ThumbsUp, XCircle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ICONE = {
  escalado: CalendarBlank,
  confirmado: ThumbsUp,
  troca_solicitada: ArrowsClockwise,
  presente: CheckCircle,
  faltou: XCircle,
} as const;

/** Mesmas cores da legenda do sistema que a liderança já usava. */
export const COR_DO_STATUS: Record<StatusDaVaga, string> = {
  escalado: "text-text-muted",
  confirmado: "text-success-fg",
  troca_solicitada: "text-warning-fg",
  presente: "text-success-fg",
  faltou: "text-error-fg",
};

/**
 * O ícone do status da vaga. "Escalado" é o normal e não chama atenção; os
 * outros quatro são o que a liderança procura de relance no card.
 */
export function IconeDoStatus({
  status,
  size = 14,
  className,
}: {
  status: StatusDaVaga;
  size?: number;
  className?: string;
}) {
  const Icone = ICONE[status];
  return (
    <Icone
      size={size}
      weight={status === "escalado" ? "regular" : "fill"}
      className={cn("shrink-0", COR_DO_STATUS[status], className)}
      aria-label={ROTULO_DO_STATUS[status]}
      role="img"
    />
  );
}
