"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { VagaParaEditar } from "@/lib/escalas/editar";
import type { Candidato } from "@/lib/escalas/vaga";
import { cn } from "@/lib/utils";

import { opcoesDaVaga, salvarVaga } from "../_acoes";

const ERROS: Record<string, string> = {
  forbidden_role: "Só a liderança pode trocar nomes na escala.",
  unauthenticated: "Sua sessão expirou. Entre de novo.",
  not_found: "Essa vaga não existe mais. Recarregue a página.",
  nao_encontrada: "Essa vaga não existe mais. Recarregue a página.",
  vaga_externa: "Essa vaga é do louvor: a escala vem do próprio ministério.",
};

function sem(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function Pessoa({
  c,
  escolhido,
  onEscolher,
  aviso,
}: {
  c: Candidato;
  escolhido: boolean;
  onEscolher: () => void;
  aviso?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={escolhido}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors",
        escolhido ? "bg-accent-soft ring-1 ring-accent" : "hover:bg-surface-elevated",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{c.nome}</span>
        {aviso && c.motivo && <span className="block text-xs text-warning-fg">{c.motivo}</span>}
      </span>
      <span className="shrink-0 text-xs text-text-muted">
        {c.vezesNoSetor > 0 ? `${c.vezesNoSetor}× no setor` : "nunca no setor"}
      </span>
    </button>
  );
}

/**
 * A vaga do card vira botão: clicar abre "Incluir voluntário" (vaga aberta) ou
 * "Trocar voluntário" (vaga com nome), como no sistema que a liderança já usava.
 *
 * A lista vem do servidor só quando a janela abre — mandar o cadastro inteiro
 * junto de cada uma das ~400 vagas do mês faria a tela pesar megabytes à toa.
 */
export function VagaEditavel({
  slotId,
  culto,
  funcao,
  children,
}: {
  slotId: string;
  /** "Quinta Profética · 01/10 (QUI) · 19:20" */
  culto: string;
  /** "Recepção (Boas-Vindas)" */
  funcao: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [vaga, setVaga] = useState<VagaParaEditar | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [carregando, iniciarCarga] = useTransition();
  const [salvando, iniciarSalvar] = useTransition();

  function abrir() {
    setAberta(true);
    setVaga(null);
    setErro(null);
    setBusca("");
    setEscolhido(null);
    iniciarCarga(async () => {
      const r = await opcoesDaVaga(slotId);
      if (r.ok) setVaga(r.vaga);
      else setErro(ERROS[r.erro] ?? "Não deu para abrir a vaga agora. Tente de novo.");
    });
  }

  const filtro = sem(busca.trim());
  const filtrar = useMemo(
    () => (lista: Candidato[]) => (filtro ? lista.filter((c) => sem(c.nome).includes(filtro)) : lista),
    [filtro],
  );

  function gravar(voluntarioId: string | null) {
    iniciarSalvar(async () => {
      const r = await salvarVaga(slotId, voluntarioId);
      if (!r.ok) {
        toast.error(r.motivo ? `Não dá: ${r.motivo}.` : (ERROS[r.erro] ?? "Não deu para salvar. Tente de novo."));
        return;
      }
      toast.success(voluntarioId ? "Escala atualizada." : "Vaga deixada em aberto.");
      setAberta(false);
      router.refresh();
    });
  }

  const pode = vaga ? filtrar(vaga.candidatos.pode) : [];
  const comAviso = vaga ? filtrar(vaga.candidatos.comAviso) : [];
  const naoPode = vaga ? filtrar(vaga.candidatos.naoPode) : [];

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="block w-full rounded-lg text-left transition-shadow hover:ring-1 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`Editar a vaga ${funcao}`}
      >
        {children}
      </button>

      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{vaga?.atual ? "Trocar voluntário" : "Incluir voluntário"}</DialogTitle>
            <DialogDescription>
              {culto} · {funcao}
            </DialogDescription>
          </DialogHeader>

          {vaga?.atual && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm">
              <span>
                Hoje: <strong>{vaga.atual.nome}</strong>
              </span>
              <Button variant="ghost" size="sm" disabled={salvando} onClick={() => gravar(null)}>
                Deixar vaga aberta
              </Button>
            </div>
          )}

          {carregando && <p className="py-6 text-center text-sm text-text-muted">Carregando quem pode servir…</p>}
          {erro && <p className="py-6 text-center text-sm text-error-fg">{erro}</p>}

          {vaga && (
            <div className="space-y-3">
              <Input
                autoFocus
                placeholder="Buscar pelo nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar voluntário pelo nome"
              />
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                <section>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Podem servir ({pode.length})
                  </h4>
                  {pode.length === 0 ? (
                    <p className="px-3 text-sm text-text-muted">Ninguém livre com esse nome.</p>
                  ) : (
                    pode.map((c) => (
                      <Pessoa key={c.id} c={c} escolhido={escolhido === c.id} onEscolher={() => setEscolhido(c.id)} />
                    ))
                  )}
                </section>

                {comAviso.length > 0 && (
                  <section>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning-fg">
                      Podem, com atenção ({comAviso.length})
                    </h4>
                    {comAviso.map((c) => (
                      <Pessoa
                        key={c.id}
                        c={c}
                        aviso
                        escolhido={escolhido === c.id}
                        onEscolher={() => setEscolhido(c.id)}
                      />
                    ))}
                  </section>
                )}

                {naoPode.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Não podem neste culto ({naoPode.length})
                    </summary>
                    <ul className="mt-1 space-y-1 px-3">
                      {naoPode.map((c) => (
                        <li key={c.id} className="text-sm">
                          <span className="text-text-muted">{c.nome}</span>
                          <span className="block text-xs text-text-muted/80">{c.motivo}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberta(false)} disabled={salvando}>
              Fechar
            </Button>
            <Button onClick={() => escolhido && gravar(escolhido)} disabled={!escolhido || salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
