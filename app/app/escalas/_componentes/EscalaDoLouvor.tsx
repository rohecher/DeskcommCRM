"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { diaCurto, diaMes } from "@/lib/escalas/formato";
import type { PreviaDoLouvor } from "@/lib/escalas/louvor-banco";
import { diaDaSemanaIso } from "@/lib/escalas/mes";
import { MusicNote } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import { lerLouvor, salvarLouvor } from "../_acoes";

const EXEMPLO = `Cultos 05/11 e 09/11
Voz guia: Rhayssa celebração
Voz guia: Juan adoração
Back: Samily e Mara
Bateria: Calebe
Paleta de roupa: marrom / preto

Sala de oração 10/11
André / Layla / Mara`;

function rotuloDaData(iso: string): string {
  return `${diaMes(iso)} (${diaCurto(diaDaSemanaIso(iso))})`;
}

const SELO: Record<string, { texto: string; classe: string }> = {
  certo: { texto: "", classe: "" },
  aproximado: { texto: "confira", classe: "bg-warning-bg text-warning-fg" },
  duvida: { texto: "escolha", classe: "bg-warning-bg text-warning-fg" },
  desconhecido: { texto: "não achei", classe: "bg-error-bg text-error-fg" },
};

/**
 * "Escala do louvor": cola a mensagem do WhatsApp, confere, salva.
 *
 * A prévia é obrigatória e não um detalhe: o leitor reconhece "Naty" e "Lucas
 * Moura", mas "Rayssa" só por aproximação — e é a liderança quem diz se é a
 * Rhayssa. O que ela escolhe vira apelido, e da próxima vez já vem certo.
 */
