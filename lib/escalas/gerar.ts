/**
 * O motor: monta a escala de um culto, e de um lote de cultos.
 *
 * Port de `gerar()` e do laço de `main()` do motor Python. A ordem das operações
 * é a própria regra de negócio — cada reordenação abaixo foi pedida pela
 * liderança depois de uma escala sair errada, e trocar duas delas de lugar muda
 * quem serve. Os comentários dizem qual pedido originou cada passo.
 */
import { garantirPerfil, inc } from "./carga";
import { vagasDoCulto, type Vaga } from "./demanda";
import type {
  EntradaMotor,
  EstadoLote,
  Falta,
  LinhaEscala,
  ResultadoCulto,
  Setor,
  Subfuncao,
} from "./dominio";
import { DIA_SEMANA } from "./dominio";
import { chave } from "./normalizar";
import { nota, ordenarDesc, type ChaveOrdem } from "./pontuar";
import { escolherDecente, impedido, setorDeCasa } from "./restricoes";
import { dataDe, diaDaSemana, rodadaDe, somaDias } from "./rodada";

function rotulo(setor: string, sub: string): string {
  return sub ? `${setor} / ${sub}` : setor;
}

/**
 * Monta um culto.
 *
 * `estado` é MUTADO de propósito: carga, rodadas e vagas do domingo crescem
 * conforme o lote é gerado. Sem isso, gerar cinco cultos de uma vez repetia o
 * mesmo nome nos cinco, porque a carga ficava congelada no início do lote.
 */
