import { ROLE_RANK } from "@/lib/auth/types";
import { escalaDoMes } from "@/lib/escalas/consultas";
import { hojeIso, mesValido, nomeDoMes } from "@/lib/escalas/mes";

import { CabecalhoDoMes, type Vista } from "./_componentes/CabecalhoDoMes";
import { CartaoDoCulto } from "./_componentes/CartaoDoCulto";
import { TabelaDoMes } from "./_componentes/TabelaDoMes";
import { contextoDeEscala } from "./_lib/contexto";

export const dynamic = "force-dynamic";

/**
 * A escala do MÊS — a porta do módulo.
 *
 * Antes era uma lista de todos os cultos do mais recente para trás, e o culto de
 * hoje ficava perdido no fim. A liderança monta e divulga a escala mês a mês,
 * então a tela abre no mês corrente, em ordem de data, com o culto de hoje
 * destacado — e troca de mês e de visão (cards ou tabela) pela URL, para o link
 * enviado no grupo abrir exatamente o que quem mandou estava vendo.
 */
export default async function EscalasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const hoje = hojeIso();
  const mesAtual = hoje.slice(0, 7);
  const pedido = typeof params.mes === "string" ? params.mes : undefined;
  const mes = mesValido(pedido) ? pedido : mesAtual;
  const vista: Vista = params.vista === "tabela" ? "tabela" : "cards";

  const { db, orgId, user, activeOrg } = await contextoDeEscala();
  const cultos = await escalaDoMes(db, orgId, mes);
  // Mesma régua da ação que grava (`_acoes.ts`): a tela só oferece o clique a
  // quem o servidor aceitaria. Esconder o botão é conforto; a regra é lá.
  const podeEditar = user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  const soCultos = cultos.filter((c) => c.tipo === "culto");
  const resumo = {
    cultos: soCultos.length,
    vagas: soCultos.reduce((n, c) => n + c.culto.vagas, 0),
    abertas: soCultos.reduce((n, c) => n + c.culto.abertas, 0),
  };

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
      <CabecalhoDoMes mes={mes} mesAtual={mesAtual} vista={vista} resumo={resumo} />

      {cultos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center text-sm text-text-muted">
          Nenhum culto com escala em {nomeDoMes(mes).toLocaleLowerCase("pt-BR")}.
        </div>
      ) : vista === "tabela" ? (
        <TabelaDoMes cultos={cultos} hoje={hoje} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {cultos.map((c) => (
            <CartaoDoCulto key={c.culto.id} item={c} hoje={hoje} podeEditar={podeEditar} />
          ))}
        </div>
      )}
    </div>
  );
}
