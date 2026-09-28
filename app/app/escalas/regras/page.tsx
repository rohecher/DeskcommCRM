import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { lerConfig } from "@/lib/escalas/consultas";

import { contextoDeEscala } from "../_lib/contexto";

export const dynamic = "force-dynamic";

/**
 * O que cada peso faz, em português.
 *
 * Sem isto a tela seria uma lista de pares chave/valor — `peso_rodizio: 3` não
 * diz nada a quem monta a escala, e é justamente essa pessoa que precisa decidir
 * se muda. O texto explica o EFEITO, não repete o nome da chave.
 */
const EXPLICACAO: Record<string, { titulo: string; efeito: string }> = {
  peso_rodizio: {
    titulo: "Peso do descanso",
    efeito:
      "Quanto o descanso pesa contra a afinidade com o setor. Alto significa escalar quem folgou; baixo significa escalar quem tem mais prática ali.",
  },
  semanas_descanso: {
    titulo: "Janela de descanso",
    efeito:
      "De quantas semanas para trás o motor olha ao medir quem serviu menos. Janela curta esquece rápido e repete gente.",
  },
  bonus_casa: {
    titulo: "Bônus do setor de origem",
    efeito:
      "Vantagem de quem tem aquele setor como casa. É preferência, não exclusividade — a pessoa continua podendo servir em outros.",
  },
  peso_lider: {
    titulo: "Peso da liderança",
    efeito:
      "NEGATIVO de propósito: o líder gerencia a equipe, não serve mais que ela. Ele já está presente no culto, e ocupar uma vaga com ele tira o lugar de quem precisa servir.",
  },
  max_padrao: {
    titulo: "Teto de cultos por mês",
    efeito:
      "Teto que vale para todos. Zero significa sem teto global — cada pessoa pode ter o seu.",
  },
  quinta_apos_domingo: {
    titulo: "Dias entre os dois cultos da rodada",
    efeito:
      "A quinta pertence ao domingo desta distância atrás. É isso que faz os dois cultos compartilharem a mesma equipe em vez de sortear duas vezes.",
  },
  reserva_max_no_mes: {
    titulo: "Teto da reserva",
    efeito:
      "Quantas vezes no mês quem está marcado como reserva pode ser chamado. Reserva não é punição: é quem já carrega outra função.",
  },
  meses_recentes: {
    titulo: "Janela do padrão atual",
    efeito:
      "Quantos meses de histórico definem o tamanho normal de cada setor. Serve para o motor não copiar um padrão que a igreja abandonou.",
  },
  papel_lideranca: {
    titulo: "Papel que conta como liderança",
    efeito:
      "Só papel que começa com este texto pesa na escala. Supervisor de culto, coordenador geral e pastor são funções, não liderança de equipe — quem supervisiona o culto é escalado como qualquer outro.",
  },
  horario: {
    titulo: "Horário dos cultos",
    efeito: "O horário que aparece na escala publicada, por dia da semana.",
  },
  depto_externo: {
    titulo: "Departamentos com escala própria",
    efeito:
      "Quem é de um destes fica ATIVO mas fora do rodízio geral: a escala dele vem pronta, e louvor tem prioridade sobre qualquer outra.",
  },
  depto_apelido: {
    titulo: "Como o departamento é escrito",
    efeito:
      'Tradução entre o jeito que a pessoa escreve o departamento ("KIDS") e o nome do setor ("CULTO KIDS"). Sem ela, o bônus de origem nunca casaria.',
  },
  inativo_meses: {
    titulo: "Meses para sugerir inativo",
    efeito:
      "Depois de quanto tempo sem servir o cadastro sugere marcar a pessoa como inativa. É sugestão: quem decide é a liderança.",
  },
  fixo_no_mes: {
    titulo: "Setores com time travado no mês",
    efeito:
      "Vazio de propósito. Travar o time por todo o mês fazia a mesma dupla servir quatro cultos seguidos e furava a regra de reserva.",
  },
};

function mostrar(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (Array.isArray(valor)) return valor.length === 0 ? "(vazio)" : valor.join(", ");
  if (typeof valor === "object") {
    const pares = Object.entries(valor as Record<string, unknown>);
    return pares.length === 0 ? "(vazio)" : pares.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
  }
  return String(valor);
}

/**
 * Os pesos e tetos do motor.
 *
 * Leitura por enquanto: mudar um peso muda toda a escala, e a tela que edita
 * precisa mostrar o efeito ANTES de salvar. Publicar um formulário sem isso
 * convidaria a mexer no `peso_rodizio` para ver o que acontece — descobrindo o
 * resultado na escala que a igreja já recebeu.
 */
export default async function RegrasPage() {
  const { db, orgId } = await contextoDeEscala();
  const config = await lerConfig(db, orgId);

  const conhecidas = config.filter((c) => EXPLICACAO[c.chave]);
  const outras = config.filter((c) => !EXPLICACAO[c.chave]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Regras do motor</h1>
        <p className="text-sm text-muted-foreground">
          Os pesos que decidem quem é escalado. Alterar qualquer um deles muda a escala inteira.
        </p>
      </header>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">Regra</TableHead>
              <TableHead className="w-32">Valor</TableHead>
              <TableHead>O que faz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conhecidas.map((c) => (
              <TableRow key={c.chave}>
                <TableCell className="font-medium">
                  {EXPLICACAO[c.chave]!.titulo}
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {c.chave}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-sm">{mostrar(c.valor)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {EXPLICACAO[c.chave]!.efeito}
                </TableCell>
              </TableRow>
            ))}
            {outras.map((c) => (
              <TableRow key={c.chave}>
                <TableCell className="font-mono text-sm">{c.chave}</TableCell>
                <TableCell className="font-mono text-sm">{mostrar(c.valor)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {/* Chave que o motor não conhece fica no banco sem efeito — a
                      tela mostra para não haver configuração invisível. */}
                  Sem efeito no motor: chave que ele não conhece.
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Por que ainda não dá para editar aqui</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Mudar um peso muda quem serve em todos os cultos seguintes, e o efeito só aparece na
            escala gerada depois. A tela de edição precisa mostrar a escala nova ao lado da atual
            antes de salvar — sem isso, o caminho natural seria mexer no valor para ver no que dá, e
            descobrir o resultado na escala que a igreja já recebeu.
          </p>
          <p>
            As regras que mudam com frequência — status de quem serve, time fixo, prioridade — são
            cadastro, não peso, e ficam em <strong>Filhos que Servem</strong> e{" "}
            <strong>Setores</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