export function gerarCulto(
  dataIso: string,
  entrada: EntradaMotor,
  estado: EstadoLote,
): ResultadoCulto {
  const { config, setores, regras, perfis, casais, sexo, lideres } = entrada;
  const diaSem = DIA_SEMANA[diaDaSemana(dataDe(dataIso))]!;
  const inicio = rodadaDe(dataIso, config.quintaAposDomingo);

  const desligados = entrada.setoresOff.get(chave(dataIso)) ?? new Map<string, string>();

  // Nome cravado à mão fica RESERVADO: nenhum outro setor pode levá-lo antes de
  // a vaga dele chegar na fila. Sem isso, travar um nome em Kids não garantia
  // nada — Boas Vindas escolhia primeiro e levava a pessoa.
  const reservado = new Map<string, string>();
  for (const [k, nomes] of entrada.fixados) {
    const [data, st, sub] = JSON.parse(k) as [string, string, string];
    if (data !== dataIso) continue;
    for (const nm of nomes) reservado.set(nm, chave(st, sub));
  }

  // Quem serviu na rodada anterior sai da vez; quem serviu na retrasada volta.
  // São duas equipes se alternando — 30% de repetição de uma rodada para a
  // seguinte, 66% de uma para a de duas atrás.
  const anterior = estado.rodadas.get(somaDias(inicio, -7)) ?? new Set<string>();
  const retrasada = estado.rodadas.get(somaDias(inicio, -14)) ?? new Set<string>();
  const base = new Set(estado.rodadas.get(inicio) ?? new Set<string>());

  const usados = new Set<string>();
  const escala: LinhaEscala[] = [];
  const faltas: Falta[] = [];
  /** chave(setor, subfuncao) → nomes já definidos neste culto. */
  const escolhidoEm = new Map<string, string[]>();

  const demanda = entrada.demanda;

  for (const vaga of vagasDoCulto(diaSem, setores, demanda, perfis, desligados)) {
    const { setor, sub, qtd: n } = vaga;

    if (desligados.has(setor.nome)) {
      const motivo = desligados.get(setor.nome) ?? "";
      escala.push({
        data: dataIso,
        diaSemana: diaSem,
        setor: setor.nome,
        subfuncao: sub.nome,
        nome: "",
        historico: "",
        obs: `OFF${motivo ? ` - ${motivo}` : ""}`,
      });
      continue;
    }

    const elenco = sub.timeFixo.length > 0 ? sub.timeFixo : null;
    const entraSemHistorico = sub.poolExtra;

    // Setor sem ninguém com histórico e sem elenco declarado não tem como ser
    // preenchido: reportar a falta é melhor que escalar quem nunca serviu ali.
    const alguemTemHistorico = [...perfis.values()].some(
      (d) => (d.setores.get(setor.nome) ?? 0) > 0,
    );
    if (!elenco && entraSemHistorico.length === 0 && !alguemTemHistorico) {
      faltas.push({
        vaga: rotulo(setor.nome, sub.nome),
        quantas: n,
        motivo: "setor sem historico",
      });
      continue;
    }

    const cravados = entrada.fixados.get(chave(dataIso, setor.nome, sub.nome)) ?? [];
    let escolhidos: string[];
    let forcado = false;
    let doDomingo: string[] = [];

    const descansado = (nm: string) => !anterior.has(nm) || base.has(nm);

    if (cravados.length >= n && cravados.length > 0) {
      // Travar mais nomes que a vaga pede AUMENTA a vaga: é como a liderança
      // registra culto especial (ceia) sem mexer na estrutura.
      escolhidos = cravados;
    } else {
      let livres: string[] = [];
      for (const [nome, d] of perfis) {
        if (usados.has(nome)) continue;
        // Cravado em OUTRA vaga deste culto.
        const res = reservado.get(nome);
        if (res !== undefined && res !== chave(setor.nome, sub.nome)) continue;
        if (
          !elenco &&
          (d.setores.get(setor.nome) ?? 0) === 0 &&
          !entraSemHistorico.includes(nome)
        ) {
          continue;
        }
        if (elenco && !elenco.includes(nome)) continue;
        // Reserva só entra quando está leve no mês. Não é punição: é quem já
        // carrega outra função e serve quando falta gente.
        const r = regras.get(nome);
        if (
          entrada.reserva.has(nome) &&
          (estado.cargaMes.get(nome) ?? 0) > config.reservaMaxNoMes
        ) {
          continue;
        }
        if (entrada.rejeitados.get(chave(dataIso, setor.nome))?.has(nome)) continue;
        // Já escalado no louvor/mídia/dança neste culto.
        if (entrada.ocupados.get(dataIso)?.has(nome)) continue;
        if (impedido(nome, setor.nome, diaSem, dataIso, regras, config)) continue;
        const teto = r?.max ?? (config.maxPadrao || null);
        if (teto !== null && (estado.cargaMes.get(nome) ?? 0) >= teto) continue;
        livres.push(nome);
      }

      // A quinta repete a VAGA do domingo desta rodada — não só a equipe do
      // setor. Quem estava na Recepção continua na Recepção.
      const inverte = diaSem === "QUINTA" && setor.rodizioInversoQuinta;
      doDomingo = inverte
        ? []
        : (estado.vagasDomingo.get(chave(inicio, setor.nome, sub.nome)) ?? []).filter((nm) =>
            livres.includes(nm),
          );
      if (doDomingo.length > 0 && dataIso !== inicio) {
        livres = [...doDomingo, ...livres.filter((nm) => !doDomingo.includes(nm))];
      }

      // Quem já está na rodada tem preferência; quem serviu na rodada anterior
      // só entra se faltar gente — e a linha sai marcada "repetido-sem-folga".
      const folgados = livres.filter(descansado);
      forcado = folgados.length < n;
      if (!forcado) livres = folgados;

      const lideresDoSetor = lideres.get(setor.nome) ?? new Set<string>();
      const chaveDe = (nm: string): ChaveOrdem => {
        const notaBase = nota(nm, perfis.get(nm)!, {
          setor: setor.nome,
          subfuncao: sub.nome,
          diaSemana: diaSem,
          dataIso,
          casa: setorDeCasa(regras, nm, config),
          cargaMes: estado.cargaMes,
          casais,
          usados,
          lideres: lideresDoSetor,
          config,
        });
        if (setor.nucleo) {
          // Time estável: a equipe de duas rodadas atrás volta. Intercessão e
          // Coordenação do Culto não rodam de verdade — são núcleo.
          return [doDomingo.includes(nm), base.has(nm), retrasada.has(nm), notaBase];
        }
        // Setor que roda: menos carga no período primeiro, depois quem menos
        // pegou JUSTAMENTE esta vaga, e só então a nota.
        return [
          doDomingo.includes(nm),
          base.has(nm),
          -(estado.cargaPeriodo.get(nm) ?? 0),
          -(estado.naVaga.get(chave(nm, setor.nome, sub.nome)) ?? 0),
          notaBase,
        ];
      };
      livres = ordenarDesc(livres, chaveDe);

      // Preferência, não exclusividade: entram na frente, outros completam.
      const preferidos = sub.prioridade;
      if (preferidos.length > 0) {
        const prim = livres.filter((nm) => preferidos.includes(nm));
        livres = [...prim, ...livres.filter((nm) => !prim.includes(nm))];
      }

      // A vaga recebe o cônjuge de quem ficou na vaga apontada (auxiliar =
      // marido/esposa do cozinheiro). Sem cônjuge livre, cai no pool normal.
      if (sub.conjugeDe) {
        const origem = chave(sub.conjugeDe[0], sub.conjugeDe[1]);
        const conjuges = (escolhidoEm.get(origem) ?? []).map((nm) => casais.get(nm));
        const prim = livres.filter((nm) => conjuges.includes(nm));
        livres = [...prim, ...livres.filter((nm) => !prim.includes(nm))];
      }

      // Teto de gente do mesmo grupo na vaga: não juntar dois professores da
      // sala maior na mesma sala menor.
      if (sub.maxDoGrupo) {
        const grupo =
          setores
            .find((s) => s.nome === setor.nome)
            ?.subfuncoes.find((x) => x.nome === "Sala Maior")?.prioridade ?? [];
        const filtrados: string[] = [];
        let doGrupo = 0;
        for (const nm of livres) {
          if (grupo.includes(nm)) {
            if (doGrupo >= sub.maxDoGrupo) continue;
            doGrupo += 1;
          }
          filtrados.push(nm);
        }
        livres = filtrados;
      }

      // Vaga que vai para o mais RODADO, não para o mais descansado: quem
      // conduz a sala precisa ser o mais experiente do setor.
      if (sub.porFrequencia) {
        livres = ordenarDesc(livres, (nm) => [
          preferidos.includes(nm),
          perfis.get(nm)!.setores.get(setor.nome) ?? 0,
        ]);
      }

      // Casal junto: pega o melhor colocado que tenha o PRÓPRIO cônjuge livre e
      // bota os dois lado a lado. "Amanda e Joabe são casal, focar eles juntos."
      if ((setor.casalJunto || sub.casalJunto) && n >= 2) {
        for (const nm of livres) {
          const conjuge = casais.get(nm);
          if (conjuge && livres.includes(conjuge)) {
            livres = [nm, conjuge, ...livres.filter((o) => o !== nm && o !== conjuge)];
            break;
          }
        }
      }

      // Segue o sexo de quem já foi escolhido na vaga de referência: "quando
      // Dhan for cozinheiro, preferência por homens no apoio".
      if (sub.mesmoSexoQue) {
        const espelho = chave(sub.mesmoSexoQue[0], sub.mesmoSexoQue[1]);
        const jaEscolhido = escolhidoEm.get(espelho);
        const alvo = jaEscolhido?.[0] ? sexo.get(jaEscolhido[0]) : undefined;
        if (alvo) {
          const iguais = livres.filter((nm) => sexo.get(nm) === alvo);
          livres = [...iguais, ...livres.filter((nm) => !iguais.includes(nm))];
        }
      }

      // A vaga do domingo VENCE casal, frequência e prioridade: dentro da rodada
      // a equipe é a mesma, só muda quem tem impedimento. Este reposicionamento
      // é o último de propósito.
      if (doDomingo.length > 0 && dataIso !== inicio) {
        livres = [...doDomingo, ...livres.filter((nm) => !doDomingo.includes(nm))];
      }

      if (inverte) {
        // A quinta sai de DENTRO da equipe do domingo: só remaneja e dá folga a
        // quem mais serve no setor. Ninguém novo entra. (Regra desligada hoje —
        // a primeira versão trazia gente de fora, que é o oposto de rodízio.)
        const equipe = (estado.equipeDomingo.get(chave(inicio, setor.nome)) ?? []).filter((nm) =>
          livres.includes(nm),
        );
        if (equipe.length > 0) {
          const ordenada = [...equipe].sort(
            (a, b) =>
              (perfis.get(a)!.setores.get(setor.nome) ?? 0) -
              (perfis.get(b)!.setores.get(setor.nome) ?? 0),
          );
          livres = [...ordenada, ...livres.filter((nm) => !ordenada.includes(nm))];
        }
      }

      // Cravado entra primeiro; o resto da vaga completa normalmente.
      const faltam = n - cravados.length;
      livres = livres.filter((nm) => !cravados.includes(nm));
      escolhidos = [...cravados, ...escolherDecente(livres, faltam, setor, sub, sexo, casais)];
    }

    if (escolhidos.length < n) {
      const motivo = setor.soCasal ? "nenhum casal disponivel" : "sem candidato livre";
      faltas.push({
        vaga: rotulo(setor.nome, sub.nome),
        quantas: n - escolhidos.length,
        motivo,
      });
      // A vaga aberta É PUBLICADA: a liderança pediu que o setor apareça com a
      // linha vazia para as pessoas verem que falta gente.
      for (let i = 0; i < n - escolhidos.length; i += 1) {
        escala.push({
          data: dataIso,
          diaSemana: diaSem,
          setor: setor.nome,
          subfuncao: sub.nome,
          nome: "",
          historico: "",
          obs: motivo,
        });
      }
    }

    escolhidoEm.set(chave(setor.nome, sub.nome), escolhidos);
    for (const nome of escolhidos) {
      inc(estado.naVaga, chave(nome, setor.nome, sub.nome));
      usados.add(nome);
      inc(estado.cargaMes, nome);
      const par = casais.get(nome);
      let marca = par && usados.has(par) ? "casal" : "";
      if (forcado && !descansado(nome)) {
        marca = `${marca} repetido-sem-folga`.trim();
      }
      escala.push({
        data: dataIso,
        diaSemana: diaSem,
        setor: setor.nome,
        subfuncao: sub.nome,
        nome,
        historico: `${perfis.get(nome)?.setores.get(setor.nome) ?? 0}x no setor`,
        obs: marca,
      });
    }
  }

  return { data: dataIso, escala, faltas };
}

