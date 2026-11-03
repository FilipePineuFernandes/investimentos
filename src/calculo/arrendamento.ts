// Estratégia 1B: compra para arrendamento (ponto 5.7 e Anexo A da especificação).

import { TAXA_IRC_REFERENCIA, type EstrategiaArrendamento, type Imovel, type RegimeFiscalRendas } from "../dados/imoveis";
import { quocienteDe, type Perfil } from "../dados/perfil";
import type { AnaliseImovel } from "./imovel";
import { irsAdicional, taxaAutonomaRendas } from "./irs";
import { inflacaoProjetada } from "../dados/parametros";
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
  /** Regime fiscal das rendas escolhido. */
  regime: RegimeFiscalRendas;
  /** IRS: taxa autónoma em %, ou null se optar pelo englobamento. IRC: a taxa. Isento: 0. */
  taxaIRS: number | null;
  /** Imposto sobre as rendas (IRS ou IRC; 0 se isento). */
  irs: number;
  yieldBruta: number;
  yieldLiquida: number;
  /** Depois dos custos e do imposto, antes do crédito, sobre o preço mais os custos de compra e a obra. */
  yieldPosImposto: number;
  /** Cash-flow anual (já com imposto e crédito) sobre o preço mais os custos de compra e a obra. */
  yieldCashFlow: number;
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

/**
 * obra: custo da obra da estratégia de reconstrução, pago com capital próprio antes de arrendar.
 * inflacao: inflação (%) do ano n do investimento (n = 1 é este ano). Por defeito, as projeções do
 * Banco de Portugal. Atualiza o condomínio, os seguros e a manutenção a partir do 2.º ano, no payback.
 */
export function calcularArrendamento(
  i: Imovel,
  a: AnaliseImovel,
  e: EstrategiaArrendamento,
  perfil: Perfil | undefined,
  obra = 0,
  inflacao: (n: number) => number = (n) => inflacaoProjetada(new Date().getFullYear() + n - 1),
): ResultadoArrendamento | { faltam: string[] } {
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

  const regime: RegimeFiscalRendas = e.regimeFiscal ?? "irs";
  const englobar = regime === "irs" && (perfil?.englobamentoRendas ?? false);
  const taxaIrc = e.taxaIrc ?? TAXA_IRC_REFERENCIA;
  const taxaIRS = regime === "isento" ? 0 : regime === "irc" ? taxaIrc : englobar ? null : taxaAutonomaRendas(i.destino, e.duracaoContratoAnos);
  const irsSobre = (predial: number) => (predial <= 0 || regime === "isento" ? 0 : englobar ? irsAdicional(perfil?.rendimentoColetavelAnual ?? null, predial, quocienteDe(perfil)) : (predial * taxaIRS!) / 100);
  const irs = irsSobre(rendimentoPredial);
  if (regime === "irs") {
    if (englobar && !perfil?.rendimentoColetavelAnual) notas.push("Sem rendimento coletável no perfil: o IRS do englobamento foi calculado como se as rendas fossem o único rendimento.");
    if (!englobar && (e.duracaoContratoAnos ?? 0) >= 5) notas.push("Taxa reduzida por contrato longo: confirme que a renda cumpre os limites do art. 72.º do CIRS.");
  }
  if (regime === "irc") notas.push("IRC simplificado: taxa sobre as rendas menos os custos indicados, sem depreciações, juros nem derrama. Confirme com o contabilista.");
  if (regime === "isento") notas.push("Sem imposto sobre as rendas: use esta opção só se tiver uma isenção que o permita.");

  // Encargos do crédito por ano, para o cash-flow e o payback.
  const f = i.financiamento;
  const plano = a.credito?.plano ?? [];
  const encargosMensais = (f?.seguroMensal ?? 0) + (f?.comissaoMensal ?? 0);
  const creditoNoAno = (ano: number) =>
    plano.slice((ano - 1) * 12, ano * 12).reduce((s, l) => s + l.prestacao + l.impostoSeloJuros + encargosMensais, 0);
  const amortizacaoAnual = plano.slice(0, 12).reduce((s, l) => s + l.capital, 0);

  const capitalProprio = a.capitalProprio + obra;
  if (obra > 0) notas.push("Inclui o custo da obra no capital próprio. O cash-flow é o de depois da obra, com o imóvel já arrendado.");
  const operacional = rendimentoPredial - irs;
  const cashFlowAnual = operacional - creditoNoAno(1);

  // Payback ano a ano: o condomínio, os seguros e a manutenção sobem com a inflação; a renda, a
  // gestão (em % da renda) e o IMI ficam iguais. É uma hipótese prudente: as rendas também podem subir.
  const atualizaveis = custos.condominio + custos.seguros + custos.manutencao;
  let fator = 1;
  let payback: number | null = null;
  let acumulado = 0;
  for (let ano = 1; ano <= 100; ano++) {
    if (ano > 1) fator *= 1 + inflacao(ano) / 100;
    const predial = rendimentoPredial - atualizaveis * (fator - 1);
    const fluxo = predial - irsSobre(predial) - creditoNoAno(ano);
    if (fluxo > 0 && acumulado + fluxo >= capitalProprio) {
      payback = ano - 1 + (capitalProprio - acumulado) / fluxo;
      break;
    }
    acumulado += fluxo;
  }

  const investimento = i.preco! + a.aquisicao.total + obra;
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
    regime,
    taxaIRS,
    irs: centimos(irs),
    yieldBruta: centimos((rendaAnualBruta / i.preco!) * 100),
    yieldLiquida: centimos((rendimentoPredial / investimento) * 100),
    yieldPosImposto: centimos(((rendimentoPredial - irs) / investimento) * 100),
    yieldCashFlow: centimos((cashFlowAnual / investimento) * 100),
    creditoAnual: centimos(creditoNoAno(1)),
    amortizacaoAnual: centimos(amortizacaoAnual),
    cashFlowAnual: centimos(cashFlowAnual),
    cashFlowMensal: centimos(cashFlowAnual / 12),
    capitalProprio,
    roi: capitalProprio > 0 ? centimos((cashFlowAnual / capitalProprio) * 100) : 0,
    payback: payback === null ? null : Math.round(payback * 10) / 10,
    notas,
  };
}
