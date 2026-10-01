import Link from "next/link";

import { mesAnterior, mesSeguinte, nomeDoMes, type Mes } from "@/lib/escalas/mes";
import { CalendarBlank, CaretLeft, CaretRight, SquaresFour, Table } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type Vista = "cards" | "tabela";

export function hrefDoMes(mes: Mes, vista: Vista): string {
  const p = new URLSearchParams({ mes });
  if (vista === "tabela") p.set("vista", "tabela");
  return `/app/escalas?${p.toString()}`;
}

const botao =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text transition-colors hover:border-accent hover:text-accent";

/**
 * O topo da escala mensal: em que mês estou, como ando para os lados e como
 * quero ver. É o mesmo desenho do sistema que a liderança já usava — "mês
 * anterior / 10/2026 / próximo mês" e a troca entre cards e tabela.
 */
export function CabecalhoDoMes({
  mes,
  mesAtual,
  vista,
  resumo,
}: {
  mes: Mes;
  mesAtual: Mes;
  vista: Vista;
  resumo: { cultos: number; vagas: number; abertas: number };
}) {
  const escalados = resumo.vagas - resumo.abertas;
  return (
    <header className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <CalendarBlank size={22} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Escala mensal</p>
          <h1 className="text-2xl font-semibold tracking-tight">{nomeDoMes(mes)}</h1>
        </div>

        <nav className="flex items-center gap-2" aria-label="Trocar de mês">
          <Link href={hrefDoMes(mesAnterior(mes), vista)} className={botao}>
            <CaretLeft size={14} aria-hidden /> Mês anterior
          </Link>
          <Link href={hrefDoMes(mesSeguinte(mes), vista)} className={botao}>
            Próximo mês <CaretRight size={14} aria-hidden />
          </Link>
          {mes !== mesAtual && (
            <Link href={hrefDoMes(mesAtual, vista)} className={cn(botao, "text-accent")}>
              Mês atual
            </Link>
          )}
        </nav>

        <div
          className="ml-auto inline-flex rounded-lg border border-border bg-surface-elevated p-1"
          role="group"
          aria-label="Como ver a escala"
        >
          {(
            [
              ["cards", "Cards", SquaresFour],
              ["tabela", "Tabela", Table],
            ] as const
          ).map(([v, rotulo, Icone]) => (
            <Link
              key={v}
              href={hrefDoMes(mes, v)}
              aria-current={vista === v ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors",
                vista === v ? "bg-surface text-text shadow-xs" : "text-text-muted hover:text-text",
              )}
            >
              <Icone size={14} aria-hidden /> {rotulo}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-text-muted">
        <span className="font-medium uppercase tracking-wide">Legenda</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" aria-hidden /> Escalado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-dashed border-warning-fg" aria-hidden /> Vaga aberta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-info-fg" aria-hidden /> Fixado pela liderança
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-warning-fg" aria-hidden /> Trocado à mão
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-text-muted" aria-hidden /> Escala do louvor
        </span>
        {resumo.cultos > 0 && (
          <span className="ml-auto">
            {resumo.cultos} {resumo.cultos === 1 ? "culto" : "cultos"} · {escalados}/{resumo.vagas}{" "}
            escalados
            {resumo.abertas > 0 ? ` · ${resumo.abertas} em aberto` : ""}
          </span>
        )}
      </div>
    </header>
  );
}
