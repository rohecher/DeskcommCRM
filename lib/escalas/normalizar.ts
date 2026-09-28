/**
 * Normalização de texto do motor de escalas — o port de `norm()` do Python.
 *
 * Duas grafias do mesmo setor ("Intercessão" e "INTERCESSAO") precisam casar,
 * porque a escala foi escrita à mão em 43 abas de planilha ao longo de dois anos
 * e a acentuação varia linha a linha. O motor guarda e compara tudo sem acento,
 * em maiúsculas, com espaços colapsados; a acentuação correta é assunto da
 * PUBLICAÇÃO, não do casamento.
 *
 * NOMES DE PESSOA SÃO A EXCEÇÃO e nunca passam por aqui para efeito de
 * gravação: "Lucélia Exemplo Da Silva" é a grafia do cadastro e é o que a
 * liderança lê na escala. Normalizar para comparar é certo; normalizar para
 * ARMAZENAR apagaria o nome da pessoa.
 */

/**
 * Sem acento, sem espaço duplicado, em maiúsculas.
 *
 * Equivale a: NFD, remove categoria Mn (marcas de acento), colapsa espaços,
 * upper. A regex `\p{Mn}` precisa da flag `u` — sem ela, TypeScript aceita mas
 * o JavaScript trata `\p` como um `p` literal e a função devolve o texto com
 * acento, silenciosamente.
 */
export function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

/**
 * Chave composta para Map. Substitui as tuplas que o Python usa como chave de
 * dicionário — `(setor, subfuncao)`, `(nome, setor, subfuncao)`, `(data, setor)`.
 *
 * `JSON.stringify` em vez de juntar com um separador: qualquer separador
 * imprimível pode aparecer dentro de um nome de setor ("Corredor Externo, kids
 * e lanchonete" tem vírgula e espaços), e um caractere de controle como NUL
 * torna o arquivo-fonte binário para git e grep.
 */
export function chave(...partes: (string | number | null)[]): string {
  return JSON.stringify(partes);
}
