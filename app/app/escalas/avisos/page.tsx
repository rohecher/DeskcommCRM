import { lerCanalDeAviso, listarCanaisDaOrg } from "@/lib/escalas/aviso";

import { salvarCanalDeAviso } from "../_acoes";
import { contextoDeEscala } from "../_lib/contexto";
import { SeletorDoNumero } from "./SeletorDoNumero";

export const dynamic = "force-dynamic";

/** Escolher o número de WhatsApp que manda os avisos da escala. */
export default async function AvisosPage() {
  const { db, orgId } = await contextoDeEscala();
  const [canais, escolhido] = await Promise.all([listarCanaisDaOrg(db, orgId), lerCanalDeAviso(db, orgId)]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Número dos avisos</h1>
        <p className="text-sm text-muted-foreground">
          Os voluntários recebem por este número a convocação, o lembrete e o aviso de troca de vaga.
        </p>
      </header>
      <SeletorDoNumero canais={canais} escolhido={escolhido} aoSalvar={salvarCanalDeAviso} />
    </div>
  );
}
