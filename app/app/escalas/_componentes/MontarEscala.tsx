"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bonito, diaCurto, diaMes } from "@/lib/escalas/formato";
import { diaDaSemanaIso } from "@/lib/escalas/mes";
import type { ResumoDaMontagem } from "@/lib/escalas/montar";
import { Sparkle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import {
  descartarEscala,
  montarEscala,
  previaDaMontagem,
  publicarEscala,
  type PreviaDaMontagem,
} from "../_acoes";

const MOTIVO: Record<string, string> = {
  publicado: "já publicada",
  ja_passou: "já passou",
};

function rotuloDaData(iso: string): string {
  return `${diaMes(iso)} (${diaCurto(diaDaSemanaIso(iso))})`;
}

/**
 * "Montar escala": o motor sugere o mês e grava como RASCUNHO.
 *
 * A janela mostra o plano antes de rodar — quais datas vão ser geradas e quais
 * ficam como estão (publicadas ou passadas) — porque "montar" mexe em muita vaga
 * de uma vez e a liderança precisa saber o que vai acontecer antes de apertar.
 */
export function BotaoMontarEscala({ mes, nomeDoMes }: { mes: string; nomeDoMes: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [previa, setPrevia] = useState<PreviaDaMontagem | null>(null);
  const [resumo, setResumo] = useState<ResumoDaMontagem | null>(null);
  const [lendo, iniciarLeitura] = useTransition();
  const [montando, iniciarMontagem] = useTransition();

  function abrir() {
    setAberta(true);
    setPrevia(null);
    setResumo(null);
    iniciarLeitura(async () => setPrevia(await previaDaMontagem(mes)));
  }

  function montar() {
    iniciarMontagem(async () => {
      const r = await montarEscala(mes);
      if (!r.ok) {
        toast.error("Não deu para montar a escala agora. Tente de novo.");
        return;
      }
      setResumo(r.resumo);
      router.refresh();
    });
  }

  const gerar = previa?.ok ? previa.gerar : [];

  return (
    <>
      <Button size="sm" onClick={abrir} className="gap-1.5">
        <Sparkle size={14} aria-hidden /> Montar escala
      </Button>

      <Dialog open={aberta} onOpenChange={(v) => !montando && setAberta(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Montar a escala de {nomeDoMes.toLocaleLowerCase("pt-BR")}</DialogTitle>
            <DialogDescription>
              O motor sugere os nomes pelas mesmas regras de sempre: rodízio, casais, quem serviu
              recentemente, ausências e o louvor. Sai como rascunho, que só a liderança vê até ser
              publicado.
            </DialogDescription>
          </DialogHeader>

          {lendo && <p className="py-4 text-center text-sm text-text-muted">Conferindo o mês…</p>}
          {previa && !previa.ok && (
            <p className="py-4 text-center text-sm text-error-fg">Não deu para conferir o mês agora.</p>
          )}

          {previa?.ok && !resumo && (
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {previa.datas.map((d) => {
                const pulado = previa.pulados.find((p) => p.data === d);
                return (
                  <li
                    key={d}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5",
                      pulado ? "border-border text-text-muted" : "border-accent bg-accent-soft",
                    )}
                  >
                    <span className="font-medium">{rotuloDaData(d)}</span>
                    <span className="block text-xs">{pulado ? MOTIVO[pulado.motivo] : "vai ser montado"}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {resumo && (
            <div className="space-y-3 text-sm">
              <p>
                {resumo.gerados.length === 0
                  ? "Nenhum culto foi montado."
                  : `${resumo.gerados.length} ${resumo.gerados.length === 1 ? "culto montado" : "cultos montados"}, com ${resumo.gerados.reduce((n, g) => n + g.vagas, 0)} vagas.`}{" "}
                Confira nos cards e publique quando estiver certo.
              </p>
              {resumo.faltas.length > 0 && (
                <div className="rounded-lg border border-warning-fg/50 bg-warning-bg/30 p-3">
                  <p className="mb-1 font-medium text-warning-fg">Vagas que o motor não conseguiu preencher</p>
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                    {resumo.faltas.map((f, i) => (
                      <li key={`${f.data}-${f.vaga}-${i}`}>
                        {rotuloDaData(f.data)} · {f.vaga.split(" / ").map(bonito).join(" / ")} — {f.quantas}{" "}
                        {f.quantas === 1 ? "vaga" : "vagas"} ({f.motivo})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {resumo ? (
              <Button onClick={() => setAberta(false)}>Ver a escala</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAberta(false)} disabled={montando}>
                  Fechar
                </Button>
                <Button onClick={montar} disabled={montando || gerar.length === 0}>
                  {montando
                    ? "Montando…"
                    : gerar.length === 0
                      ? "Nada para montar"
                      : `Montar ${gerar.length} ${gerar.length === 1 ? "culto" : "cultos"}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * O aviso de que o mês tem rascunho: publicar (todos passam a ver) ou descartar.
 * Descartar pede confirmação, porque leva junto as trocas feitas à mão.
 */
export function AvisoDeRascunho({ mes, cultos }: { mes: string; cultos: number }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  function publicar() {
    iniciar(async () => {
      const r = await publicarEscala(mes);
      if (!r.ok) return void toast.error("Não deu para publicar agora. Tente de novo.");
      toast.success(`Escala publicada: ${r.cultos} ${r.cultos === 1 ? "culto" : "cultos"}.`);
      router.refresh();
    });
  }

  function descartar() {
    iniciar(async () => {
      const r = await descartarEscala(mes);
      setConfirmando(false);
      if (!r.ok) return void toast.error("Não deu para descartar agora. Tente de novo.");
      toast.success("Rascunho descartado.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-info-fg/40 bg-info-bg/40 px-4 py-3 text-sm">
      <p className="min-w-0 flex-1">
        <strong>Rascunho:</strong> {cultos} {cultos === 1 ? "culto ainda não publicado" : "cultos ainda não publicados"}.
        Só a liderança está vendo. Confira, troque o que precisar e publique.
      </p>
      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setConfirmando(true)}>
        Descartar
      </Button>
      <Button size="sm" disabled={ocupado} onClick={publicar}>
        {ocupado ? "Salvando…" : "Publicar escala"}
      </Button>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {cultos} cultos em rascunho somem, com as trocas feitas à mão neles. Os cultos já
              publicados não são tocados. Dá para montar de novo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={ocupado} onClick={descartar}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
