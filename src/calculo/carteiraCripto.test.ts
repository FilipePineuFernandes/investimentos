import { describe, expect, it } from "vitest";
import type { MovimentoCripto } from "../dados/movimentosCripto";
import { impostoCripto, posicaoCripto } from "./carteiraCripto";

// Valores inventados.
let n = 0;
const mov = (tipo: "compra" | "venda", data: string, moeda: string, quantidade: number, preco: number, comissao = 0): MovimentoCripto => ({ id: `m${++n}`, tipo, data, moeda, quantidade, preco, comissao });

describe("carteira de cripto", () => {
  it("posição FIFO com quantidades de 8 casas, sem restos fantasma", () => {
    const ms = [mov("compra", "2024-01-10", "BTC", 0.00012345, 40000), mov("compra", "2024-02-10", "BTC", 0.00000001, 41000), mov("venda", "2024-03-01", "BTC", 0.00012346, 50000)];
    const p = posicaoCripto("BTC", ms, 60000);
    expect(p.quantidade).toBe(0);
    expect(p.erros).toEqual([]);
  });

  it("separa o ganho isento (365 dias ou mais) do tributável, lote a lote", () => {
    const ms = [
      mov("compra", "2023-01-10", "ETH", 1, 1000, 2), // detido mais de um ano na venda
      mov("compra", "2024-06-01", "ETH", 1, 2000, 2), // detido menos de um ano
      mov("venda", "2025-03-01", "ETH", 2, 3000, 4),
    ];
    const [a] = impostoCripto(ms);
    expect(a.ano).toBe(2025);
    // Lote 1: 3000 − 2 (metade da comissão) − 1002 = 1996, isento. Lote 2: 3000 − 2 − 2002 = 996, tributável.
    expect(a.isento).toBe(1996);
    expect(a.tributavel).toBe(996);
    expect(a.imposto).toBe(278.88);
  });

  it("365 dias exatos já contam como isentos; perdas de curto prazo não pagam imposto", () => {
    const isento = impostoCripto([mov("compra", "2024-03-01", "SOL", 10, 100), mov("venda", "2025-03-01", "SOL", 10, 150)]);
    expect(isento[0]).toMatchObject({ isento: 500, tributavel: 0, imposto: 0 });
    const perda = impostoCripto([mov("compra", "2025-01-01", "SOL", 10, 150), mov("venda", "2025-02-01", "SOL", 10, 100)]);
    expect(perda[0]).toMatchObject({ tributavel: -500, imposto: 0 });
  });

  it("moedas diferentes não se misturam", () => {
    const ms = [mov("compra", "2025-01-01", "BTC", 1, 100), mov("compra", "2025-01-01", "ETH", 1, 10), mov("venda", "2025-02-01", "ETH", 1, 20)];
    expect(impostoCripto(ms)[0].tributavel).toBe(10);
    expect(posicaoCripto("BTC", ms, null).quantidade).toBe(1);
  });
});
