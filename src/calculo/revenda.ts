// Estratégia 1A: compra para revenda (ponto 5.6 da especificação).
//
// Os fluxos são mensais: no mês 0 sai o capital próprio e as obras; em cada mês de
// detenção saem a prestação, os encargos do crédito, o condomínio, os seguros e o IMI;
// no mês da venda entra o preço, menos os custos de venda, a dívida que falta pagar e
// o IRS da mais-valia. A soma destes fluxos é o lucro líquido.

import type { EstrategiaRevenda, Imovel } from "../dados/imoveis";
import { valorParametro } from "../dados/parametros";
import { taxaInternaMensal } from "./credito";
import type { AnaliseImovel } from "./imovel";
import { irsAdicional } from "./irs";
import { centimos } from "./util";

export interface MaisValia {
  valorRealizacao: number;
  /** Valor de aquisição (base do IMT), corrigido pelo coeficiente se houver mais de 24 meses. */
  valorAquisicao: number;
  coeficiente: number;
  /** Obras de valorização. */
  encargosValorizacao: number;
  /** Despesas da compra e da venda que a lei deixa deduzir (IMT, Imposto do Selo, escritura, mediação). */
  despesas: number;
  ganho: number;
  /** Parte do ganho que é englobada. */
  tributavel: number;
}

export interface ResultadoRevenda {
  faltam: string[];
  detencao: { imi: number; condominio: number; seguros: number; credito: number; total: number } | null;
  custosVenda: number;
  dividaNaVenda: number;
  maisValia: MaisValia | null;
  irs: number;
  lucro: number;
  /** Máximo de dinheiro próprio aplicado até à venda. */
  capitalInvestido: number;
  roi: number;
  /** TIR anual em %. Null se não for possível calcular. */
  tir: number | null;
  lucroPorMes: number;
  /** Preço de venda a partir do qual o lucro líquido deixa de ser negativo. */
  precoMinimo: number | null;
  /** Avisos sobre dados em falta que não impedem o cálculo. */
  notas: string[];
}

const DEDUTIVEIS = new Set(["imt", "is-aquisicao", "escritura", "mediacao"]);

export function faltamRevenda(e: EstrategiaRevenda): string[] {
  const faltam: string[] = [];
  if (!e.precoVenda) faltam.push("preço de venda esperado");
  if (!e.mesesAteVenda) faltam.push("prazo até à venda");
  return faltam;
}

/** obrasExtra: custo da obra da estratégia de reconstrução, quando o imóvel é reconstruído para revender. */
export function calcularRevenda(
  i: Imovel,
  a: AnaliseImovel,
  e: EstrategiaRevenda,
  rendimentoColetavel: number | null,
  obrasExtra = 0,
): ResultadoRevenda | { faltam: string[] } {
  const faltam = [...a.faltam, ...faltamRevenda(e)];
  if (faltam.length > 0 || !a.aquisicao || a.capitalProprio === null) return { faltam };

  const r = simular(i, a, e, e.precoVenda!, rendimentoColetavel, obrasExtra);
  // O lucro cresce com o preço de venda: procura o preço que o põe a zero.
  let baixo = 0;
  let alto = Math.max(i.preco! * 10, 1);
  if (simular(i, a, e, alto, rendimentoColetavel, obrasExtra).lucro < 0) return { ...r, precoMinimo: null };
  for (let k = 0; k < 60; k++) {
    const meio = (baixo + alto) / 2;
    if (simular(i, a, e, meio, rendimentoColetavel, obrasExtra).lucro < 0) baixo = meio;
    else alto = meio;
  }
  return { ...r, precoMinimo: Math.ceil(alto) };
}

