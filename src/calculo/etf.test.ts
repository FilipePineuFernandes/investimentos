import { describe, expect, it } from "vitest";
import { novoETF, type ETF } from "../dados/etf";
import { PERFIL_VAZIO, type Perfil } from "../dados/perfil";
import { custoCompra, isinValido, precisaRevisao, problemasETF, projetarETF, simular, taxaLiquida, valorFuturo } from "./etf";
import { irsAdicional } from "./irs";

const etf = (d: Partial<ETF> = {}): ETF => ({ ...novoETF("2026-10-01"), isin: "IE00B4L5Y983", nome: "Mundo", ter: 0.2, kid: true, ...d });

describe("ISIN", () => {
  it("valida o dígito de controlo", () => {
    expect(isinValido("IE00B4L5Y983")).toBe(true);
    expect(isinValido("US0378331005")).toBe(true);
    expect(isinValido("IE00B4L5Y984")).toBe(false);
    expect(isinValido("ie00b4l5y983")).toBe(false);
    expect(isinValido("IE00B4L5Y98")).toBe(false);
  });
});

describe("catálogo", () => {
  it("exclui ETF dos EUA e exige KID e TER", () => {
    expect(problemasETF(etf())).toEqual([]);
    expect(problemasETF(etf({ isin: "US78462F1030" })).join()).toContain("EUA");
    expect(problemasETF(etf({ kid: false })).join()).toContain("KID");
    expect(problemasETF(etf({ ter: null })).join()).toContain("TER");
  });

  it("lembra a revisão ao fim de 6 meses", () => {
    expect(precisaRevisao(etf({ atualizadoEm: "2026-05-01" }), "2026-10-22")).toBe(false);
    expect(precisaRevisao(etf({ atualizadoEm: "2026-04-22" }), "2026-10-22")).toBe(true);
  });
});

describe("juros compostos", () => {
  it("capital inicial: C × (1 + r)ⁿ", () => {
    expect(valorFuturo(10_000, 0, 0.06, 10)).toBeCloseTo(17_908.48, 2);
  });

  it("reforços mensais sem juros somam-se", () => {
    expect(valorFuturo(0, 100, 0, 1)).toBeCloseTo(1200, 6);
  });

  it("reforços mensais com a taxa mensal equivalente", () => {
    const rm = Math.pow(1.06, 1 / 12) - 1;
    expect(valorFuturo(0, 100, 0.06, 10)).toBeCloseTo((100 * (Math.pow(1 + rm, 120) - 1)) / rm, 6);
  });

  it("taxa líquida: menos o TER e, na distribuição, menos o imposto dos dividendos", () => {
    expect(taxaLiquida(etf(), 6)).toBeCloseTo(5.8, 10);
    expect(taxaLiquida(etf({ politica: "distribuicao", dividendosPct: 2 }), 6)).toBeCloseTo(5.24, 10); // 6 − 0,2 − 2 × 28%
  });
});

describe("projeção de um ETF", () => {
  it("valor final, imposto de 28% na venda, valor real e custo do TER", () => {
    const p = projetarETF(etf(), 10_000, 0, 6, 10, PERFIL_VAZIO);
    const vf = 10_000 * Math.pow(1.058, 10);
    expect(p.valorFinal).toBeCloseTo(vf, 1);
    expect(p.ganho).toBeCloseTo(vf - 10_000, 1);
    expect(p.imposto).toBeCloseTo((vf - 10_000) * 0.28, 1);
    expect(p.real).toBeCloseTo((vf - (vf - 10_000) * 0.28) / Math.pow(1.02, 10), 1);
    expect(p.custoTER).toBeCloseTo(17_908.48 - vf, 1);
  });

  it("englobamento usa os escalões do IRS", () => {
    const perfil: Perfil = { ...PERFIL_VAZIO, englobamentoMaisValias: true, rendimentoColetavelAnual: 20_000 };
    const p = projetarETF(etf(), 10_000, 0, 6, 10, perfil);
    expect(p.imposto).toBeCloseTo(irsAdicional(20_000, p.ganho), 0);
  });

  it("perdas não pagam imposto", () => {
    expect(projetarETF(etf({ ter: 5 }), 10_000, 0, 4, 5, PERFIL_VAZIO).imposto).toBe(0);
  });
});

describe("custos de compra", () => {
  const perfil: Perfil = { ...PERFIL_VAZIO, corretora: { nome: "X", comissaoFixa: 2, comissaoPercentagem: 0.1, cambioPercentagem: 0.25 } };

  it("comissão fixa e percentual, mais câmbio quando não é em euros", () => {
    expect(custoCompra(etf(), 1000, perfil)).toBeCloseTo(3, 6); // 2 + 1
    expect(custoCompra(etf({ moedaNegociacao: "USD" }), 1000, perfil)).toBeCloseTo(5.5, 6); // + 2,50 de câmbio
    expect(custoCompra(etf(), 0, perfil)).toBe(0);
  });

  it("reduzem o valor investido", () => {
    const sem = projetarETF(etf(), 1000, 0, 6, 1, PERFIL_VAZIO);
    const com = projetarETF(etf(), 1000, 0, 6, 1, perfil);
    expect(com.custosCompra).toBe(3);
    expect(com.valorFinal).toBeCloseTo(sem.valorFinal - 3 * 1.058, 2);
  });
});

describe("simulação da carteira escolhida", () => {
  const a = etf({ isin: "IE00B4L5Y983", ter: 0.2 });
  const b = etf({ isin: "IE00BKM4GZ66", ter: 0.1 });

  it("TER ponderado e soma das projeções, com o reforço dividido na proporção do valor", () => {
    const s = simular(
      [
        { etf: a, valor: 6000 },
        { etf: b, valor: 4000 },
      ],
      100,
      PERFIL_VAZIO,
    );
    expect(s.inicialTotal).toBe(10_000);
    expect(s.terPonderado).toBe(0.16);
    expect(s.terAnual).toBe(16);
    const esperado = projetarETF(a, 6000, 60, 8, 20, PERFIL_VAZIO).valorFinal + projetarETF(b, 4000, 40, 8, 20, PERFIL_VAZIO).valorFinal;
    expect(s.resultados[20][8].valorFinal).toBeCloseTo(esperado, 1);
    expect(s.resultados[20][8].investido).toBe(10_000 + 100 * 240);
    expect(Object.keys(s.resultados[1])).toEqual(["4", "6", "8", "10"]);
  });
});
