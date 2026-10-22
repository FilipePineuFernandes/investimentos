import { describe, expect, it } from "vitest";
import { CARTEIRA_VAZIA, FINANCIAMENTO_VAZIO, novoImovel, type Avaliacao, type DadosCarteira, type Imovel } from "../dados/imoveis";
import { PERFIL_VAZIO } from "../dados/perfil";
import { evolucaoCarteira, mesesEntre, posicao, resultadoVenda, resumoCarteira } from "./carteira";
import { analisarImovel } from "./imovel";

const HOJE = "2026-10-22";
const aval = (data: string, valor: number): Avaliacao => ({ id: data, data, valor, renda: null, metodo: "manual", fonte: "" });

// Habitação secundária de 200 000 €: custos de compra 6 580,50 €.
const imovel = (carteira: Partial<DadosCarteira>, d: Partial<Imovel> = {}): Imovel => ({
  ...novoImovel("continente"),
  destino: "secundaria",
  estado: "comprado",
  preco: 200_000,
  vpt: 120_000,
  carteira: { ...CARTEIRA_VAZIA, ...carteira },
  ...d,
});
const analise = (i: Imovel) => analisarImovel(i, PERFIL_VAZIO);

describe("meses entre datas", () => {
  it("só conta meses completos", () => {
    expect(mesesEntre("2026-01-15", HOJE)).toBe(9);
    expect(mesesEntre("2026-01-25", HOJE)).toBe(8);
    expect(mesesEntre(HOJE, "2026-01-01")).toBe(0);
  });
});

describe("posição de um imóvel", () => {
  it("valor atual = última avaliação até hoje; mais-valia sobre o custo investido", () => {
    const i = imovel({ dataCompra: "2025-01-01", obrasRealizadas: 5000, avaliacoes: [aval("2026-06-01", 230_000), aval("2027-01-01", 250_000)] });
    const p = posicao(i, analise(i), HOJE)!;
    expect(p.custoInvestido).toBe(211_580.5); // 200 000 + 6 580,50 + 5 000
    expect(p.valorAtual).toBe(230_000);
    expect(p.avaliadoEm).toBe("2026-06-01");
    expect(p.maisValiaLatente).toBe(18_419.5);
    expect(p.maisValiaPct).toBe(8.71);
    expect(p.divida).toBe(0);
    expect(p.capitalProprio).toBe(230_000);
  });

  it("sem avaliações, o valor atual é o preço de compra", () => {
    const i = imovel({ dataCompra: "2025-01-01" });
    expect(posicao(i, analise(i), HOJE)!.valorAtual).toBe(200_000);
  });

  it("dívida em curso pelo plano de pagamentos", () => {
    const f = { ...FINANCIAMENTO_VAZIO, montante: 140_000, prazoAnos: 30, euribor: 2.1, spread: 0.9 };
    const i = imovel({ dataCompra: "2026-01-22" }, { financiamento: f });
    const a = analise(i);
    const p = posicao(i, a, HOJE)!;
    expect(p.divida).toBeCloseTo(a.credito!.plano[8].divida, 1); // 9 meses pagos
    expect(p.capitalProprio).toBeCloseTo(200_000 - p.divida!, 1);
    expect(posicao(imovel({}, { financiamento: f }), a, HOJE)!.divida).toBeNull();
  });
});

describe("imóvel vendido", () => {
  it("lucro, ROI e TIR realizados", () => {
    const i = imovel({ dataCompra: "2025-01-01", venda: { data: "2026-01-01", valor: 250_000, custos: 15_000, irs: 4000, rendimentoLiquido: null } }, { estado: "vendido" });
    const v = resultadoVenda(i, posicao(i, analise(i), HOJE)!)!;
    expect(v.lucro).toBe(24_419.5); // 250 000 − 15 000 − 4 000 − 206 580,50
    expect(v.roi).toBe(11.82);
    expect(v.tir).toBeCloseTo(11.82, 1); // exatamente um ano
  });

  it("sem valor de venda não há resultado", () => {
    const i = imovel({ dataCompra: "2025-01-01", venda: null }, { estado: "vendido" });
    expect(resultadoVenda(i, posicao(i, analise(i), HOJE)!)).toBeNull();
  });
});

describe("carteira", () => {
  const a = imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2026-01-01", 220_000)] });
  const b = imovel({ dataCompra: "2025-06-01", venda: { data: "2026-03-01", valor: 120_000, custos: 0, irs: 0, rendimentoLiquido: 0 } }, { estado: "vendido", preco: 100_000 });
  const emAnalise = imovel({ dataCompra: "2025-01-01" }, { estado: "analise" });

  it("evolução: soma do último valor de cada imóvel que era seu em cada data", () => {
    expect(evolucaoCarteira([a, b, emAnalise], HOJE)).toEqual([
      { data: "2025-01-01", valor: 200_000 },
      { data: "2025-06-01", valor: 300_000 },
      { data: "2026-01-01", valor: 320_000 },
      { data: "2026-03-01", valor: 220_000 },
    ]);
  });

  it("resumo: só os imóveis em carteira; os vendidos contam no lucro realizado", () => {
    const r = resumoCarteira([a, b, emAnalise].map((i) => ({ i, a: analise(i) })), HOJE);
    expect(r).toMatchObject({ imoveis: 1, valorAtual: 220_000, custoInvestido: 206_580.5, maisValiaLatente: 13_419.5, divida: 0, capitalProprio: 220_000, vendidos: 1 });
    // B: comprado por 100 000 € com VPT de 120 000 €, por isso os impostos incidem sobre o VPT:
    // IMT 106 346 × 1% + 13 654 × 2% = 1 336,54 · IS 960 · escritura 375 → custo 102 671,54
    // vendido por 120 000 € → lucro 17 328,46 €
    expect(r.lucroRealizado).toBe(17_328.46);
  });
});
