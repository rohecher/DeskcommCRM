/**
 * Vocabulário do motor de escalas (migration 0145).
 *
 * Estes quatro tipos são o espelho em TypeScript dos `CHECK` da 0145, e é
 * `tests/invariants/vocabulario-banco-x-typescript.test.ts` que prova que os
 * dois lados continuam dizendo a mesma coisa. Nenhuma das quatro colunas tem
 * caminho de escrita muito exercitado — escala se gera uma vez por semana —, e
 * é exatamente esse o perfil em que um `23514` fica meses escondido.
 */

/**
 * Só `ATIVO` entra no rodízio.
 *
 * `SUSPENSO` não é `INATIVO`: a pessoa está fora por uma temporada e volta, e a
 * liderança precisa ver a diferença na tela para saber a quem procurar. No
 * motor Python isto era `STATUS_OK = {"ATIVO"}` — um conjunto de um elemento
 * cuja consequência é que qualquer outra grafia (um "ATIVA" digitado na
 * planilha) tira a pessoa da escala sem avisar ninguém. Daí o CHECK.
 */
export type StatusVoluntario = "ATIVO" | "INATIVO" | "SUSPENSO";

/**
 * Usado pelas regras de decência e de casal (`MESMO_SEXO_QUE`, `SO_CASAL`,
 * `DUPLA_DECENTE`). Nullable na coluna: voluntário recém-cadastrado ainda não
 * tem sexo preenchido, e a ausência não é um terceiro valor — é "não sei
 * ainda", que o motor trata como inelegível para a vaga que exige o dado.
 */
export type SexoVoluntario = "M" | "F";

/**
 * `publicado` é uma fronteira, não um enfeite: a escala já foi divulgada para
 * os voluntários, e mudar uma vaga depois disso é desmentir um anúncio. A tela
 * avisa; o banco só guarda em qual dos três estados o culto está.
 */
export type StatusCulto = "rascunho" | "aprovado" | "publicado";

/**
 * De onde veio o nome que está na vaga.
 *
 * `fixado` (a liderança cravou ANTES de gerar) e `manual` (trocou DEPOIS) são
 * separados de propósito: só o primeiro é entrada do motor. Tratar os dois
 * como um só faria a próxima geração "respeitar" uma correção que na verdade
 * precisa ser reavaliada com o resto da rodada.
 *
 * `externo` é a escala que o próprio departamento monta — louvor, mídia,
 * dança. O motor nunca a gera; ele a LÊ, porque quem toca no domingo não deve
 * ser escalado para servir na quinta.
 */
export type OrigemSlot = "gerado" | "fixado" | "manual" | "externo";