function simular(i: Imovel, a: AnaliseImovel, e: EstrategiaRevenda, precoVenda: number, rendimentoColetavel: number | null, obrasExtra: number): ResultadoRevenda {
  const meses = Math.round(e.mesesAteVenda!);
  const f = i.financiamento;
  const plano = a.credito?.plano ?? [];
  const notas: string[] = [];
  if (a.imi === null) notas.push("Sem IMI: falta o VPT ou a taxa do município.");

  // Custos de detenção, mês a mês.
  const mensalFixo = (a.imi ?? 0) / 12 + (e.condominioMensal ?? 0) + (e.seguroAnual ?? 0) / 12;
  const mensaisCredito = Array.from({ length: meses }, (_, k) => {
    const l = plano[k];
    return l ? l.prestacao + l.impostoSeloJuros + (f?.seguroMensal ?? 0) + (f?.comissaoMensal ?? 0) : 0;
  });
  const linhasPagas = plano.slice(0, meses);
  const encargosCredito = linhasPagas.reduce((s, l) => s + l.juros + l.impostoSeloJuros, 0) + linhasPagas.length * ((f?.seguroMensal ?? 0) + (f?.comissaoMensal ?? 0));
  const dividaNaVenda = plano.length === 0 ? 0 : meses >= plano.length ? 0 : plano[meses - 1].divida;

  const detencao = {
    imi: ((a.imi ?? 0) * meses) / 12,
    condominio: (e.condominioMensal ?? 0) * meses,
    seguros: ((e.seguroAnual ?? 0) * meses) / 12,
    credito: encargosCredito,
    total: 0,
  };
  detencao.total = detencao.imi + detencao.condominio + detencao.seguros + detencao.credito;

  const iva = valorParametro("iva.taxa-normal");
  const custosVenda = ((precoVenda * (e.comissaoVendaPct ?? 0)) / 100) * (1 + iva / 100) + (e.outrosCustosVenda ?? 0);
  const obras = (e.obras ?? 0) + obrasExtra;

  // Mais-valia (arts. 10.º, 43.º a 51.º do CIRS).
  const coeficiente = meses > 24 ? (e.coeficiente ?? 1) : 1;
  if (meses > 24 && !e.coeficiente) notas.push("Mais de 24 meses: indique o coeficiente de desvalorização monetária da portaria do ano da venda. Usado 1.");
  const despesasCompra = a.aquisicao!.linhas.filter((l) => DEDUTIVEIS.has(l.id)).reduce((s, l) => s + l.valor, 0);
  const ganho = precoVenda - a.aquisicao!.impostos.base * coeficiente - obras - despesasCompra - custosVenda;
  const tributavel = Math.max(ganho, 0) * (valorParametro("irs.mais-valias-imoveis-englobamento") / 100);
  const irs = irsAdicional(rendimentoColetavel, tributavel);
  if (rendimentoColetavel === null && tributavel > 0) notas.push("Sem rendimento coletável no perfil: o IRS foi calculado como se a mais-valia fosse o único rendimento, o que o subestima.");

  // Fluxos mensais e lucro.
  const fluxos = [-(a.capitalProprio! + obras), ...mensaisCredito.map((c) => -(c + mensalFixo))];
  fluxos[meses] += precoVenda - custosVenda - dividaNaVenda - irs;
  const lucro = fluxos.reduce((s, x) => s + x, 0);

  let acumulado = 0;
  let capitalInvestido = 0;
  for (const x of fluxos.slice(0, -1)) {
    acumulado += x;
    capitalInvestido = Math.max(capitalInvestido, -acumulado);
  }
  const rm = taxaInternaMensal(fluxos);

  return {
    faltam: [],
    detencao: {
      imi: centimos(detencao.imi),
      condominio: centimos(detencao.condominio),
      seguros: centimos(detencao.seguros),
      credito: centimos(detencao.credito),
      total: centimos(detencao.total),
    },
    custosVenda: centimos(custosVenda),
    dividaNaVenda: centimos(dividaNaVenda),
    maisValia: {
      valorRealizacao: precoVenda,
      valorAquisicao: centimos(a.aquisicao!.impostos.base * coeficiente),
      coeficiente,
      encargosValorizacao: obras,
      despesas: centimos(despesasCompra + custosVenda),
      ganho: centimos(ganho),
      tributavel: centimos(tributavel),
    },
    irs,
    lucro: centimos(lucro),
    capitalInvestido: centimos(capitalInvestido),
    roi: capitalInvestido > 0 ? centimos((lucro / capitalInvestido) * 100) : 0,
    tir: Number.isFinite(rm) ? centimos((Math.pow(1 + rm, 12) - 1) * 100) : null,
    lucroPorMes: centimos(lucro / meses),
    precoMinimo: null,
    notas,
  };
}
