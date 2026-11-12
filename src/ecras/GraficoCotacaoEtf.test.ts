import { describe, expect, it } from "vitest";
import { seriesCotacao } from "./GraficoCotacaoEtf";
import { juntarPontos } from "../dados/movimentosEtf";

const etf = [
  { isin: "A", codigo: "AAA", valor: 10, pontos: [{ data: "2026-01-01", preco: 50 }, { data: "2026-02-01", preco: 55 }, { data: "2026-03-01", preco: 60 }] },
  { isin: "B", codigo: "BBB", valor: 20, pontos: [{ data: "2026-01-01", preco: 1000 }] },
];

describe("gráfico da cotação dos ETF", () => {
  it("variação em % desde a primeira cotação do período", () => {
    expect(seriesCotacao(etf, ["A"], true, "").map((s) => s.pontos.map((p) => p.valor))).toEqual([[0, 10, 20]]);
    expect(seriesCotacao(etf, ["A"], true, "2026-02-01")[0].pontos.map((p) => p.valor)).toEqual([0, 9.09]);
    expect(seriesCotacao(etf, ["A"], false, "")[0].pontos.map((p) => p.valor)).toEqual([50, 55, 60]);
  });

  it("deixa de fora os ETF com menos de duas cotações", () => {
    expect(seriesCotacao(etf, ["A", "B"], true, "").map((s) => s.id)).toEqual(["A"]);
  });

  it("junta o histórico: um preço por dia, o mais recente prevalece", () => {
    expect(juntarPontos([{ data: "2026-01-02", preco: 1 }, { data: "2026-01-01", preco: 2 }], [{ data: "2026-01-02", preco: 3 }, { data: "x", preco: 9 }])).toEqual([
      { data: "2026-01-01", preco: 2 },
      { data: "2026-01-02", preco: 3 },
    ]);
  });
});
