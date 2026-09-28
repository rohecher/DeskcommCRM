import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listarSetores } from "@/lib/escalas/consultas";
import { bonito, diaBonito } from "@/lib/escalas/formato";

import { contextoDeEscala } from "../_lib/contexto";

export const dynamic = "force-dynamic";

/** As etiquetas de regra de um setor, com o texto que explica o efeito. */
function selosDoSetor(s: {
  nucleo: boolean;
  soCasal: boolean;
  casalJunto: boolean;
  duplaDecente: boolean;
  poolPequeno: boolean;
  externo: boolean;
}) {
  const selos: { texto: string; titulo: string; variante: "info" | "warning" | "neutral" }[] = [];
  if (s.externo)
    selos.push({
      texto: "montado pelo departamento",
      titulo: "A escala deste setor vem pronta do próprio departamento. O motor nunca a gera.",
      variante: "neutral",
    });
  if (s.nucleo)
    selos.push({
      texto: "núcleo",
      titulo: "Time estável: a mesma equipe volta a cada duas rodadas, em vez de rodar de verdade.",
      variante: "info",
    });
  if (s.soCasal)
    selos.push({
      texto: "só casal",
      titulo:
        "Exige marido e mulher. Sem casal disponível a vaga fica VAZIA — não entra dois homens nem duas mulheres.",
      variante: "warning",
    });
  if (s.casalJunto)
    selos.push({
      texto: "prefere casal",
      titulo: "Quando houver casal livre, os dois são alocados juntos nesta vaga.",
      variante: "info",
    });
  if (s.duplaDecente)
    selos.push({
      texto: "dupla decente",
      titulo:
        "Vaga isolada de duas pessoas: homem e mulher só servem juntos se forem casados um com o outro.",
      variante: "info",
    });
  if (s.poolPequeno)
    selos.push({
      texto: "pool pequeno",
      titulo: "Escolhe cedo: há poucos candidatos e outro setor levaria o único disponível.",
      variante: "neutral",
    });
  return selos;
}

/**
 * A estrutura: que setores existem, com quantas pessoas, e qual regra vale em
 * cada vaga.
 *
 * Tela de LEITURA. Ela existe antes da tela de edição porque a primeira pergunta
 * de quem monta a escala não é "como mudo isto?", é "por que o motor fez assim?"
 * — e a resposta está quase sempre numa destas etiquetas. Cada uma carrega o
 * efeito no `title`, não só o nome da regra: "só casal" sem explicação não diz
 * que a vaga fica vazia quando não há par.
 */
export default async function SetoresPage() {
  const { db, orgId } = await contextoDeEscala();
  const setores = await listarSetores(db, orgId);

  const daEstrutura = setores.filter((s) => !s.externo);
  const externos = setores.filter((s) => s.externo);
  const totalVagas = daEstrutura.reduce(
    (n, s) => n + s.subfuncoes.reduce((m, x) => m + x.qtd, 0),
    0,
  );

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Setores</h1>
        <p className="text-sm text-muted-foreground">
          {daEstrutura.length} setores montados pelo motor · {totalVagas} vagas no culto de domingo
          {externos.length > 0 && ` · ${externos.length} montados pelo próprio departamento`}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {setores.map((s) => (
          <Card key={s.nome} className={s.externo ? "opacity-80" : undefined}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{bonito(s.nome)}</CardTitle>
              <div className="flex flex-wrap gap-1 pt-1">
                {selosDoSetor(s).map((selo) => (
                  <Badge key={selo.texto} variant={selo.variante} title={selo.titulo}>
                    {selo.texto}
                  </Badge>
                ))}
              </div>
              {s.lideres.length > 0 && (
                <p className="pt-1 text-xs text-muted-foreground">Lidera: {s.lideres.join(", ")}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {s.subfuncoes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {s.externo
                    ? "As funções vêm na escala que o departamento envia."
                    : "Nenhuma subfunção cadastrada."}
                </p>
              )}
              {s.subfuncoes.map((x) => (
                <div
                  key={x.nome}
                  className="border-border/50 space-y-1 border-b pb-2 last:border-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{x.nome ? bonito(x.nome) : "—"}</span>
                    <span className="text-xs text-muted-foreground">
                      {x.qtd} pessoa{x.qtd === 1 ? "" : "s"}
                      {Object.entries(x.qtdPorDia).map(([dia, n]) => (
                        <span key={dia}>
                          {" "}
                          · {diaBonito(dia)}: {n}
                        </span>
                      ))}
                    </span>
                  </div>
                  {x.timeFixo.length > 0 && (
                    <p
                      className="text-xs text-muted-foreground"
                      title="Elenco fechado: SÓ estas pessoas servem nesta vaga."
                    >
                      <span className="font-medium">Time fixo:</span> {x.timeFixo.join(", ")}
                    </p>
                  )}
                  {x.prioridade.length > 0 && (
                    <p
                      className="text-xs text-muted-foreground"
                      title="Preferência, não exclusividade: entram na frente, mas outros completam a vaga."
                    >
                      <span className="font-medium">Prioridade:</span> {x.prioridade.join(", ")}
                    </p>
                  )}
                  {x.poolExtra.length > 0 && (
                    <p
                      className="text-xs text-muted-foreground"
                      title="Entram no pool mesmo sem histórico no setor — é como gente nova começa a servir."
                    >
                      <span className="font-medium">Trazendo agora:</span> {x.poolExtra.join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {x.porFrequencia && (
                      <Badge
                        variant="neutral"
                        className="text-[10px]"
                        title="Esta vaga vai para quem MAIS serviu no setor, não para o mais descansado: quem conduz precisa de continuidade."
                      >
                        pelo mais experiente
                      </Badge>
                    )}
                    {x.maxDoGrupo !== null && (
                      <Badge
                        variant="neutral"
                        className="text-[10px]"
                        title="Teto de gente do mesmo grupo nesta vaga."
                      >
                        máx. {x.maxDoGrupo} do grupo
                      </Badge>
                    )}
                    {x.duplaDecente && (
                      <Badge variant="info" className="text-[10px]">
                        dupla decente
                      </Badge>
                    )}
                    {x.casalJunto && (
                      <Badge variant="info" className="text-[10px]">
                        prefere casal
                      </Badge>
                    )}
                    {x.mesmoSexoQue && (
                      <Badge
                        variant="neutral"
                        className="text-[10px]"
                        title="Segue o sexo de quem foi escolhido na vaga apontada."
                      >
                        mesmo sexo de {x.mesmoSexoQue}
                      </Badge>
                    )}
                    {x.conjugeDe && (
                      <Badge
                        variant="neutral"
                        className="text-[10px]"
                        title="Recebe o cônjuge de quem ficou na vaga apontada; sem cônjuge livre, cai no pool normal."
                      >
                        cônjuge de {x.conjugeDe}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {s.reforcoSeOff.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {/* Sem cozinha na quinta, a equipe dela reforça a Recepção em vez
                      de ficar em casa. */}
                  Quando este setor não tem culto, reforça:{" "}
                  {s.reforcoSeOff
                    .map((r) => `${bonito(r.setor)}/${bonito(r.subfuncao)} +${r.qtd}`)
                    .join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
