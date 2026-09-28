import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listarCultos } from "@/lib/escalas/consultas";
import { dataBr, diaBonito } from "@/lib/escalas/formato";

import { contextoDeEscala } from "./_lib/contexto";

export const dynamic = "force-dynamic";

/**
 * A porta do módulo: os cultos, do mais recente para trás.
 *
 * O número em destaque em cada card é o de VAGAS ABERTAS, não o de escalados. A
 * liderança pediu que a vaga sem nome fosse publicada justamente para ser vista
 * ("coloca nome mas campo vazio para as pessoas saberem"), e um card que
 * mostrasse só "42 escalados" esconderia o que falta — que é a única informação
 * sobre a qual alguém precisa agir.
 */
export default async function EscalasPage() {
  const { db, orgId } = await contextoDeEscala();
  const cultos = await listarCultos(db, orgId);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Escalas</h1>
        <p className="text-sm text-muted-foreground">
          Os cultos e quem está escalado em cada setor.
        </p>
      </header>

      {cultos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum culto registrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cultos.map((c) => (
            <Link key={c.id} href={`/app/escalas/${c.data}`} className="block">
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>
                      {diaBonito(c.diaSemana)} · {dataBr(c.data)}
                    </span>
                    <Badge
                      variant={
                        c.status === "publicado"
                          ? "success"
                          : c.status === "aprovado"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {c.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {c.vagas} vaga{c.vagas === 1 ? "" : "s"}
                    {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""}
                  </p>
                  {c.abertas > 0 && (
                    <p className="font-medium text-warning-fg">
                      {c.abertas} vaga{c.abertas === 1 ? "" : "s"} sem nome
                    </p>
                  )}
                  {c.setoresOff > 0 && (
                    <p>
                      {c.setoresOff} setor{c.setoresOff === 1 ? "" : "es"} desligado
                      {c.setoresOff === 1 ? "" : "s"} neste culto
                    </p>
                  )}
                  {/* Quinta e o domingo anterior são a MESMA rodada: a equipe é a
                      mesma nos dois cultos. Mostrar a rodada evita a pergunta
                      "por que a quinta repetiu o domingo?". */}
                  {c.rodadaData !== c.data && (
                    <p className="text-xs">rodada de {dataBr(c.rodadaData)}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