/**
 * Monta vários cultos, alimentando o estado com o que foi gerado.
 *
 * O que sai de um culto entra no próximo: a quinta segue o domingo do MESMO
 * lote, mesmo que esse domingo ainda não esteja registrado em lugar nenhum, e a
 * carga sobe para que o segundo culto não repita o primeiro.
 */
export function gerarLote(
  datas: string[],
  entrada: EntradaMotor,
  estado: EstadoLote,
): ResultadoCulto[] {
  // Quem a liderança está trazendo agora não tem histórico e por isso não existe
  // no perfil. `poolExtra` é justamente para essa pessoa.
  for (const setor of entrada.setores) {
    for (const sub of setor.subfuncoes) {
      for (const nome of sub.poolExtra) garantirPerfil(entrada.perfis, nome);
    }
  }

  const saida: ResultadoCulto[] = [];
  for (const dataIso of datas) {
    const r = gerarCulto(dataIso, entrada, estado);
    const escalados = new Set(r.escala.map((l) => l.nome).filter(Boolean));

    const k = rodadaDe(dataIso, entrada.config.quintaAposDomingo);
    const naRodada = estado.rodadas.get(k) ?? new Set<string>();
    for (const nome of escalados) naRodada.add(nome);
    estado.rodadas.set(k, naRodada);

    // Conta como carga do período: sem isto, gerar vários cultos de uma vez
    // repete sempre o mesmo nome, porque a carga ficava congelada no início.
    for (const nome of escalados) inc(estado.cargaPeriodo, nome);

    if (diaDaSemana(dataDe(dataIso)) === 6) {
      for (const l of r.escala) {
        if (!l.nome) continue;
        const kv = chave(dataIso, l.setor, l.subfuncao);
        const vaga = estado.vagasDomingo.get(kv) ?? [];
        if (!vaga.includes(l.nome)) vaga.push(l.nome);
        estado.vagasDomingo.set(kv, vaga);

        const ke = chave(dataIso, l.setor);
        const equipe = estado.equipeDomingo.get(ke) ?? [];
        if (!equipe.includes(l.nome)) equipe.push(l.nome);
        estado.equipeDomingo.set(ke, equipe);
      }
    }
    saida.push(r);
  }
  return saida;
}

export type { Vaga, Setor, Subfuncao };
