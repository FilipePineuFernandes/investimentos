// Estratégia 1B: compra para arrendamento (ponto 5.7 e Anexo A da especificação).

import type { EstrategiaArrendamento, Imovel } from "../dados/imoveis";
import type { Perfil } from "../dados/perfil";
import type { AnaliseImovel } from "./imovel";
import { irsAdicional, taxaAutonomaRendas } from "./irs";
import { centimos } from "./util";

export interface ResultadoArrendamento {
  faltam: string[];
  rendaAnualBruta: number;
  /** Renda recebida no ano, descontados os meses sem inquilino. */
  rendaEfetiva: number;
  custos: { condominio: number; seguros: number; manutencao: number; gestao: number; imi: number };
  totalCustos: number;
  /** Renda efetiva menos os custos dedutíveis (os juros do crédito não são dedutíveis). */
  rendimentoPredial: number;
  /** Taxa autónoma em %, ou null se optar pelo englobamento. */
  taxaIRS: number | null;
  irs: number;
  yieldBruta: number;
  yieldLiquida: number;
  /** Prestações e encargos do crédito no 1.º ano. */
  creditoAnual: number;
  /** Capital do crédito amortizado no 1.º ano (não é custo, aumenta o seu património). */
  amortizacaoAnual: number;
  cashFlowAnual: number;
  cashFlowMensal: number;
  capitalProprio: number;
  /** Cash-flow do 1.º ano sobre o capital próprio, em %. */
  roi: number;
  /** Anos até o cash-flow acumulado igualar o capital próprio. Null se não acontecer em 100 anos. */
  payback: number | null;
  notas: string[];
}

export function calcularArrendamento(i: Imovel, a: AnaliseImovel, e: EstrategiaArrendamento, perfil: Perfil | undefined): ResultadoArrendamento | { faltam: string[] } {
  const faltam = [...a.faltam];
  if (!e.rendaMensal) faltam.push("renda mensal esperada");
  if (faltam.length > 0 || !a.aquisicao || a.capitalProprio === null) return { faltam };

  const notas: string[] = [];
  if (a.imi === null) notas.push("Sem IMI: falta o VPT ou a taxa do município.");

  const vazio = Math.min(Math.max(e.mesesVazioAno ?? 0, 0), 12);
  const rendaAnualBruta = e.rendaMensal! * 12;
  const rendaEfetiva = e.rendaMensal! * (12 - vazio);
  const custos = {
    condominio: (e.condominioMensal ?? 0) * 12,
    seguros: e.seguroAnual ?? 0,
    manutencao: e.manutencaoAnual ?? 0,
    gestao: (rendaEfetiva * (e.gestaoPct ?? 0)) / 100,
    imi: a.imi ?? 0,
  };
  const totalCustos = custos.condominio + custos.seguros + custos.manutencao + custos.gestao + custos.imi;
  const rendimentoPredial = rendaEfetiva - totalCustos;

  const englobar = perfil?.englobamentoRendas ?? false;
  const taxaIRS = englobar ? null : taxaAutonomaRendas(i.destino, e.duracaoContratoAnos);
  const irs = rendimentoPredial <= 0 ? 0 : englobar ? irsAdicional(perfil?.rendimentoColetavelAnual ?? null, rendimentoPredial) : (rendimentoPredial * taxaIRS!) / 100;
  if (englobar && !perfil?.rendimentoColetavelAnual) notas.push("Sem rendimento coletável no perfil: o IRS do englobamento foi calculado como se as rendas fossem o único rendimento.");
  if (!englobar && (e.duracaoContratoAnos ?? 0) >= 5) notas.push("Taxa reduzida por contrato longo: confirme que a renda cumpre os limites do art. 72.º do CIRS.");

  // Encargos do crédito por ano, para o cash-flow e o payback.
  const f = i.financiamento;
  const plano = a.credito?.plano ?? [];
  const encargosMensais = (f?.seguroMensal ?? 0) + (f?.comissaoMensal ?? 0);
  const creditoNoAno = (ano: number) =>
    plano.slice((ano - 1) * 12, ano * 12).reduce((s, l) => s + l.prestacao + l.impostoSeloJuros + encargosMensais, 0);
  const amortizacaoAnual = plano.slice(0, 12).reduce((s, l) => s + l.capital, 0);

  const operacional = rendimentoPredial - irs;
  const cashFlowAnual = operacional - creditoNoAno(1);

  let payback: number | null = null;
  let acumulado = 0;
  for (let ano = 1; ano <= 100; ano++) {
    const fluxo = operacional - creditoNoAno(ano);
    if (fluxo > 0 && acumulado + fluxo >= a.capitalProprio) {
      payback = ano - 1 + (a.capitalProprio - acumulado) / fluxo;
      break;
    }
    acumulado += fluxo;
  }

  const investimento = i.preco! + a.aquisicao.total;
  return {
    faltam: [],
    rendaAnualBruta: centimos(rendaAnualBruta),
    rendaEfetiva: centimos(rendaEfetiva),
    custos: {
      condominio: centimos(custos.condominio),
      seguros: centimos(custos.seguros),
      manutencao: centimos(custos.manutencao),
      gestao: centimos(custos.gestao),
      imi: centimos(custos.imi),
    },
    totalCustos: centimos(totalCustos),
    rendimentoPredial: centimos(rendimentoPredial),
    taxaIRS,
    irs: centimos(irs),
    yieldBruta: centimos((rendaAnualBruta / i.preco!) * 100),
    yieldLiquida: centimos((rendimentoPredial / investimento) * 100),
    creditoAnual: centimos(creditoNoAno(1)),
    amortizacaoAnual: centimos(amortizacaoAnual),
    cashFlowAnual: centimos(cashFlowAnual),
    cashFlowMensal: centimos(cashFlowAnual / 12),
    capitalProprio: a.capitalProprio,
    roi: a.capitalProprio > 0 ? centimos((cashFlowAnual / a.capitalProprio) * 100) : 0,
    payback: payback === null ? null : Math.round(payback * 10) / 10,
    notas,
  };
}
