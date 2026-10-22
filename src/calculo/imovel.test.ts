import { describe, expect, it } from "vitest";
import { FINANCIAMENTO_VAZIO, novoImovel, type Imovel } from "../dados/imoveis";
import { PERFIL_VAZIO, type Perfil } from "../dados/perfil";
import { analisarImovel, taxaInicial } from "./imovel";

const hoje = new Date(2026, 9, 22);
const perfil: Perfil = { ...PERFIL_VAZIO, dataNascimento: "1980-01-01", rendimentoMensalLiquido: 3000, outrasPrestacoes: 0 };
const imovel = (d: Partial<Imovel>): Imovel => ({ ...novoImovel("continente"), preco: 200_000, vpt: 120_000, ...d });

describe("análise do imóvel", () => {
  it("sem preço não calcula", () => {
    expect(analisarImovel(imovel({ preco: null }), perfil, hoje).faltam).toEqual(["valor de compra"]);
  });

  it("sem crédito: custos, IMI, €/m² e capital próprio", () => {
    const a = analisarImovel(imovel({ area: 80, taxaImi: 0.3 }), perfil, hoje);
    expect(a.aquisicao?.total).toBe(5722.08);
    expect(a.capitalProprio).toBe(205_722.08);
    expect(a.imi).toBe(360);
    expect(a.precoM2).toBe(2500);
    expect(a.credito).toBeNull();
  });

  it("com crédito incompleto, mostra os custos e diz o que falta", () => {
    const a = analisarImovel(imovel({ financiamento: { ...FINANCIAMENTO_VAZIO, montante: 160_000 } }), perfil, hoje);
    expect(a.faltam).toEqual(["prazo do crédito", "valor da Euribor", "spread"]);
    expect(a.aquisicao).not.toBeNull();
    expect(a.credito).toBeNull();
  });

  it("com crédito completo: prestação, validações e capital próprio", () => {
    const f = { ...FINANCIAMENTO_VAZIO, montante: 160_000, prazoAnos: 30, euribor: 2.1, spread: 0.9 };
    const a = analisarImovel(imovel({ financiamento: f }), perfil, hoje);
    expect(a.taxaCredito).toBe(3);
    expect(a.credito?.prestacao).toBeCloseTo(674.56, 1);
    expect(a.validacoes.map((v) => [v.id, v.cumpre])).toEqual([
      ["ltv", true],
      ["prazo", true],
      ["dsti", true],
    ]);
    // 200 000 + custos (IMT 3 747,08 + IS 1 600 + escritura 700 + IS crédito 960) − 160 000
    expect(a.capitalProprio).toBe(47_007.08);
  });
});

describe("taxa inicial", () => {
  it("variável soma Euribor e spread; fixa e mista usam a taxa fixa", () => {
    expect(taxaInicial({ ...FINANCIAMENTO_VAZIO, euribor: 2.1, spread: 0.9 })).toBe(3);
    expect(taxaInicial({ ...FINANCIAMENTO_VAZIO, tipoTaxa: "fixa", taxaFixa: 3.4 })).toBe(3.4);
    expect(taxaInicial({ ...FINANCIAMENTO_VAZIO })).toBeNull();
  });
});
