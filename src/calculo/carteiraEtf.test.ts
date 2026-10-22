import { describe, expect, it } from "vitest";
import type { Movimento } from "../dados/movimentosEtf";
import { impostoPorAno, posicaoEtf } from "./carteiraEtf";

const ISIN = "IE00B4L5Y983";
let n = 0;
const mov = (d: Partial<Movimento>): Movimento => ({
  id: String(n++),
  isin: ISIN,
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

describe("posição FIFO", () => {
  const compras = [
    mov({ data: "2025-01-10", quantidade: 10, preco: 100, comissao: 2 }), // 100,20 por unidade
    mov({ data: "2025-06-10", quantidade: 10, preco: 120, comissao: 2 }), // 120,20 por unidade
  ];

  it("sem vendas: quantidade, custo com comissões, preço médio e ganho latente", () => {
    const p = posicaoEtf(ISIN, compras, 130);
    expect(p.quantidade).toBe(20);
    expect(p.custo).toBe(2204); // 1 002 + 1 202
    expect(p.precoMedio).toBe(110.2);
    expect(p.valorAtual).toBe(2600);
    expect(p.latente).toBe(396);
    expect(p.latentePct).toBe(17.97);
  });

  it("a venda consome primeiro as unidades mais antigas", () => {
    // Vende 15: 10 do 1.º lote (1 002) + 5 do 2.º (601) = custo 1 603. Recebe 15 × 140 − 3 = 2 097.
    const p = posicaoEtf(ISIN, [...compras, mov({ tipo: "venda", data: "2026-03-01", quantidade: 15, preco: 140, comissao: 3 })], 140);
    expect(p.vendas).toEqual([{ data: "2026-03-01", quantidade: 15, receita: 2097, custo: 1603, ganho: 494, quantidadeCurtoPrazo: 5 }]);
    expect(p.quantidade).toBe(5);
    expect(p.custo).toBe(601); // 5 unidades do 2.º lote
    expect(p.realizado).toBe(494);
  });

  it("assinala vendas de mais unidades do que as que tem", () => {
    const p = posicaoEtf(ISIN, [...compras, mov({ tipo: "venda", data: "2026-03-01", quantidade: 25, preco: 140 })], null);
    expect(p.erros).toHaveLength(1);
    expect(p.quantidade).toBe(0);
    expect(p.valorAtual).toBeNull();
  });

  it("frações sem restos fantasma", () => {
    const p = posicaoEtf(
      ISIN,
      [mov({ quantidade: 0.1, preco: 100 }), mov({ quantidade: 0.2, preco: 100 }), mov({ tipo: "venda", data: "2026-01-01", quantidade: 0.3, preco: 110 })],
      110,
    );
    expect(p.quantidade).toBe(0);
    expect(p.erros).toEqual([]);
  });

  it("dividendos brutos e líquidos", () => {
    const p = posicaoEtf(ISIN, [...compras, mov({ tipo: "dividendo", data: "2025-12-01", valor: 50, imposto: 14 })], null);
    expect(p.dividendosBrutos).toBe(50);
    expect(p.dividendosLiquidos).toBe(36);
  });
});

describe("IRS das vendas por ano", () => {
  it("saldo de mais e menos-valias do ano, a 28%", () => {
    const a = posicaoEtf(ISIN, [mov({ quantidade: 10, preco: 100 }), mov({ tipo: "venda", data: "2026-03-01", quantidade: 10, preco: 150 })], null);
    const b = posicaoEtf("LU0000000000", [mov({ isin: "LU0000000000", quantidade: 10, preco: 100 }), mov({ isin: "LU0000000000", tipo: "venda", data: "2026-05-01", quantidade: 10, preco: 80 })], null);
    expect(impostoPorAno([a, b])).toEqual([{ ano: 2026, saldo: 300, imposto: 84, curtoPrazo: false }]); // 500 − 200
  });
});
