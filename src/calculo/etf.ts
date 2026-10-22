// ETF: validação do catálogo (6.2), projeção de juros compostos (6.4), custos (6.5) e
// impostos na venda (6.6).

import type { ETF } from "../dados/etf";
import { MESES_REVISAO } from "../dados/etf";
import { valorParametro } from "../dados/parametros";
import type { Perfil } from "../dados/perfil";
import { mesesEntre } from "./carteira";
import { irsAdicional } from "./irs";
import { centimos } from "./util";

/** Cenários de rendibilidade anual por defeito (decisão do ponto 12) e horizontes (6.4). */
export const CENARIOS = [4, 6, 8, 10];
export const HORIZONTES = [1, 5, 10, 20, 30];
export const INFLACAO = 2;

/** Valida o formato e o dígito de controlo de um ISIN (norma ISO 6166). */
export function isinValido(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;
  const digitos = isin
    .slice(0, 11)
    .split("")
    .map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55)))
    .join("");
  let soma = 0;
  for (let k = 0; k < digitos.length; k++) {
    let d = Number(digitos[digitos.length - 1 - k]);
    if (k % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return (10 - (soma % 10)) % 10 === Number(isin[11]);
}

/** Problemas que impedem o ETF de entrar no catálogo. Lista vazia se estiver tudo bem. */
export function problemasETF(e: ETF): string[] {
  const p: string[] = [];
  if (!isinValido(e.isin)) p.push("O ISIN não é válido: são 12 caracteres, a começar pelo código do país, e o último é um dígito de controlo.");
  if (e.isin.startsWith("US") || e.domicilio === "US") {
    p.push("ETF domiciliado nos EUA: não tem documento KID para investidores particulares na UE, por isso as corretoras europeias não o podem vender a particulares (regras PRIIPs). Procure a versão UCITS, normalmente domiciliada na Irlanda ou no Luxemburgo.");
  }
  if (!e.kid) p.push("Confirme que o ETF tem KID (documento de informação fundamental) para investidores particulares na UE.");
  if (!e.nome.trim()) p.push("Falta o nome.");
  if (e.ter === null) p.push("Falta o TER (custo anual), que está na ficha do ETF.");
  return p;
}

export const precisaRevisao = (e: ETF, hoje: string) => mesesEntre(e.atualizadoEm, hoje) >= MESES_REVISAO;

// --- Custos de compra -----------------------------------------------------------------------

/** Comissão da corretora e câmbio numa compra de um ETF, conforme o perfil. */
export function custoCompra(e: ETF, valor: number, perfil: Perfil | undefined): number {
  if (valor <= 0) return 0;
  const c = perfil?.corretora;
  const comissao = (c?.comissaoFixa ?? 0) + (valor * (c?.comissaoPercentagem ?? 0)) / 100;
  const cambio = e.moedaNegociacao !== "EUR" ? (valor * (c?.cambioPercentagem ?? 0)) / 100 : 0;
  return comissao + cambio;
}

// --- Projeção -------------------------------------------------------------------------------

export interface Projecao {
  /** Total entregue (valor inicial + reforços), antes de custos. */
  investido: number;
  custosCompra: number;
  /** Valor da carteira no fim do horizonte, antes do imposto da venda. */
  valorFinal: number;
  ganho: number;
  /** IRS se vender tudo no fim do horizonte. */
  imposto: number;
  /** Valor final depois do imposto. */
  liquido: number;
  /** O líquido em euros de hoje, descontada a inflação. */
  real: number;
  /** Quanto o TER custou ao longo do horizonte (diferença para o mesmo ETF sem TER). */
  custoTER: number;
}

/** Valor futuro com capital inicial e reforços mensais no fim de cada mês, à taxa anual r (fração). */
export function valorFuturo(inicial: number, mensal: number, r: number, anos: number): number {
  const rm = Math.pow(1 + r, 1 / 12) - 1;
  const meses = Math.round(anos * 12);
  const reforcos = rm === 0 ? mensal * meses : (mensal * (Math.pow(1 + rm, meses) - 1)) / rm;
  return inicial * Math.pow(1 + r, anos) + reforcos;
}

/**
 * Taxa anual líquida de um ETF: rendibilidade bruta − TER − imposto anual sobre os dividendos
 * (só nos de distribuição, à taxa liberatória).
 */
export function taxaLiquida(e: ETF, taxaBruta: number): number {
  const dividendos = e.politica === "distribuicao" ? ((e.dividendosPct ?? 0) * valorParametro("irs.mobiliario-taxa-liberatoria")) / 100 : 0;
  return taxaBruta - (e.ter ?? 0) - dividendos;
}

export function projetarETF(e: ETF, inicial: number, mensal: number, taxaBruta: number, anos: number, perfil: Perfil | undefined, inflacao = INFLACAO): Projecao {
  const custoInicial = custoCompra(e, inicial, perfil);
  const custoMensal = custoCompra(e, mensal, perfil);
  const r = taxaLiquida(e, taxaBruta) / 100;
  const valorFinal = valorFuturo(inicial - custoInicial, mensal - custoMensal, r, anos);
  const semTER = valorFuturo(inicial - custoInicial, mensal - custoMensal, r + (e.ter ?? 0) / 100, anos);

  const investido = inicial + mensal * Math.round(anos * 12);
  // As comissões de compra entram no custo de aquisição, por isso não pagam imposto.
  const ganho = valorFinal - investido;
  const imposto =
    ganho <= 0 ? 0 : perfil?.englobamentoMaisValias ? irsAdicional(perfil.rendimentoColetavelAnual, ganho) : (ganho * valorParametro("irs.mobiliario-taxa-liberatoria")) / 100;
  const liquido = valorFinal - imposto;

  return {
    investido: centimos(investido),
    custosCompra: centimos(custoInicial + custoMensal * Math.round(anos * 12)),
    valorFinal: centimos(valorFinal),
    ganho: centimos(ganho),
    imposto: centimos(imposto),
    liquido: centimos(liquido),
    real: centimos(liquido / Math.pow(1 + inflacao / 100, anos)),
    custoTER: centimos(semTER - valorFinal),
  };
}

export interface Escolha {
  etf: ETF;
  /** Valor atribuído a este ETF no investimento inicial. */
  valor: number;
}

export interface Simulacao {
  inicialTotal: number;
  terPonderado: number;
  /** TER em € por ano sobre o valor inicial. */
  terAnual: number;
  custosCompraIniciais: number;
  /** resultados[horizonte][cenário]: soma das projeções de todos os ETF escolhidos. */
  resultados: Record<number, Record<number, Projecao>>;
}

/**
 * Simula a carteira escolhida. O reforço mensal divide-se pelos ETF na mesma proporção do
 * valor inicial. Com englobamento, o imposto é calculado ETF a ETF (aproximação).
 */
export function simular(
  escolhas: Escolha[],
  mensal: number,
  perfil: Perfil | undefined,
  cenarios = CENARIOS,
  horizontes = HORIZONTES,
  inflacao = INFLACAO,
): Simulacao {
  const inicialTotal = escolhas.reduce((s, x) => s + x.valor, 0);
  const terAnual = escolhas.reduce((s, x) => s + (x.valor * (x.etf.ter ?? 0)) / 100, 0);
  const resultados: Simulacao["resultados"] = {};
  for (const h of horizontes) {
    resultados[h] = {};
    for (const c of cenarios) {
      const partes = escolhas.map((x) => projetarETF(x.etf, x.valor, inicialTotal > 0 ? (mensal * x.valor) / inicialTotal : 0, c, h, perfil, inflacao));
      const soma = (k: keyof Projecao) => centimos(partes.reduce((s, p) => s + p[k], 0));
      resultados[h][c] = {
        investido: soma("investido"),
        custosCompra: soma("custosCompra"),
        valorFinal: soma("valorFinal"),
        ganho: soma("ganho"),
        imposto: soma("imposto"),
        liquido: soma("liquido"),
        real: soma("real"),
        custoTER: soma("custoTER"),
      };
    }
  }
  return {
    inicialTotal,
    terPonderado: inicialTotal > 0 ? Math.round((terAnual / inicialTotal) * 100 * 10000) / 10000 : 0,
    terAnual: centimos(terAnual),
    custosCompraIniciais: centimos(escolhas.reduce((s, x) => s + custoCompra(x.etf, x.valor, perfil), 0)),
    resultados,
  };
}
