/**
 * Qual item do menu está ativo: o link MAIS ESPECÍFICO que casa com a rota.
 *
 * "Casa" quer dizer rota igual ao link ou abaixo dele. Sozinha, essa regra marca
 * dois itens quando um link é prefixo de outro: em `/app/escalas/voluntarios`,
 * "Escalas" (`/app/escalas`) e "Filhos que Servem" (`/app/escalas/voluntarios`)
 * casam os dois, e o menu ficava com os dois selecionados. Ganha o mais longo.
 *
 * E a rota de detalhe que não tem item próprio (`/app/escalas/2026-10-01`)
 * continua marcando o pai, que é o único que casa.
 */
export function hrefAtivo(pathname: string, hrefs: readonly string[]): string | null {
  let melhor: string | null = null;
  for (const href of hrefs) {
    const casa = pathname === href || pathname.startsWith(href + "/");
    if (casa && (melhor === null || href.length > melhor.length)) melhor = href;
  }
  return melhor;
}
