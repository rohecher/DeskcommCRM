/**
 * Todas as mensagens que o sistema manda aos voluntários da escala, num arquivo só.
 *
 * Fixas e já revisadas (humanizer-pt-br); a liderança não edita o texto por ora (spec
 * `tasks/avisos-da-escala`, seção 3c). Tudo num lugar para um teste conferir ortografia, variáveis
 * e vocabulário de uma vez — frase de aviso espalhada pelo código fica sem revisão.
 *
 * Variáveis entre chaves. Nome de pessoa é sempre a grafia do cadastro, nunca reescrita.
 */

export const VARIAVEIS_CONHECIDAS = [
  "nome",
  "mes",
  "lista",
  "setor",
  "funcao",
  "hora",
  "dia",
  "data",
  "pessoa",
  "resposta",
] as const;

export const TEXTOS = {
  convocacao:
    "Oi, {nome}! A escala de {mes} saiu e você está nela:\n{lista}\nConsegue? Responda 1 para confirmar ou 2 se precisar trocar.",
  lembrete_vespera:
    "Oi, {nome}! Amanhã tem culto e você serve em {setor}, {funcao}, às {hora}. Se não puder vir, responda 2 para avisar a liderança.",
  lembrete_no_dia: "Oi, {nome}! Hoje é dia de servir em {setor}, {funcao}, às {hora}. Até daqui a pouco!",
  pesquisa_pos_culto:
    "Oi, {nome}! Deu tudo certo no seu serviço de {dia}? Responda 1 (sim, tudo certo), 2 (tive dificuldade) ou 3 (não consegui ir).",
  pesquisa_dificuldade: "Sinto muito que tenha sido difícil. O que aconteceu? Pode escrever do seu jeito.",
  pesquisa_agradece_texto: "Agradecemos por contar, {nome}. A liderança vai ler.",
  pesquisa_agradece_ok: "Que bom, {nome}! Agradecemos por servir.",
  troca_entrou:
    "Oi, {nome}! A escala mudou e você entrou em {setor}, {funcao}, no culto de {dia}, {data}, às {hora}. Consegue? Responda 1 para confirmar ou 2 se não der.",
  troca_saiu:
    "Oi, {nome}! A escala mudou e você saiu de {setor}, {funcao}, no culto de {dia}, {data}. Não precisa fazer nada, só estamos avisando.",
  aviso_lideranca: '{pessoa} teve dificuldade ao servir em {setor} no culto de {dia} e contou:\n"{resposta}"',
} as const;

export type ChaveDeTexto = keyof typeof TEXTOS;

/** Preenche as variáveis. Falta de variável é erro, e nunca uma mensagem com `{setor}` à mostra. */
export function montarTexto(chave: ChaveDeTexto, variaveis: Record<string, string>): string {
  return TEXTOS[chave].replace(/\{([a-z_]+)\}/g, (_, nome: string) => {
    const valor = variaveis[nome];
    if (valor === undefined) throw new Error(`texto "${chave}": falta a variável {${nome}}`);
    return valor;
  });
}
