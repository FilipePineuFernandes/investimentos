import { describe, expect, it } from "vitest";
import { ARRENDAMENTO_VAZIO, FINANCIAMENTO_VAZIO, novoImovel, REVENDA_VAZIA, type EstrategiaArrendamento, type EstrategiaRevenda, type Imovel } from "../dados/imoveis";
import { PERFIL_VAZIO, type Perfil } from "../dados/perfil";
import { calcularArrendamento, type ResultadoArrendamento } from "./arrendamento";
import { analisarImovel } from "./imovel";
import { calcularRevenda, type ResultadoRevenda } from "./revenda";

const hoje = new Date(2026, 9, 22);
const perfil: Perfil = { ...PERFIL_VAZIO, dataNascimento: "1980-01-01", rendimentoMensalLiquido: 4000, outrasPrestacoes: 0, rendimentoColetavelAnual: 20_000 };

// Habitação secundária de 200 000 €: IMT 4 605,50 + IS 1 600 + escritura 375 = 6 580,50 €
const imovel = (d: Partial<Imovel> = {}): Imovel => ({ ...novoImovel("continente"), destino: "secundaria", preco: 200_000, vpt: 120_000, ...d });
const comCredito = { ...FINANCIAMENTO_VAZIO, montante: 140_000, prazoAnos: 30, euribor: 2.1, spread: 0.9 };

function revenda(i: Imovel, e: Partial<EstrategiaRevenda>, p = perfil) {
  const r = calcularRevenda(i, analisarImovel(i, p, hoje), { ...REVENDA_VAZIA, ...e }, p.rendimentoColetavelAnual);
  if (!("lucro" in r)) throw new Error(`faltam: ${r.faltam}`);
  return r as ResultadoRevenda;
}

/** Por defeito sem inflação, para as contas à mão; inflacao em % ao ano. */
function arrendamento(i: Imovel, e: Partial<EstrategiaArrendamento>, p = perfil, inflacao = 0) {
  const r = calcularArrendamento(i, analisarImovel(i, p, hoje), { ...ARRENDAMENTO_VAZIO, ...e }, p, 0, () => inflacao);
  if (!("yieldBruta" in r)) throw new Error(`faltam: ${r.faltam}`);
  return r as ResultadoArrendamento;
}

describe("1A: revenda", () => {
  const e: Partial<EstrategiaRevenda> = { precoVenda: 260_000, mesesAteVenda: 12, obras: 10_000, condominioMensal: 50, seguroAnual: 120, comissaoVendaPct: 5 };

  it("diz o que falta", () => {
    const i = imovel();
    expect(calcularRevenda(i, analisarImovel(i, perfil, hoje), REVENDA_VAZIA, null).faltam).toEqual(["preço de venda esperado", "prazo até à venda"]);
  });

  it("sem crédito: mais-valia, IRS e lucro, conferidos à mão", () => {
    const r = revenda(imovel(), e);
    expect(r.detencao?.total).toBe(720); // 12 × 50 + 120
    expect(r.custosVenda).toBe(15_990); // 260 000 × 5% × 1,23
    // 260 000 − 200 000 − 10 000 − 6 580,50 − 15 990 = 27 429,50 → metade englobada
    expect(r.maisValia).toMatchObject({ ganho: 27_429.5, tributavel: 13_714.75, coeficiente: 1 });
    // IRS(20 000 + 13 714,75) − IRS(20 000) = 7 556,60 − 3 343,47
    expect(r.irs).toBe(4213.13);
    // 260 000 − 200 000 − 6 580,50 − 10 000 − 720 − 15 990 − 4 213,13
    expect(r.lucro).toBe(22_496.37);
    // Capital próprio + obras + 11 meses de custos antes do mês da venda
    expect(r.capitalInvestido).toBe(217_240.5);
    expect(r.roi).toBe(10.36);
    expect(r.tir).toBeGreaterThan(9);
    expect(r.tir).toBeLessThan(12);
    expect(r.lucroPorMes).toBeCloseTo(1874.7, 1);
  });

  it("preço mínimo de venda: o lucro passa a zero", () => {
    const r = revenda(imovel(), e);
    expect(r.precoMinimo).not.toBeNull();
    expect(revenda(imovel(), { ...e, precoVenda: r.precoMinimo! }).lucro).toBeGreaterThanOrEqual(0);
    expect(revenda(imovel(), { ...e, precoVenda: r.precoMinimo! - 2 }).lucro).toBeLessThan(0);
  });

  it("com crédito: o lucro desconta os juros e a dívida é paga na venda", () => {
    const i = imovel({ financiamento: comCredito });
    const a = analisarImovel(i, perfil, hoje);
    const r = revenda(i, e);
    expect(r.dividaNaVenda).toBeCloseTo(a.credito!.plano[11].divida, 1);
    expect(r.detencao!.credito).toBeGreaterThan(0);
    const esperado = 260_000 - 200_000 - a.aquisicao!.total - 10_000 - r.detencao!.total - r.custosVenda - r.irs;
    expect(r.lucro).toBeCloseTo(esperado, 1);
  });

  it("coeficiente de desvalorização só com mais de 24 meses", () => {
    expect(revenda(imovel(), { ...e, mesesAteVenda: 24, coeficiente: 1.05 }).maisValia?.coeficiente).toBe(1);
    expect(revenda(imovel(), { ...e, mesesAteVenda: 30, coeficiente: 1.05 }).maisValia?.coeficiente).toBe(1.05);
    expect(revenda(imovel(), { ...e, mesesAteVenda: 30 }).notas.join()).toContain("coeficiente");
  });

  it("sem ganho não há IRS", () => {
    expect(revenda(imovel(), { ...e, precoVenda: 210_000 }).irs).toBe(0);
  });
});

