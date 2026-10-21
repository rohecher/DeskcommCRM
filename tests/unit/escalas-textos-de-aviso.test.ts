import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { TEXTOS, VARIAVEIS_CONHECIDAS, montarTexto, type ChaveDeTexto } from "@/lib/escalas/textos-de-aviso";

const chaves = Object.keys(TEXTOS) as ChaveDeTexto[];
const VARIAVEL = /\{([a-z_]+)\}/g;

/** O que o WhatsApp aguenta ler sem virar parede de texto; o limite do app é bem maior. */
const MAX_CARACTERES = 600;

const PALAVRAS_DE_VENDA = /\b(cliente|clientes|pedido|pedidos|venda|vendas|compra|compras|loja|pagamento)\b/i;

/**
 * A ortografia só roda onde o `hunspell` com o dicionário pt_BR está instalado (a máquina de quem
 * mantém). O runner do GitHub não tem, e o teste é pulado ali: as regras mecânicas (variáveis,
 * espaços, aspas, tamanho, vocabulário) rodam em todo lugar. Mexeu em texto? Rode este arquivo aqui.
 */
/** Termos que o dicionário comum desconhece e que são da igreja ou do canal, não erro. */
const EXCECOES_DA_ORTOGRAFIA = new Set(["WhatsApp"]);

function hunspellDisponivel(): boolean {
  const r = spawnSync("hunspell", ["-d", "pt_BR", "-l"], { input: "casa\n", encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() === "";
}

function palavrasDesconhecidas(texto: string): string[] {
  const r = spawnSync("hunspell", ["-d", "pt_BR", "-l"], { input: texto, encoding: "utf8" });
  return r.stdout.split("\n").map((p) => p.trim()).filter((p) => p && !EXCECOES_DA_ORTOGRAFIA.has(p));
}

const exemplo = {
  nome: "Maria Exemplo", mes: "novembro", lista: "Domingo 01/11, 19h, Recepção", setor: "Cafeteria",
  funcao: "Apoio", hora: "19h", dia: "domingo", data: "01/11", pessoa: "Voluntario 001", resposta: "Faltou café.",
};

describe("montarTexto", () => {
  it("preenche as variáveis do texto", () => {
    expect(montarTexto("lembrete_no_dia", exemplo)).toBe(
      "Oi, Maria Exemplo! Hoje é dia de servir em Cafeteria, Apoio, às 19h. Até daqui a pouco!",
    );
  });

  it("recusa quando falta uma variável, dizendo qual", () => {
    expect(() => montarTexto("lembrete_no_dia", { nome: "Maria Exemplo" })).toThrow(/setor/);
  });

  it("não deixa variável sem preencher no texto final", () => {
    for (const chave of chaves) expect(montarTexto(chave, exemplo)).not.toMatch(/\{[a-z_]+\}/);
  });
});

describe("o catálogo de textos dos avisos", () => {
  it("existe pelo menos um texto (guarda de vacuidade)", () => {
    expect(chaves.length).toBeGreaterThanOrEqual(10);
  });

  it.each(chaves)("%s: só usa variáveis conhecidas", (chave) => {
    const usadas = [...TEXTOS[chave].matchAll(VARIAVEL)].map((m) => m[1]!);
    expect(usadas.filter((v) => !(VARIAVEIS_CONHECIDAS as readonly string[]).includes(v))).toEqual([]);
  });

  it.each(chaves)("%s: higiene do texto", (chave) => {
    const t = TEXTOS[chave];
    expect(t, "espaço duplo").not.toMatch(/ {2}/);
    expect(t, "aspas curvas").not.toMatch(/[“”‘’]/);
    expect(t, "travessão").not.toMatch(/[—–]/);
    expect(t, "espaço no começo ou no fim").toBe(t.trim());
    expect(t.length, "tamanho").toBeLessThanOrEqual(MAX_CARACTERES);
    expect(t[0], "começa em maiúscula").toBe(t[0]!.toUpperCase());
  });

  it.each(chaves)("%s: sem vocabulário de venda", (chave) => {
    expect(TEXTOS[chave]).not.toMatch(PALAVRAS_DE_VENDA);
  });

  it.skipIf(!hunspellDisponivel())("ortografia (hunspell pt_BR) de todos os textos", () => {
    const sem = chaves.map((c) => ({ c, erros: palavrasDesconhecidas(TEXTOS[c].replace(VARIAVEL, "x")) }));
    expect(sem.filter((s) => s.erros.length > 0)).toEqual([]);
  });
});
