import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { escalaDoCulto } from "@/lib/escalas/consultas";
import { bonito, dataBr, tituloCulto } from "@/lib/escalas/formato";

import { contextoDeEscala } from "../_lib/contexto";

export const dynamic = "force-dynamic";

/**
 * A escala de um culto — a tela que a liderança abre para conferir e divulgar.
 *
 * Duas decisões vindas direto do pedido da liderança:
 *
 *  1. VAGA SEM NOME APARECE. "coloca nome mas campo vazio para as pessoas
 *     saberem e verificar" — a linha vazia é o convite para alguém se oferecer.
 *     Esconder a vaga faria a falta desaparecer da vista de quem pode resolvê-la.
 *  2. SETOR DESLIGADO APARECE, marcado. Sem isso, a equipe daquele setor abre a
 *     escala, não se vê, e não sabe se foi dispensada ou esquecida.
 */
export default async function CultoPage({ params }: { params: Promise<{ data: string }> }) {
  const { data } = await params;
  // Só data ISO: o parâmetro vem da URL e alimenta um filtro.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) notFound();

  const { db, orgId } = await contextoDeEscala();
  const detalhe = await escalaDoCulto(db, orgId, data);
  if (!detalhe) notFound();

  const { culto, porSetor } = detalhe;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="space-y-1">
        <Link href="/app/escalas" className="text-sm text-muted-foreground hover:underline">
          ← Escalas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {tituloCulto(culto.data, culto.diaSemana, culto.hora)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {culto.vagas} vagas
          {culto.abertas > 0 ? ` · ${culto.abertas} sem nome` : ""}
          {culto.rodadaData !== culto.data ? ` · rodada de ${dataBr(culto.rodadaData)}` : ""}
          {" · "}
          {culto.status}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {porSetor.map(({ setor, off, vagas }) => (
          <Card key={setor} className={off ? "opacity-70" : undefined}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>{bonito(setor)}</span>
                {off !== null && <Badge variant="neutral">não haverá</Badge>}
              </CardTitle>
              {off ? <p className="text-xs text-muted-foreground">{off}</p> : null}
            </CardHeader>
            <CardContent className="space-y-2">
              {vagas.length === 0 && off === null && (
                <p className="text-sm text-muted-foreground">Sem vagas neste culto.</p>
              )}
              {vagas.map((v, i) => (
                <div
                  key={`${v.subfuncao}-${i}`}
                  className="border-border/50 flex items-baseline justify-between gap-3 border-b pb-1 last:border-0"
                >
                  <span className="text-xs text-muted-foreground">
                    {v.subfuncao ? bonito(v.subfuncao) : "—"}
                  </span>
                  {v.nome ? (
                    <span className="text-right text-sm">
                      {v.nome}
                      {v.origem === "fixado" && (
                        <Badge variant="info" className="ml-2 align-middle text-[10px]">
                          fixado
                        </Badge>
                      )}
                      {v.origem === "manual" && (
                        <Badge variant="warning" className="ml-2 align-middle text-[10px]">
                          trocado
                        </Badge>
                      )}
                      {v.origem === "externo" && (
                        <Badge variant="neutral" className="ml-2 align-middle text-[10px]">
                          depto.
                        </Badge>
                      )}
                    </span>
                  ) : (
                    <span className="text-right text-sm italic text-warning-fg">
                      vaga aberta
                      {v.motivo ? ` — ${v.motivo}` : ""}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