describe("1B: arrendamento", () => {
  const i = imovel({ destino: "arrendamento", taxaImi: 0.3 });
  const e: Partial<EstrategiaArrendamento> = { rendaMensal: 900, mesesVazioAno: 1, manutencaoAnual: 500, condominioMensal: 40, seguroAnual: 150, duracaoContratoAnos: 1 };

  it("sem crédito: yields, IRS a 25%, cash-flow e payback, conferidos à mão", () => {
    const r = arrendamento(i, e);
    expect(r.rendaAnualBruta).toBe(10_800);
    expect(r.rendaEfetiva).toBe(9900);
    expect(r.totalCustos).toBe(1490); // 480 + 150 + 500 + 360 de IMI
    expect(r.rendimentoPredial).toBe(8410);
    expect(r.irs).toBe(2102.5);
    expect(r.yieldBruta).toBe(5.4);
    expect(r.yieldLiquida).toBe(4.07); // 8 410 ÷ 206 580,50
    expect(r.cashFlowAnual).toBe(6307.5);
    expect(r.cashFlowMensal).toBeCloseTo(525.63, 1);
    expect(r.roi).toBe(3.05);
    expect(r.payback).toBe(32.8); // 206 580,50 ÷ 6 307,50
  });

  it("com inflação nos custos, o payback alonga-se e o 1.º ano não muda", () => {
    const sem = arrendamento(i, e);
    const com = arrendamento(i, e, perfil, 2);
    expect(com.cashFlowAnual).toBe(sem.cashFlowAnual);
    expect(com.payback!).toBeGreaterThan(sem.payback!);
    // Ao ano 2, os 1 130 € de condomínio, seguros e manutenção sobem 2% (22,60 €): o payback
    // acumula menos: rendimento predial 8 410 − 1 130 × (1,02^(ano−1) − 1), a 75% depois do IRS,
    // até somar 206 580,50 € → 34,7 anos (contra 32,8 sem inflação).
    expect(com.payback).toBe(34.7);
  });

  it("contrato longo reduz a taxa", () => {
    expect(arrendamento(i, { ...e, duracaoContratoAnos: 5 }).taxaIRS).toBe(15);
  });

  it("englobamento usa os escalões do IRS", () => {
    const r = arrendamento(i, e, { ...perfil, englobamentoRendas: true });
    expect(r.taxaIRS).toBeNull();
    expect(r.irs).toBe(2399.28);
  });

  it("com crédito: a prestação sai do cash-flow e o payback acelera quando o crédito acaba", () => {
    const ic = imovel({ destino: "arrendamento", taxaImi: 0.3, financiamento: comCredito });
    const r = arrendamento(ic, e);
    expect(r.cashFlowAnual).toBeCloseTo(8410 - 2102.5 - r.creditoAnual, 1);
    expect(r.amortizacaoAnual).toBeGreaterThan(0);
    expect(r.capitalProprio).toBeLessThan(206_580.5);
  });

  it("diz o que falta", () => {
    expect(calcularArrendamento(i, analisarImovel(i, perfil, hoje), ARRENDAMENTO_VAZIO, perfil).faltam).toEqual(["renda mensal esperada"]);
  });
});
