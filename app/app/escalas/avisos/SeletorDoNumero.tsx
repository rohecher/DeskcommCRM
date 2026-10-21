"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { CanalParaEscolher } from "@/lib/escalas/aviso";

type Resultado = { ok: true } | { ok: false; erro: string };

const ERROS: Record<string, string> = {
  forbidden_role: "Só a liderança escolhe o número.",
  canal_invalido: "Esse número não está disponível.",
};

/** A lista de números e o botão. A ação entra por parâmetro: a tela não sabe de servidor. */
export function SeletorDoNumero({
  canais,
  escolhido,
  aoSalvar,
}: {
  canais: CanalParaEscolher[];
  escolhido: string | null;
  aoSalvar: (canalId: string) => Promise<Resultado>;
}) {
  const [marcado, setMarcado] = useState<string | null>(escolhido);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, comecar] = useTransition();

  if (canais.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum número de WhatsApp conectado ainda. Conecte um em Canais e volte aqui.
      </p>
    );
  }

  const salvar = () => {
    if (!marcado) return;
    comecar(async () => {
      const r = await aoSalvar(marcado);
      setMensagem(r.ok ? "Pronto. Os avisos da escala saem por este número." : (ERROS[r.erro] ?? "Não consegui salvar. Tente de novo."));
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {escolhido === null && (
        <p className="text-sm text-amber-700">Você ainda não escolheu um número, então os avisos da escala não saem.</p>
      )}
      <ul className="flex flex-col gap-2">
        {canais.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
              <input
                type="radio"
                name="canal-de-aviso"
                checked={marcado === c.id}
                onChange={() => setMarcado(c.id)}
              />
              <span className="flex flex-col">
                <span className="font-medium">{c.nome ?? "Número sem nome"}</span>
                {c.telefone && <span className="text-xs text-muted-foreground">{c.telefone}</span>}
              </span>
              <span className="ml-auto flex gap-2 text-xs">
                {c.id === escolhido && <span className="text-emerald-700">Número em uso</span>}
                <span className={c.conectado ? "text-emerald-700" : "text-muted-foreground"}>
                  {c.conectado ? "Conectado" : "Sem conexão"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button onClick={salvar} disabled={!marcado || salvando}>
          Usar este número
        </Button>
        {mensagem && <p className="text-sm">{mensagem}</p>}
      </div>
    </div>
  );
}
