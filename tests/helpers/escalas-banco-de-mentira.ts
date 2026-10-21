/**
 * Um banco de mentira com só o que os avisos da escala usam: select/eq/maybeSingle e upsert por
 * (organization_id, chave). Fica fora do teste para o teste da ação e o da regra usarem o mesmo.
 * O que se prova é a regra — de quem é o canal, onde o valor é guardado —, não o cliente do Supabase.
 */
export type Linha = Record<string, unknown>;

export function bancoDeMentira(seed: { channel_sessions?: Linha[]; escala_config?: Linha[] }) {
  const tabelas: Record<string, Linha[]> = {
    channel_sessions: seed.channel_sessions ?? [],
    escala_config: seed.escala_config ?? [],
  };
  const db = {
    from(nome: string) {
      const filtros: [string, unknown][] = [];
      let escrita: Linha | null = null;
      const achar = () => tabelas[nome]!.filter((l) => filtros.every(([c, v]) => l[c] === v));
      const construtor = {
        select: () => construtor,
        order: () => construtor,
        eq: (coluna: string, valor: unknown) => {
          filtros.push([coluna, valor]);
          return construtor;
        },
        maybeSingle: () => Promise.resolve({ data: achar()[0] ?? null, error: null }),
        upsert: (linha: Linha) => {
          escrita = linha;
          return construtor;
        },
        then: (resolver: (r: { data?: Linha[]; error: null }) => unknown) => {
          if (!escrita) return Promise.resolve({ data: achar(), error: null }).then(resolver);
          if (escrita) {
            const w = escrita;
            const antiga = tabelas[nome]!.find(
              (l) => l.organization_id === w.organization_id && l.chave === w.chave,
            );
            if (antiga) Object.assign(antiga, w);
            else tabelas[nome]!.push({ ...w });
          }
          return Promise.resolve({ error: null }).then(resolver);
        },
      };
      return construtor;
    },
  };
  return { db: db as never, tabelas };
}