export function EscalaDoLouvor({ mes, nomeDoMes }: { mes: string; nomeDoMes: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<PreviaDoLouvor | null>(null);
  /** `bloco|item|nome` → id escolhido ("" = deixar de fora). */
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [lendo, iniciarLeitura] = useTransition();
  const [salvando, iniciarSalvar] = useTransition();

  function abrir() {
    setAberta(true);
    setPrevia(null);
    setEscolha({});
  }

  function ler() {
    iniciarLeitura(async () => {
      const r = await lerLouvor(mes, texto);
      if (!r.ok) return void toast.error("Não deu para ler a mensagem agora. Tente de novo.");
      if (r.previa.blocos.length === 0) {
        return void toast.error("Não achei nenhuma data na mensagem. Ela precisa ter linhas como “Cultos 05/11 e 09/11”.");
      }
      const inicial: Record<string, string> = {};
      r.previa.blocos.forEach((b, bi) =>
        b.itens.forEach((it, ii) =>
          it.nomes.forEach((n, ni) => {
            const rec = n.reconhecimento;
            inicial[`${bi}|${ii}|${ni}`] = rec.tipo === "certo" || rec.tipo === "aproximado" ? rec.pessoa.id : "";
          }),
        ),
      );
      setEscolha(inicial);
      setPrevia(r.previa);
    });
  }

  const pendentes = useMemo(() => {
    if (!previa) return 0;
    let n = 0;
    previa.blocos.forEach((b, bi) =>
      b.itens.forEach((it, ii) =>
        it.nomes.forEach((nome, ni) => {
          const t = nome.reconhecimento.tipo;
          if ((t === "duvida" || t === "desconhecido") && !escolha[`${bi}|${ii}|${ni}`]) n += 1;
        }),
      ),
    );
    return n;
  }, [previa, escolha]);

  function salvar() {
    if (!previa) return;
    const apelidos: { apelido: string; voluntarioId: string }[] = [];
    const blocos = previa.blocos.map((b, bi) => ({
      datas: b.datas.map((d) => d.data),
      paleta: b.paleta,
      itens: b.itens.map((it, ii) => ({
        funcao: it.funcao,
        pessoas: it.nomes.flatMap((n, ni) => {
          const id = escolha[`${bi}|${ii}|${ni}`];
          if (!id) return [];
          // Só aprende o que precisou de confirmação: o que já veio certo já se sabia.
          if (n.reconhecimento.tipo !== "certo") apelidos.push({ apelido: n.digitado, voluntarioId: id });
          return [id];
        }),
      })),
    }));
    iniciarSalvar(async () => {
      const r = await salvarLouvor(mes, { blocos, apelidos });
      if (!r.ok) return void toast.error("Não deu para salvar a escala do louvor. Tente de novo.");
      toast.success(
        `Louvor lançado em ${r.cultos} ${r.cultos === 1 ? "culto" : "cultos"}` +
          (r.apelidos > 0 ? ` · ${r.apelidos} ${r.apelidos === 1 ? "apelido aprendido" : "apelidos aprendidos"}` : "") +
          ".",
      );
      setAberta(false);
      setTexto("");
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={abrir} className="gap-1.5">
        <MusicNote size={14} aria-hidden /> Escala do louvor
      </Button>

      <Dialog open={aberta} onOpenChange={(v) => !salvando && setAberta(v)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escala do louvor · {nomeDoMes}</DialogTitle>
            <DialogDescription>
              Cole a mensagem do jeito que o louvor mandou. O Cajado lê as datas, as funções e os nomes, e
              mostra para você conferir antes de salvar.
            </DialogDescription>
          </DialogHeader>

          {!previa && (
            <Textarea
              autoFocus
              rows={12}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={EXEMPLO}
              aria-label="Mensagem da escala do louvor"
              className="font-mono text-sm"
            />
          )}

          {previa && (
            <div className="space-y-4">
              {previa.blocos.map((b, bi) => (
                <section key={bi} className="rounded-lg border border-border p-3">
                  <header className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {b.oracao ? "Sala de oração" : "Cultos"}
                    </span>
                    {b.datas.map((d) => (
                      <span
                        key={d.data}
                        className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-xs"
                        title={d.status ? `culto ${d.status}` : "culto novo, entra como rascunho"}
                      >
                        {rotuloDaData(d.data)}
                        {!d.status && <span className="ml-1 text-info-fg">novo</span>}
                      </span>
                    ))}
                    {b.paleta && <span className="text-xs text-text-muted">Paleta: {b.paleta}</span>}
                  </header>

                  <div className="space-y-1.5">
                    {b.itens.map((it, ii) =>
                      it.nomes.map((n, ni) => {
                        const k = `${bi}|${ii}|${ni}`;
                        const rec = n.reconhecimento;
                        const selo = SELO[rec.tipo]!;
                        const opcoes = rec.tipo === "certo" ? [] : rec.opcoes;
                        return (
                          <div key={k} className="grid grid-cols-[9rem_7rem_1fr] items-center gap-2 text-sm">
                            <span className="truncate text-text-muted">{ni === 0 ? it.rotulo : ""}</span>
                            <span className="truncate" title={n.dica ? `dica: ${n.dica}` : undefined}>
                              {n.digitado}
                            </span>
                            <div className="flex items-center gap-2">
                              <select
                                value={escolha[k] ?? ""}
                                onChange={(e) => setEscolha((s) => ({ ...s, [k]: e.target.value }))}
                                className={cn(
                                  "h-8 min-w-0 flex-1 rounded-md border bg-surface px-2 text-sm",
                                  rec.tipo === "certo" ? "border-border" : "border-warning-fg/60",
                                )}
                                aria-label={`Quem é ${n.digitado}`}
                              >
                                <option value="">— deixar de fora —</option>
                                {opcoes.length > 0 && (
                                  <optgroup label="Sugestões">
                                    {opcoes.map((p) => (
                                      <option key={`s-${p.id}`} value={p.id}>
                                        {p.nome}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="Todos (louvor primeiro)">
                                  {previa.pessoas.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nome}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              {selo.texto && (
                                <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px]", selo.classe)}>
                                  {selo.texto}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }),
                    )}
                  </div>

                  {b.datas.some((d) => d.conflitos.length > 0) && (
                    <div className="mt-2 rounded-md bg-warning-bg/40 p-2 text-xs text-warning-fg">
                      {b.datas.flatMap((d) =>
                        d.conflitos.map((c) => (
                          <p key={`${d.data}-${c.nome}`}>
                            {rotuloDaData(d.data)}: {c.nome} também está em {c.onde}.{" "}
                            {d.status === "rascunho"
                              ? "Monte a escala de novo depois de salvar para o motor tirar daí."
                              : "Troque à mão na escala geral."}
                          </p>
                        )),
                      )}
                    </div>
                  )}
                </section>
              ))}
              {previa.ignoradas.length > 0 && (
                <p className="text-xs text-text-muted">Linhas que não entraram: {previa.ignoradas.join(" · ")}</p>
              )}
            </div>
          )}

          <DialogFooter>
            {previa ? (
              <>
                <Button variant="outline" onClick={() => setPrevia(null)} disabled={salvando}>
                  Voltar ao texto
                </Button>
                <Button onClick={salvar} disabled={salvando || pendentes > 0}>
                  {salvando
                    ? "Salvando…"
                    : pendentes > 0
                      ? `Escolha ${pendentes} ${pendentes === 1 ? "nome" : "nomes"}`
                      : "Salvar escala do louvor"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAberta(false)}>
                  Fechar
                </Button>
                <Button onClick={ler} disabled={lendo || texto.trim().length === 0}>
                  {lendo ? "Lendo…" : "Ler mensagem"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
