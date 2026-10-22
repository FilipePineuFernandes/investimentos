// Financiamento (ponto 5.4 e Anexo A da especificação): prestação pelo método francês,
// plano de pagamentos, Imposto do Selo, MTIC, TAEG aproximada, teste de stress e
// validação dos limites macroprudenciais do Banco de Portugal.

import { valorParametro } from "../dados/parametros";
import type { Destino } from "./imt";
import { centimos } from "./util";

export type TipoTaxa = "variavel" | "fixa" | "mista";

/** Prestação mensal pelo método francês: P = C × i ÷ (1 − (1 + i)^(−n)). */
export function prestacao(capital: number, taxaAnual: number, meses: number): number {
  const i = taxaAnual / 100 / 12;
  if (i === 0) return capital / meses;
  return (capital * i) / (1 - Math.pow(1 + i, -meses));
}

/** Imposto do Selo sobre o capital, conforme o prazo. */
export function impostoSeloCapital(montante: number, prazoAnos: number): number {
  const id = prazoAnos >= 5 ? "is.credito-5-anos-ou-mais" : "is.credito-1-a-5-anos";
  return centimos((montante * valorParametro(id)) / 100);
}

export interface DadosCredito {
  montante: number;
  prazoAnos: number;
  /** TAN em %: Euribor + spread na taxa variável, ou a taxa fixa. */
  taxaAnual: number;
  tipoTaxa: TipoTaxa;
  /** Seguros de vida e multirriscos exigidos pelo banco, por mês. */
  seguroMensal: number;
  comissaoMensal: number;
  /** Comissões de abertura, avaliação e outras pagas no início (sem o Imposto do Selo). */
  custosIniciais: number;
}

export interface LinhaPlano {
  mes: number;
  prestacao: number;
  juros: number;
  capital: number;
  impostoSeloJuros: number;
  divida: number;
}

export interface ResultadoCredito {
  prestacao: number;
  /** Prestação + Imposto do Selo sobre os juros + comissão mensal + seguros, no 1.º mês. */
  encargoMensalInicial: number;
  impostoSeloCapital: number;
  totalJuros: number;
  totalImpostoSeloJuros: number;
  /** Montante total imputado ao consumidor: capital, juros e todos os encargos. */
  mtic: number;
  /** TAEG aproximada, em %. */
  taeg: number;
  plano: LinhaPlano[];
  /** Prestação com a taxa 1, 2 e 3 pontos acima. Vazio na taxa fixa. */
  stress: { acrescimo: number; taxa: number; prestacao: number; diferenca: number }[];
}

export function plano(montante: number, taxaAnual: number, meses: number): LinhaPlano[] {
  const p = prestacao(montante, taxaAnual, meses);
  const i = taxaAnual / 100 / 12;
  const taxaIS = valorParametro("is.juros") / 100;
  const linhas: LinhaPlano[] = [];
  let divida = montante;
  for (let mes = 1; mes <= meses; mes++) {
    const juros = divida * i;
    const capital = mes === meses ? divida : p - juros;
    divida -= capital;
    linhas.push({ mes, prestacao: juros + capital, juros, capital, impostoSeloJuros: juros * taxaIS, divida: Math.max(divida, 0) });
  }
  return linhas;
}

/**
 * Taxa mensal que anula o valor atual dos fluxos (o primeiro é o de hoje).
 * Procura por bisseção, que é lenta mas nunca diverge.
 */
export function taxaInternaMensal(fluxos: number[]): number {
  const va = (r: number) => fluxos.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
  let baixo = -0.99;
  let alto = 1;
  if (va(baixo) * va(alto) > 0) return NaN;
  for (let k = 0; k < 200; k++) {
    const meio = (baixo + alto) / 2;
    if (va(baixo) * va(meio) <= 0) alto = meio;
    else baixo = meio;
  }
  return (baixo + alto) / 2;
}

export function calcularCredito(d: DadosCredito): ResultadoCredito {
  const meses = Math.round(d.prazoAnos * 12);
  const linhas = plano(d.montante, d.taxaAnual, meses);
  const p = prestacao(d.montante, d.taxaAnual, meses);
  const isCapital = impostoSeloCapital(d.montante, d.prazoAnos);
  const totalJuros = linhas.reduce((s, l) => s + l.juros, 0);
  const totalISJuros = linhas.reduce((s, l) => s + l.impostoSeloJuros, 0);
  const encargosMensais = (d.seguroMensal + d.comissaoMensal) * meses;

  // TAEG: o consumidor recebe o capital menos os custos iniciais e paga, todos os meses,
  // a prestação, o Imposto do Selo sobre os juros, a comissão e os seguros.
  const fluxos = [d.montante - d.custosIniciais - isCapital, ...linhas.map((l) => -(l.prestacao + l.impostoSeloJuros + d.comissaoMensal + d.seguroMensal))];
  const r = taxaInternaMensal(fluxos);

  const stress =
    d.tipoTaxa === "fixa"
      ? []
      : [1, 2, 3].map((acrescimo) => {
          const nova = prestacao(d.montante, d.taxaAnual + acrescimo, meses);
          return { acrescimo, taxa: d.taxaAnual + acrescimo, prestacao: centimos(nova), diferenca: centimos(nova - p) };
        });

  return {
    prestacao: centimos(p),
    encargoMensalInicial: centimos(p + linhas[0].impostoSeloJuros + d.comissaoMensal + d.seguroMensal),
    impostoSeloCapital: isCapital,
    totalJuros: centimos(totalJuros),
    totalImpostoSeloJuros: centimos(totalISJuros),
    mtic: centimos(d.montante + totalJuros + totalISJuros + isCapital + d.custosIniciais + encargosMensais),
    taeg: centimos((Math.pow(1 + r, 12) - 1) * 100),
    plano: linhas,
    stress,
  };
}

