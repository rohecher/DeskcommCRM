import Link from "next/link";

import type { CultoDoMes, VagaDoMes } from "@/lib/escalas/consultas";
import { bonito } from "@/lib/escalas/formato";
import { chavesDoCulto, linhasDaTabela, nomeDoCulto } from "@/lib/escalas/mes";
import { cn } from "@/lib/utils";

import { dataDoCulto } from "./CartaoDoCulto";

/**
 * O mês inteiro numa grade: uma coluna por culto, uma linha por função.
 *
 * É a visão de quem confere carga e repetição ("o Wesley está em todas as
 * quintas?"). Só entram os CULTOS; a sala de oração de segunda só tem louvor e
 * abriria linhas vazias para todos os outros dias — ela aparece no rodapé.
 */
export function TabelaDoMes({ cultos, hoje }: { cultos: CultoDoMes[]; hoje: string }) {
  const colunas = cultos.filter((c) => c.tipo === "culto");
  const oracoes = cultos.filter((c) => c.tipo === "oracao");

  const vagasPorCulto = colunas.map((c) => c.porSetor.flatMap((s) => s.vagas));
  const linhas = linhasDaTabela(vagasPorCulto);
  const celula = colunas.map((_, i) => {
    const vagas = vagasPorCulto[i]!;
    const chaves = chavesDoCulto(vagas);
    return new Map<string, VagaDoMes>(vagas.map((v, j) => [chaves[j]!, v]));
  });
  const offs = colunas.map(
    (c) => new Map(c.porSetor.filter((s) => s.off !== null).map((s) => [s.setor, s.off ?? ""])),
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                Função
              </th>
              {colunas.map(({ culto, tipo }) => {
                const escalados = culto.vagas - culto.abertas;
                return (
                  <th
                    key={culto.id}
                    className={cn(
                      "min-w-44 px-3 py-2 text-left align-bottom font-normal",
                      culto.data === hoje && "bg-accent-soft",
                    )}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">
                      {nomeDoCulto(culto.diaSemana, tipo)}
                    </p>
                    <Link href={`/app/escalas/${culto.data}`} className="font-semibold hover:text-accent">
                      {dataDoCulto(culto.data, culto.diaSemana, culto.hora)}
                    </Link>
                    <p className={cn("text-xs", culto.abertas > 0 ? "text-warning-fg" : "text-success-fg")}>
                      {escalados}/{culto.vagas}
                      {culto.abertas > 0 ? ` · ${culto.abertas} em aberto` : " · completo"}
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, i) => {
              const novoSetor = i === 0 || linhas[i - 1]!.setor !== linha.setor;
              return (
                <tr key={linha.chave} className={cn(novoSetor && "border-t border-border")}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left align-top font-normal"
                  >
                    {novoSetor && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide">{bonito(linha.setor)}</p>
                    )}
                    <p className="text-xs text-text-muted">{linha.subfuncao ? bonito(linha.subfuncao) : "—"}</p>
                  </th>
                  {colunas.map(({ culto }, c) => {
                    const vaga = celula[c]!.get(linha.chave);
                    const off = offs[c]!.get(linha.setor);
                    return (
                      <td
                        key={culto.id}
                        className={cn("px-3 py-1.5 align-top", culto.data === hoje && "bg-accent-soft/50")}
                      >
                        {vaga ? (
                          vaga.nome ? (
                            <span
                              className={cn(
                                vaga.origem === "fixado" && "text-info-fg",
                                vaga.origem === "manual" && "text-warning-fg",
                                vaga.origem === "externo" && "text-text-muted",
                              )}
                            >
                              {vaga.nome}
                            </span>
                          ) : (
                            <span className="italic text-warning-fg">vaga aberta</span>
                          )
                        ) : off !== undefined ? (
                          <span className="text-xs text-text-muted">não haverá</span>
                        ) : (
                          <span className="text-text-muted/40">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {oracoes.length > 0 && (
        <p className="text-sm text-text-muted">
          Salas de oração no mês:{" "}
          {oracoes.map(({ culto }, i) => (
            <span key={culto.id}>
              {i > 0 && ", "}
              <Link href={`/app/escalas/${culto.data}`} className="underline-offset-2 hover:underline">
                {dataDoCulto(culto.data, culto.diaSemana, culto.hora)}
              </Link>
            </span>
          ))}
          . Elas aparecem completas na visão em cards.
        </p>
      )}
    </div>
  );
}
