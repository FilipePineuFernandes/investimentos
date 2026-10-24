import { describe, expect, it } from "vitest";
import { CARTEIRA_VAZIA, novoImovel, type Avaliacao, type DadosCarteira, type Imovel } from "../dados/imoveis";
import type { Movimento } from "../dados/movimentosEtf";
import { PERFIL_VAZIO } from "../dados/perfil";
import { posicaoEtf } from "./carteiraEtf";
import { analisarImovel } from "./imovel";
import { grupoEtf, grupoImobiliario, totalCarteira } from "./patrimonio";

const HOJE = "2026-10-24";
const aval = (data: string, valor: number): Avaliacao => ({ id: data, data, valor, renda: null, metodo: "manual", fonte: "" });

// Habitação secundária de 200 000 €: custos de compra 6 580,50 € (ver carteira.test.ts).
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

let n = 0;
const mov = (d: Partial<Movimento>): Movimento => ({
  id: String(n++),
  isin: "IE00B4L5Y983",
  tipo: "compra",
  data: "2025-01-10",
  quantidade: 0,
  preco: 0,
  comissao: 0,
  valor: 0,
  imposto: 0,
  corretora: "",
  origem: null,
  ...d,
});

describe("carteira global: imobiliário", () => {
  it("inclui os imóveis em posse (também os arrendados) e exclui os em análise e os vendidos", () => {
    const g = grupoImobiliario(
      [
        comAnalise(imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2026-06-01", 230_000)] }, { id: "a" })),
        comAnalise(imovel({ dataCompra: "2024-03-01" }, { id: "b", estado: "arrendado" })),
        comAnalise(imovel({}, { id: "c", estado: "analise" })),
        comAnalise(imovel({ dataCompra: "2020-01-01" }, { id: "d", estado: "vendido" })),
      ],
      HOJE,
    );
    expect(g.ativos.map((x) => x.id)).toEqual(["a", "b"]);
    expect(g.ativos[0].lucro).toBe(23_419.5); // 230 000 − 206 580,50
    expect(g.ativos[0].desde).toBe("2025-01-01");
    expect(g.ativos[1].lucro).toBe(-6_580.5); // sem avaliação: só os custos de compra
    expect(g.lucro).toBe(16_839);
    expect(g.custo).toBe(413_161);
    expect(g.lucroPct).toBe(4.08);
    expect(g.incompletos).toBe(0);
  });

  it("um imóvel sem preço aparece, mas fica fora das somas", () => {
    const g = grupoImobiliario([comAnalise(imovel({}, { preco: null }))], HOJE);
    expect(g.ativos).toHaveLength(1);
    expect(g.ativos[0].lucro).toBeNull();
    expect(g.ativos[0].falta).toBeTruthy();
    expect(g.incompletos).toBe(1);
    expect(g.lucro).toBe(0);
    expect(g.lucroPct).toBeNull();
  });
});

describe("carteira global: ETF", () => {
  const movimentos = [
    mov({ data: "2025-01-10", quantidade: 10, preco: 100, comissao: 2 }),
    mov({ data: "2025-06-10", quantidade: 10, preco: 120, comissao: 2 }),
    mov({ isin: "IE00BK5BQT80", data: "2026-02-01", quantidade: 5, preco: 130, comissao: 1 }),
  ];
  const nomes = { IE00B4L5Y983: { nome: "MSCI World", ticker: "EUNL" }, IE00BK5BQT80: { nome: "All-World", ticker: "VWCE" } };

  it("lucro = valor à cotação de hoje − custo com comissões, desde a primeira compra", () => {
    const g = grupoEtf([posicaoEtf("IE00B4L5Y983", movimentos, 130)], movimentos, nomes);
    expect(g.ativos[0].desde).toBe("2025-01-10");
    expect(g.ativos[0].detalhe).toBe("EUNL · 20 unidades");
    expect(g.custo).toBe(2204);
    expect(g.valorAtual).toBe(2600);
    expect(g.lucro).toBe(396);
  });

  it("um ETF sem cotação aparece, mas fica fora das somas; posições vendidas não aparecem", () => {
    const vendido = [...movimentos, mov({ isin: "IE00BK5BQT80", tipo: "venda", data: "2026-05-01", quantidade: 5, preco: 140 })];
    const g = grupoEtf([posicaoEtf("IE00B4L5Y983", vendido, null), posicaoEtf("IE00BK5BQT80", vendido, 150)], vendido, nomes);
    expect(g.ativos.map((x) => x.id)).toEqual(["IE00B4L5Y983"]);
    expect(g.incompletos).toBe(1);
    expect(g.lucro).toBe(0);
  });

  it("total = imobiliário + ETF", () => {
    const imo = grupoImobiliario([comAnalise(imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2026-06-01", 230_000)] }))], HOJE);
    const etf = grupoEtf([posicaoEtf("IE00B4L5Y983", movimentos, 130)], movimentos, nomes);
    const t = totalCarteira(imo, etf);
    expect(t.lucro).toBe(23_815.5);
    expect(t.custo).toBe(208_784.5);
    expect(t.valorAtual).toBe(232_600);
    expect(t.lucroPct).toBe(11.41);
  });
});

describe("carteira global: rendas dos imóveis arrendados", () => {
  // Renda de 800 €/mês, sem condomínio, seguros, manutenção, gestão nem IMI: só o IRS à taxa
  // autónoma geral (25%), por isso 600 € líquidos por mês.
  const arrendado = (c: Partial<DadosCarteira>) =>
    comAnalise(imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2026-06-01", 230_000)], ...c }, { id: "r", estado: "arrendado" }));

  it("lucro líquido = valorização + rendas líquidas desde o início do contrato", () => {
    const g = grupoImobiliario([arrendado({ arrendadoDesde: "2025-04-01", rendaContrato: 800 })], HOJE, PERFIL_VAZIO);
    const x = g.ativos[0];
    expect(x.valorizacao).toBe(23_419.5);
    expect(x.rendas).toBe(10_800); // 18 meses × 600 €
    expect(x.rendasNota).toContain("18 meses");
    expect(x.lucro).toBe(34_219.5);
    expect(x.lucroPct).toBe(16.56);
    expect(g.valorizacao).toBe(23_419.5);
    expect(g.rendas).toBe(10_800);
    expect(g.lucro).toBe(34_219.5);
  });

  it("o valor exato indicado substitui a estimativa", () => {
    const g = grupoImobiliario([arrendado({ arrendadoDesde: "2025-04-01", rendaContrato: 800, rendasRecebidas: 9_500 })], HOJE, PERFIL_VAZIO);
    expect(g.ativos[0].rendas).toBe(9_500);
    expect(g.ativos[0].rendasNota).toBe("valor indicado por si");
    expect(g.lucro).toBe(32_919.5);
  });

  it("sem contrato registado, só conta a valorização", () => {
    const g = grupoImobiliario([arrendado({})], HOJE, PERFIL_VAZIO);
    expect(g.ativos[0].rendas).toBeNull();
    expect(g.lucro).toBe(23_419.5);
  });
});

describe("carteira global: ETF a subir e a descer", () => {
  it("o lucro líquido total soma as subidas e as descidas desde o dia da compra", () => {
    const movs = [
      mov({ isin: "IE00B4L5Y983", data: "2025-01-10", quantidade: 10, preco: 100 }), // pagou 1 000 €
      mov({ isin: "IE00BK5BQT80", data: "2026-02-01", quantidade: 10, preco: 130 }), // pagou 1 300 €
    ];
    const nomes = { IE00B4L5Y983: { nome: "Sobe", ticker: "EUNL" }, IE00BK5BQT80: { nome: "Desce", ticker: "VWCE" } };
    const g = grupoEtf([posicaoEtf("IE00B4L5Y983", movs, 125), posicaoEtf("IE00BK5BQT80", movs, 110)], movs, nomes);
    expect(g.ativos.map((x) => x.lucro)).toEqual([250, -200]); // +25% e −15,38%
    expect(g.lucro).toBe(50);
    expect(g.custo).toBe(2300);
    expect(g.valorAtual).toBe(2350);
    expect(g.lucroPct).toBe(2.17);
  });
});