// --- Limites do Banco de Portugal --------------------------------------------------

export interface DadosValidacao {
  destino: Destino;
  montante: number;
  preco: number;
  /** Valor da avaliação bancária, se já existir. */
  avaliacao: number | null;
  prazoAnos: number;
  idade: number | null;
  taxaAnual: number;
  tipoTaxa: TipoTaxa;
  /** Anos de taxa fixa na taxa mista. */
  periodoFixoAnos: number | null;
  rendimentoMensal: number | null;
  outrasPrestacoes: number | null;
}

export interface Validacao {
  id: "ltv" | "dsti" | "prazo";
  nome: string;
  /** Valor calculado (em % no LTV e no DSTI, em anos no prazo). Null se faltarem dados. */
  valor: number | null;
  limite: number | null;
  /** True cumpre, false ultrapassa, null não foi possível verificar. */
  cumpre: boolean | null;
  explicacao: string;
}

/** Prazo máximo em anos, em função da idade. Null se a idade não for conhecida. */
export function prazoMaximo(idade: number | null): number | null {
  if (idade === null) return null;
  if (idade <= 30) return valorParametro("bdp.prazo-maximo");
  if (idade <= 35) return valorParametro("bdp.prazo-maximo-30-35");
  return valorParametro("bdp.prazo-maximo-mais-35");
}

/** Choque de taxa (pontos percentuais) a somar à TAN para calcular o DSTI. */
export function choqueTaxa(tipo: TipoTaxa, periodoFixoAnos: number | null): number {
  if (tipo === "fixa") return 0;
  if (tipo === "variavel") return valorParametro("bdp.choque-variavel");
  const anos = periodoFixoAnos ?? 0;
  if (anos <= 5) return valorParametro("bdp.choque-variavel");
  if (anos < 10) return valorParametro("bdp.choque-mista-5-10");
  return 0;
}

const pct = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;

/**
 * Verifica o LTV, o DSTI e o prazo. Os limites do Banco de Portugal aplicam-se ao crédito
 * à habitação; no crédito comercial (armazéns) não há validações e a lista vem vazia.
 */
export function validarLimites(d: DadosValidacao): Validacao[] {
  if (d.destino === "comercial") return [];

  const garantia = d.avaliacao === null ? d.preco : Math.min(d.preco, d.avaliacao);
  const ltv = (d.montante / garantia) * 100;
  const limiteLtv = valorParametro(d.destino === "hpp" ? "bdp.ltv-hpp" : "bdp.ltv-outros");
  const resultado: Validacao[] = [
    {
      id: "ltv",
      nome: "Empréstimo face ao valor do imóvel (LTV)",
      valor: centimos(ltv),
      limite: limiteLtv,
      cumpre: ltv <= limiteLtv + 1e-9,
      explicacao:
        `${pct(ltv)} do ${d.avaliacao === null ? "preço (falta a avaliação bancária)" : "menor entre o preço e a avaliação"}. ` +
        `Máximo de ${pct(limiteLtv)} ${d.destino === "hpp" ? "na habitação própria permanente" : "neste destino"}.`,
    },
  ];

  const maximo = prazoMaximo(d.idade);
  resultado.push(
    maximo === null
      ? { id: "prazo", nome: "Prazo do crédito", valor: d.prazoAnos, limite: null, cumpre: null, explicacao: "Falta a data de nascimento no perfil." }
      : {
          id: "prazo",
          nome: "Prazo do crédito",
          valor: d.prazoAnos,
          limite: maximo,
          cumpre: d.prazoAnos <= maximo,
          explicacao: `Com ${d.idade} anos de idade, o prazo máximo é de ${maximo} anos.`,
        },
  );

  if (!d.rendimentoMensal) {
    resultado.push({ id: "dsti", nome: "Taxa de esforço (DSTI)", valor: null, limite: valorParametro("bdp.dsti-maximo"), cumpre: null, explicacao: "Falta o rendimento mensal líquido no perfil." });
  } else {
    const choque = choqueTaxa(d.tipoTaxa, d.periodoFixoAnos);
    const comChoque = prestacao(d.montante, d.taxaAnual + choque, Math.round(d.prazoAnos * 12));
    const dsti = ((comChoque + (d.outrasPrestacoes ?? 0)) / d.rendimentoMensal) * 100;
    const limite = valorParametro("bdp.dsti-maximo");
    resultado.push({
      id: "dsti",
      nome: "Taxa de esforço (DSTI)",
      valor: centimos(dsti),
      limite,
      cumpre: dsti <= limite + 1e-9,
      explicacao:
        `Todas as prestações, ${choque > 0 ? `com a taxa ${choque.toLocaleString("pt-PT")} pontos acima` : "sem choque de taxa"}, ` +
        `são ${pct(dsti)} do rendimento líquido. Máximo de ${pct(limite)}.`,
    });
  }

  return resultado;
}
