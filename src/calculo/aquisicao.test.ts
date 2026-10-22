import { describe, expect, it } from "vitest";
import { custosAquisicao, imiAnual, type DadosAquisicao } from "./aquisicao";

const dados: DadosAquisicao = {
  preco: 200_000,
  vpt: 120_000,
  destino: "hpp",
  regiao: "continente",
  idade: 45,
  primeiraHabitacao: false,
  credito: null,
  escrituraRegisto: null,
  avaliacaoComissoes: 0,
  mediacaoPct: 0,
};

describe("custos de aquisição", () => {
  it("sem crédito: IMT, Imposto do Selo e Casa Pronta", () => {
    const r = custosAquisicao(dados);
    expect(r.linhas.map((l) => [l.id, l.valor])).toEqual([
      ["imt", 3542.04],
      ["is-aquisicao", 1600],
      ["escritura", 375],
    ]);
    expect(r.total).toBe(5517.04);
    expect(r.custoTotal).toBe(205_517.04);
  });

  it("com crédito: Imposto do Selo do crédito e escritura com hipoteca", () => {
    const r = custosAquisicao({ ...dados, credito: { montante: 160_000, prazoAnos: 30 }, avaliacaoComissoes: 450 });
    const valor = (id: string) => r.linhas.find((l) => l.id === id)?.valor;
    expect(valor("is-credito")).toBe(960);
    expect(valor("escritura")).toBe(700);
    expect(valor("avaliacao")).toBe(450);
  });

  it("o valor do utilizador substitui a referência", () => {
    const r = custosAquisicao({ ...dados, escrituraRegisto: 1200 });
    expect(r.linhas.find((l) => l.id === "escritura")).toMatchObject({ valor: 1200, origem: "utilizador" });
  });

  it("mediação com IVA", () => {
    const r = custosAquisicao({ ...dados, mediacaoPct: 2.5 });
    expect(r.linhas.find((l) => l.id === "mediacao")?.valor).toBe(6150); // 5 000 × 1,23
  });
});

describe("IMI", () => {
  it("VPT × taxa do município", () => {
    expect(imiAnual(120_000, 0.3)).toBe(360);
  });
});
