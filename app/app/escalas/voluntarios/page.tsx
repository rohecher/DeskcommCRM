import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listarVoluntarios } from "@/lib/escalas/consultas";
import { dataBr, mesBonito } from "@/lib/escalas/formato";

import { contextoDeEscala } from "../_lib/contexto";

export const dynamic = "force-dynamic";

/**
 * O cadastro dos Filhos que Servem.
 *
 * As três colunas do meio existem porque são as que respondem "por que essa
 * pessoa não foi escalada?" sem ninguém precisar abrir o motor:
 *
 *   STATUS      — só ATIVO entra no rodízio. SUSPENSO não é INATIVO: é quem está
 *                 fora por uma temporada e volta, e a liderança precisa ver a
 *                 diferença para saber a quem procurar.
 *   DEPARTAMENTO— quem é de louvor, mídia ou dança tem escala montada por fora e
 *                 fica ATIVO mas fora do rodízio geral. Sem esta coluna, "o
 *                 Kailane nunca é escalado" parece defeito.
 *   ÚLTIMA VEZ  — quem está parado há meses. É a pergunta que antecede a de quem
 *                 chamar.
 */
export default async function VoluntariosPage() {
  const { db, orgId } = await contextoDeEscala();
  const vols = await listarVoluntarios(db, orgId);

  const ativos = vols.filter((v) => v.status === "ATIVO").length;
  const suspensos = vols.filter((v) => v.status === "SUSPENSO").length;
  const inativos = vols.filter((v) => v.status === "INATIVO").length;
  const semTelefone = vols.filter((v) => !v.telefone).length;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Filhos que Servem</h1>
        <p className="text-sm text-muted-foreground">
          {vols.length} cadastrados · {ativos} ativos · {suspensos} suspensos · {inativos} inativos
          {semTelefone > 0 && ` · ${semTelefone} sem telefone`}
        </p>
      </header>

      {semTelefone > 0 && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            {/* O telefone não é enfeite de cadastro: é por ele que o aviso de
                escala e a confirmação chegam. Sem número, a pessoa fica na
                escala e não é avisada. */}
            {semTelefone === 1
              ? "1 pessoa está sem telefone e não recebe aviso de escala."
              : `${semTelefone} pessoas estão sem telefone e não recebem aviso de escala.`}
          </CardContent>
        </Card>
      )}

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Cônjuge</TableHead>
              <TableHead>Lidera</TableHead>
              <TableHead className="text-right">Vezes</TableHead>
              <TableHead>Última vez</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vols.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  {v.nome}
                  {v.reserva && (
                    <Badge variant="neutral" className="ml-2 text-[10px]">
                      reserva
                    </Badge>
                  )}
                  {v.sexo && <span className="ml-2 text-xs text-muted-foreground">{v.sexo}</span>}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      v.status === "ATIVO"
                        ? "success"
                        : v.status === "SUSPENSO"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {v.status.toLowerCase()}
                  </Badge>
                  {v.ausenteDe && v.ausenteAte && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {dataBr(v.ausenteDe)} a {dataBr(v.ausenteAte)}
                    </span>
                  )}
                  {v.maxPorMes !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      máx. {v.maxPorMes}/mês
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {v.departamento || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{v.conjuge ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {v.lideranca.length === 0
                    ? "—"
                    : v.lideranca
                        .map((l) => l.setor ?? `${l.papel.toLowerCase()} (igreja)`)
                        .join(", ")}
                </TableCell>
                <TableCell className="text-right text-sm">{v.vezes}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {v.ultima ? mesBonito(v.ultima) : "nunca serviu"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
