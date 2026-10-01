/**
 * Como a escala é EXIBIDA.
 *
 * ═══ POR QUE ESTE ARQUIVO EXISTE ═══
 *
 * O motor guarda setor e subfunção sem acento e em maiúsculas — "INTERCESSAO",
 * "Maquina de Cartao" —, porque a escala veio de 43 abas de planilha escritas à
 * mão, onde a mesma coisa aparece de cinco formas diferentes e a única maneira
 * de casar "Intercessão" com "INTERCESSAO" é comparar sem acento. Isso é decisão
 * de CASAMENTO, não de exibição: publicar assim entrega à igreja uma escala
 * escrita errado em português.
 *
 * A liderança pediu isso com estas palavras: "verificar acentuação para pt-BR".
 *
 * ═══ NÃO É SÓ ACENTO ═══
 *
 * Alguns rótulos mudam de verdade na publicação, e por isso o mapa é explícito
 * em vez de um algoritmo de acentuação:
 *
 *   BOAS VINDAS       → BOAS-VINDAS            (hífen)
 *   AUXILIO PASTORAL  → AUXILIAR OS PASTORES   (o nome que a igreja usa)
 *   Cozinheiro        → Cozinheiro(a)          (a vaga não é de um sexo só)
 *   Lateral Altar     → Lateral do Altar
 *
 * NOME DE PESSOA NUNCA PASSA POR AQUI. A grafia do cadastro é a grafia da
 * pessoa: "Lucélia Exemplo Da Silva" se escreve assim, e foi escrevê-la
 * como "Lucília" numa regra que a tirou da escala por um mês inteiro, em
 * silêncio. Este mapa é de vocabulário de setor, e só.
 */

const ACENTO: Record<string, string> = {
  // Setores
  INTERCESSAO: "INTERCESSÃO",
  "BOAS VINDAS": "BOAS-VINDAS",
  "MESA DA COMUNHAO": "MESA DA COMUNHÃO",
  "AUXILIO PASTORAL": "AUXILIAR OS PASTORES",
  "COORDENACAO DO CULTO": "COORDENAÇÃO DO CULTO",
  "M. LOUVOR": "MINISTÉRIO DE LOUVOR",
  "M. DANCA": "MINISTÉRIO DE DANÇA",
  MULTIMIDIA: "MULTIMÍDIA",
  // Subfunções
  "Maquina de Cartao": "Máquina de Cartão",
  Recepcao: "Recepção",
  "Corredor Externo, kids e lanchonete": "Corredor Externo, Kids e Lanchonete",
  "Servindo o altar": "Servindo o Altar",
  "Frente da igreja": "Frente da Igreja",
  "Lateral Altar": "Lateral do Altar",
  Cozinheiro: "Cozinheiro(a)",
  "Voz guia celebracao": "Voz Guia - Celebração",
  "Voz guia adoracao": "Voz Guia - Adoração",
  "Sala pastoral": "Sala Pastoral",
};

/** O rótulo como a igreja lê. Texto sem entrada no mapa sai como está. */
export function bonito(texto: string): string {
  return ACENTO[texto] ?? texto;
}

const DIA_BONITO: Record<string, string> = {
  DOMINGO: "Domingo",
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
};

export function diaBonito(dia: string): string {
  return DIA_BONITO[dia] ?? dia;
}

const DIA_CURTO: Record<string, string> = {
  DOMINGO: "DOM",
  SEGUNDA: "SEG",
  TERCA: "TER",
  QUARTA: "QUA",
  QUINTA: "QUI",
  SEXTA: "SEX",
  SABADO: "SÁB",
};

/** "QUINTA" → "QUI", como a liderança escreve a data na escala: "01/10 (QUI)". */
export function diaCurto(dia: string): string {
  return DIA_CURTO[dia] ?? dia;
}

/**
 * `2026-09-20` → `20/09/2026`.
 *
 * Formatado à mão, sem `Date`: `new Date("2026-09-20")` é interpretado como UTC
 * e, em fuso negativo como o do Brasil, `toLocaleDateString` devolve o dia
 * ANTERIOR. Uma escala publicada com a data errada por um dia é pior que sem
 * data nenhuma.
 */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** `20/09` — para cabeçalho de tabela, onde o ano é redundante. */
export function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** `2026-09` → `set/2026`, para a tabela de cobertura. */
export function mesBonito(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  const nomes = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`;
}

/** "Domingo, 20/09/2026 · 19:00" — o cabeçalho do culto. */
export function tituloCulto(dataIso: string, diaSemana: string, hora: string | null): string {
  const h = hora ? ` · ${hora.slice(0, 5)}` : "";
  return `${diaBonito(diaSemana)}, ${dataBr(dataIso)}${h}`;
}
