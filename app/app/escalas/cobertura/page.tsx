import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cobertura } from "@/lib/escalas/consultas";
import { mesBonito } from "@/lib/escalas/formato";

import { contextoDeEscala } from "../_lib/contexto";

export const dynamic = "force-dynamic";

/**
 * Quem serviu, mês a mês — e quem está ATIVO e não apareceu.
 *
 * A segunda tabela é a razão de a tela existir, e veio de um pedido literal:
 * "o legal agora é criar histórico base do cadastro x quem serviu no mês; ex.:
 * Roberto não foi escalado em setembro mas está ativo no cadastro".
 *
 * Uma tabela só de quem serviu não responde isso. Quem ficou de fora não aparece
 * em lugar nenhum — e é exatamente quem precisa ser chamado. É o relatório que
 * transforma "acho que faz tempo que não vejo o fulano servindo" em uma lista.
 */
export default async function CoberturaPage() {
  const { db, orgId } = await contextoDeEscala();
  const { meses, linhas, deFora } = await cobertura(db, orgId);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cobertura</h1>
        <p className="text-sm text-muted-foreground">
          Quantas vezes cada pessoa serviu nos últimos {meses.length} meses
          {deFora.length > 0 && ` · ${deFora.length} ativos ficaram de fora`}
        </p>
      </header>

      {deFora.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Ativos que não serviram neste período ({deFora.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {deFora.map((p) => (
              <Badge key={p.nome} variant="warning" className="font-normal">
                {p.nome}
                <span className="ml-1 opacity-70">
                  {p.ultima ? `· última ${mesBonito(p.ultima)}` : "· nunca serviu"}
                </span>
                {p.departamento && <span className="ml-1 opacity-70">· {p.departamento}</span>}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {linhas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum histórico registrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                {meses.map((m) => (
                  <TableHead key={m} className="text-right">
                    {mesBonito(m)}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.nome}>
                  <TableCell className="font-medium">
                    {l.nome}
                    {l.departamento && (
                      <span className="ml-2 text-xs text-muted-foreground">{l.departamento}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* Quem serviu mas está INATIVO ou SUSPENSO no cadastro é um
                        desencontro entre a escala e o cadastro — vale ver. */}
                    {l.status === "ATIVO" ? (
                      <span className="text-xs text-muted-foreground">ativo</span>
                    ) : (
                      <Badge variant={l.status === "SUSPENSO" ? "warning" : "neutral"}>
                        {l.status.toLowerCase()}
                      </Badge>
                    )}
                  </TableCell>
                  {meses.map((m) => (
                    <TableCell
                      key={m}
                      className={
                        (l.porMes[m] ?? 0) === 0
                          ? "text-muted-foreground/40 text-right"
                          : "text-right"
                      }
                    >
                      {l.porMes[m] ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium">{l.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
