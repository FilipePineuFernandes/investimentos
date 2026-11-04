import { describe, expect, it } from "vitest";
import { CARTEIRA_VAZIA, novoImovel, VENDA_VAZIA, type DadosCarteira, type Imovel, type VendaRealizada } from "../dados/imoveis";
import { PERFIL_VAZIO } from "../dados/perfil";
import { analisarImovel } from "./imovel";
import { grupoEtf, grupoImobiliario, grupoVendidos, totalCarteira } from "./patrimonio";
import { despesasVenda, rendasAteData } from "./venda";

const HOJE = "2026-10-24";

// Habitação secundária de 200 000 €: custos de compra 6 580,50 € (ver carteira.test.ts), custo global 206 580,50 €.
const imovel = (carteira: Partial<DadosCarteira>, d: Partial<Imovel> = {}): Imovel => ({
  ...novoImovel("continente"),
  nome: "T2 Porto",
  destino: "secundaria",
  estado: "comprado",
  preco: 200_000,
  vpt: 120_000,
  carteira: { ...CARTEIRA_VAZIA, ...carteira },
  ...d,
});
const comAnalise = (i: Imovel) => ({ i, a: analisarImovel(i, PERFIL_VAZIO) });
const venda = (v: Partial<VendaRealizada>): VendaRealizada => ({ ...VENDA_VAZIA, ...v });

describe("despesas da venda", () => {
  it("a mediação paga IVA; as restantes despesas somam sem IVA", () => {
    const d = despesasVenda(venda({ valor: 250_000, mediacao: true, mediacaoPct: 5, declaracaoCondominio: 30, certificadoEnergetico: 120, outrasDespesas: 200 }));
    expect(d.mediacao).toBe(12_500);
    expect(d.iva).toBe(2_875); // 23%
    expect(d.total).toBe(15_725); // 12 500 + 2 875 + 30 + 120 + 200
  });

  it("sem mediação, a percentagem não conta", () => {
    expect(despesasVenda(venda({ valor: 250_000, mediacao: false, mediacaoPct: 5, certificadoEnergetico: 120 })).total).toBe(120);
  });
});

describe("rendas até à data da venda", () => {
  it("a renda do contrato em cada dia 8; ou o valor indicado; ou nada se nunca esteve arrendado", () => {
    expect(rendasAteData(imovel({ arrendadoDesde: "2025-04-01", rendaContrato: 800 }), HOJE)).toBe(15_200);
    expect(rendasAteData(imovel({ arrendadoDesde: "2025-04-01", rendaContrato: 800 }), "2025-05-31")).toBe(1_600);
    expect(rendasAteData(imovel({ arrendadoDesde: "2025-04-01", rendaContrato: 800, rendasRecebidas: 9_500 }), HOJE)).toBe(9_500);
    expect(rendasAteData(imovel({}), HOJE)).toBeNull();
  });
});

describe("lucro realizado dos imóveis vendidos", () => {
  const vendido = (v: Partial<VendaRealizada>, c: Partial<DadosCarteira> = {}) =>
    comAnalise(imovel({ dataCompra: "2024-01-01", ...c, venda: venda({ data: "2026-09-01", ...v }) }, { id: "v", estado: "vendido" }));

  it("lucro = venda − despesas − custo global + rendas", () => {
    const despesas = despesasVenda(venda({ valor: 250_000, mediacao: true, mediacaoPct: 5, certificadoEnergetico: 120 })).total; // 15 495
    const g = grupoVendidos([vendido({ valor: 250_000, mediacao: true, mediacaoPct: 5, certificadoEnergetico: 120, custos: despesas, rendimentoLiquido: 5_000 })], HOJE);
    expect(g.ativos).toHaveLength(1);
    expect(g.custo).toBe(206_580.5);
    // 250 000 − 15 495 + 5 000 − 206 580,50
    expect(g.lucro).toBe(32_924.5);
    expect(g.incompletos).toEqual([]);
  });

  it("o IRS pago também se desconta", () => {
    expect(grupoVendidos([vendido({ valor: 250_000, custos: 0, irs: 4_000 })], HOJE).lucro).toBe(39_419.5);
  });

  it("sem valor de venda ou sem data de compra, fica de fora e avisa", () => {
    const g = grupoVendidos([vendido({ valor: null }), vendido({ valor: 250_000 }, { dataCompra: "" })], HOJE);
    expect(g.ativos).toEqual([]);
    expect(g.incompletos).toEqual(["T2 Porto", "T2 Porto"]);
  });

  it("os vendidos não estão na carteira, mas o lucro realizado soma ao total", () => {
    const vend = grupoVendidos([vendido({ valor: 250_000, custos: 0 })], HOJE); // lucro 43 419,50
    const emPosse = comAnalise(imovel({ dataCompra: "2025-01-01" }, { id: "a" })); // lucro −6 580,50
    const imo = grupoImobiliario([emPosse, vendido({ valor: 250_000, custos: 0 })], HOJE);
    expect(imo.ativos.map((x) => x.id)).toEqual(["a"]);
    const t = totalCarteira(imo, grupoEtf([], [], {}), vend);
    expect(t.lucroRealizado).toBe(43_419.5);
    expect(t.lucro).toBe(36_839);
    expect(t.custo).toBe(206_580.5); // só o que ainda tem
    expect(t.lucroPct).toBe(8.92); // 36 839 ÷ (206 580,50 + 206 580,50)
  });
});
