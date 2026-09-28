/**
 * Quem NÃO pode servir, e quais duplas não podem ficar sozinhas.
 *
 * Estas regras foram ensinadas uma a uma pela liderança, quase sempre depois de
 * uma escala sair errada. Nenhuma delas é preferência: são as que fazem a escala
 * ser aceitável na igreja.
 */
import type { Config, RegraVoluntario, Setor, Subfuncao } from "./dominio";
import { norm } from "./normalizar";

/** Só ATIVO entra no rodízio. */
const STATUS_OK = new Set(["ATIVO"]);

/**
 * Motivo do impedimento, ou string vazia quando a pessoa pode servir.
 *
 * Devolve o motivo em texto (e não um booleano) porque é o que a tela mostra
 * quando alguém pergunta "por que o fulano não foi escalado?". Perder o motivo
 * transforma a pergunta numa investigação.
 */
export function impedido(
  nome: string,
  setor: string,
  diaSemana: string,
  dataIso: string,
  regras: Map<string, RegraVoluntario>,
  config: Config,
): string {
  const r = regras.get(nome);
  if (!r) return ""; // sem regra = ativo e sem restrição

  if (!STATUS_OK.has(r.status)) return r.status.toLowerCase();

  // Departamento externo (louvor, mídia, dança): a pessoa continua ATIVA, mas a
  // escala dela é montada pelo próprio departamento. Louvor tem prioridade sobre
  // qualquer outra escala.
  if (r.departamento && config.deptoExterno.includes(r.departamento)) {
    return `time de ${r.departamento.toLowerCase()}`;
  }

  if (r.dias.length > 0 && !r.dias.includes(diaSemana)) {
    return `so serve ${r.dias.join("/").toLowerCase()}`;
  }
  if (r.bloqueados.includes(norm(setor))) return "setor bloqueado";
  if (r.permitidos.length > 0 && !r.permitidos.includes(norm(setor))) {
    return `so serve em ${r.permitidos.join("/").toLowerCase()}`;
  }
  // Ausência só vale com as duas pontas: uma data solta seria "ausente desde
  // sempre" ou "ausente para sempre", e as duas leituras já quebraram escala.
  if (r.de && r.ate && r.de <= dataIso && dataIso <= r.ate) {
    return `ausente ate ${r.ate}`;
  }
  return "";
}

/**
 * A dupla pode servir sozinha?
 *
 * Mesmo sexo pode. Homem e mulher, só se forem casados um com o outro. Sexo
 * desconhecido passa — o motor não inventa impedimento a partir de dado que
 * falta, e tratar ausência como "não pode" tiraria da escala quem só tem uma
 * célula vazia na planilha.
 */
export function parDecente(
  a: string,
  b: string,
  sexo: Map<string, string>,
  casais: Map<string, string>,
): boolean {
  const sa = sexo.get(a);
  const sb = sexo.get(b);
  if (!sa || !sb || sa === sb) return true;
  return casais.get(a) === b;
}

/** A regra de decência vale nesta vaga? Setor inteiro, ou só aquela subfunção. */
export function exigeDecencia(setor: Setor, sub: Subfuncao, n: number): boolean {
  return n === 2 && (setor.duplaDecente || sub.duplaDecente);
}

/**
 * Os `n` primeiros da lista, respeitando a regra da vaga.
 *
 * `soCasal` (Auxílio Pastoral): tem de ser marido e mulher. Sem casal
 * disponível a vaga fica VAZIA — não improvisa com dois homens nem com duas
 * mulheres, e a liderança vê o buraco e resolve. Foi pedido nessas palavras:
 * "é casal homem e mulher, não pode dois homens e nem duas mulheres".
 *
 * `duplaDecente`: dupla mista só se for casada entre si; senão procura o
 * primeiro par decente na ordem da nota. Se nenhum par servir, devolve os `n`
 * primeiros — a vaga precisa de gente, e a alternativa (deixar vazio) foi
 * rejeitada para estes setores.
 */
export function escolherDecente(
  livres: string[],
  n: number,
  setor: Setor,
  sub: Subfuncao,
  sexo: Map<string, string>,
  casais: Map<string, string>,
): string[] {
  if (n === 2 && setor.soCasal) {
    for (const a of livres) {
      const conjuge = casais.get(a);
      if (conjuge && livres.includes(conjuge) && sexo.get(a) !== sexo.get(conjuge)) {
        return [a, conjuge];
      }
    }
    return [];
  }

  if (!exigeDecencia(setor, sub, n)) return livres.slice(0, n);

  for (let i = 0; i < livres.length; i += 1) {
    for (let j = i + 1; j < livres.length; j += 1) {
      if (parDecente(livres[i]!, livres[j]!, sexo, casais)) return [livres[i]!, livres[j]!];
    }
  }
  return livres.slice(0, n);
}

/**
 * Setor de origem da pessoa, já com o nome que a escala usa.
 *
 * A coluna `departamento` é escrita como a pessoa fala ("KIDS", "MESA"), e o
 * setor tem nome completo ("CULTO KIDS", "MESA DA COMUNHAO"). Sem a tradução, o
 * bônus de casa nunca casaria e a preferência não faria efeito nenhum.
 */
export function setorDeCasa(
  regras: Map<string, RegraVoluntario>,
  nome: string,
  config: Config,
): string {
  const dep = regras.get(nome)?.departamento ?? "";
  if (!dep || config.deptoExterno.includes(dep)) return "";
  return config.deptoApelido[dep] ?? dep;
}
