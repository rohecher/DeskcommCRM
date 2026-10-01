import Link from "next/link";

import type { CultoDoMes, VagaDoMes } from "@/lib/escalas/consultas";
import { bonito, diaMes } from "@/lib/escalas/formato";
import { nomeDoCulto } from "@/lib/escalas/mes";
import { ArrowRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import { IconeDoStatus } from "./IconeDoStatus";
import { VagaEditavel } from "./VagaEditavel";

const DIA_CURTO: Record<string, string> = {
  DOMINGO: "DOM",
  SEGUNDA: "SEG",
  TERCA: "TER",
  QUARTA: "QUA",
  QUINTA: "QUI",
  SEXTA: "SEX",
  SABADO: "SÁB",
};

/** "01/10 (QUI) · 19:20" — como a liderança escreve a data na escala. */
export function dataDoCulto(data: string, diaSemana: string, hora: string | null): string {
  const dia = DIA_CURTO[diaSemana] ?? diaSemana;
  return `${diaMes(data)} (${dia})${hora ? ` · ${hora.slice(0, 5)}` : ""}`;
}

/** Marca colorida da vaga: a mesma cor da legenda do cabeçalho. */
function corDaOrigem(origem: string): string {
  if (origem === "fixado") return "bg-info-fg";
  if (origem === "manual") return "bg-warning-fg";
  if (origem === "externo") return "bg-text-muted";
  return "bg-accent";
}

/**
 * Uma vaga. O rótulo é a SUBFUNÇÃO ("Recepção", "Sala Maior"); vaga de setor sem
 * subdivisão (cafeteria, estacionamento) não leva rótulo — o setor já está no
 * título logo acima, e repeti-lo em cada caixa só empurrava o nome para fora.
 *
 * O nome quebra linha em vez de ser cortado: "Luiz Paulo De ..." obriga a abrir
 * o culto para saber se é o pai ou o filho.
 */
function Vaga({ vaga, rotulo }: { vaga: VagaDoMes; rotulo: string | null }) {
  const legenda = rotulo ? (
    <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-text-muted">{rotulo}</p>
  ) : null;
  if (!vaga.nome) {
    return (
      <div className="rounded-lg border border-dashed border-warning-fg/50 bg-warning-bg/30 px-3 py-2">
        {legenda}
        <p className="text-sm italic leading-snug text-warning-fg">
          Vaga aberta{vaga.motivo ? ` · ${vaga.motivo}` : ""}
        </p>
      </div>
    );
  }
  // Pediu troca é a vaga que precisa de gente: borda laranja e o motivo à vista.
  const troca = vaga.status === "troca_solicitada";
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2",
        troca ? "border-warning-fg/60 bg-warning-bg/30" : "border-border bg-surface-elevated",
      )}
    >
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", corDaOrigem(vaga.origem))} aria-hidden />
      <div className="min-w-0 flex-1">
        {legenda}
        <p className={cn("break-words text-sm font-medium leading-snug", vaga.status === "faltou" && "line-through decoration-error-fg/60")}>
          {vaga.nome}
        </p>
        {troca && vaga.statusObs && <p className="text-xs leading-snug text-warning-fg">{vaga.statusObs}</p>}
      </div>
      {vaga.origem !== "externo" && <IconeDoStatus status={vaga.status} className="mt-0.5" />}
    </div>
  );
}

/**
 * Um culto do mês: quem está onde e quanto falta.
 *
 * O que manda no card é a vaga ABERTA — tracejada e em amarelo —, porque é a
 * única coisa sobre a qual alguém precisa agir. A barra de progresso responde
 * "esse culto está pronto?" sem precisar contar nomes.
 */
export function CartaoDoCulto({
  item,
  hoje,
  podeEditar,
}: {
  item: CultoDoMes;
  hoje: string;
  /** Líder de Ministério para cima: a vaga vira botão que abre a edição. */
  podeEditar: boolean;
}) {
  const { culto, tipo, porSetor } = item;
  const escalados = culto.vagas - culto.abertas;
  const pct = culto.vagas > 0 ? Math.round((escalados / culto.vagas) * 100) : 0;
  const ehHoje = culto.data === hoje;
  const passou = culto.data < hoje;
  const oracao = tipo === "oracao";

  return (
    <article
      id={`culto-${culto.data}`}
      className={cn(
        "flex flex-col rounded-xl border bg-surface shadow-xs",
        ehHoje ? "border-accent ring-1 ring-accent/40" : "border-border",
        passou && !ehHoje && "opacity-75",
      )}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-border p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {nomeDoCulto(culto.diaSemana, tipo)}
            {ehHoje && (
              <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                HOJE
              </span>
            )}
          </p>
          <h2 className="text-lg font-semibold">{dataDoCulto(culto.data, culto.diaSemana, culto.hora)}</h2>
          {!oracao && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div
                className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-elevated"
                role="progressbar"
                aria-valuenow={escalados}
                aria-valuemin={0}
                aria-valuemax={culto.vagas}
                aria-label="Vagas preenchidas"
              >
                <div
                  className={cn("h-full rounded-full", culto.abertas > 0 ? "bg-warning-fg" : "bg-success-fg")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm text-text-muted">
                {escalados}/{culto.vagas} escalados
              </span>
              {culto.abertas > 0 ? (
                <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-fg">
                  {culto.abertas} em aberto
                </span>
              ) : (
                <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-fg">
                  completo
                </span>
              )}
              {item.confirmados > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                  <IconeDoStatus status="confirmado" size={12} /> {item.confirmados} confirmados
                </span>
              )}
              {item.trocas > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-fg">
                  <IconeDoStatus status="troca_solicitada" size={12} />
                  {item.trocas} {item.trocas === 1 ? "pediu troca" : "pediram troca"}
                </span>
              )}
            </div>
          )}
        </div>
        <Link
          href={`/app/escalas/${culto.data}`}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Abrir <ArrowRight size={12} aria-hidden />
        </Link>
      </header>

      <div className="space-y-4 p-4">
        {porSetor.map(({ setor, off, vagas }) => (
          <section key={setor}>
            <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              {bonito(setor)}
              {off !== null && (
                <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-normal normal-case text-text-muted">
                  não haverá{off ? ` · ${off}` : ""}
                </span>
              )}
            </h3>
            {vagas.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {vagas.map((v) => {
                  const caixa = <Vaga vaga={v} rotulo={v.subfuncao ? bonito(v.subfuncao) : null} />;
                  // Vaga do louvor não se edita aqui: a escala dele vem do próprio
                  // ministério, e trocar o nome no Cajado criaria duas verdades.
                  if (!podeEditar || v.origem === "externo") return <div key={v.id}>{caixa}</div>;
                  return (
                    <VagaEditavel
                      key={v.id}
                      slotId={v.id}
                      culto={`${nomeDoCulto(culto.diaSemana, tipo)} · ${dataDoCulto(culto.data, culto.diaSemana, culto.hora)}`}
                      funcao={v.subfuncao ? `${bonito(v.subfuncao)} (${bonito(setor)})` : bonito(setor)}
                    >
                      {caixa}
                    </VagaEditavel>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
