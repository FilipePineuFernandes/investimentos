import { describe, expect, it } from "vitest";
import { agregar, compatibilidade, type ItemGrafico } from "./graficos";

// Valores inventados.
const item = (id: string, area: string, setor: string, custo: number | null, valor: number | null): ItemGrafico => ({
  id,
  nome: id,
  grupos: { area: { id: area, nome: area }, setor: { id: setor, nome: setor }, ativo: { id, nome: id } },
  custo,
  valor,
  lucro: custo !== null && valor !== null ? valor - custo : null,
});
const itens = [item("A", "ETF", "Tecnologia", 100, 150), item("B", "ETF", "Saúde", 200, 180), item("C", "ETF", "Tecnologia", 50, 70), item("D", "ETF", "Saúde", 80, null)];

describe("dados dos gráficos", () => {
  it("soma por grupo o valor, o que pagou e o lucro", () => {
    expect(agregar(itens, "setor", "valor").grupos).toEqual([
      { id: "Tecnologia", nome: "Tecnologia", valor: 220 },
      { id: "Saúde", nome: "Saúde", valor: 180 },
    ]);
    expect(agregar(itens, "setor", "lucro").grupos.map((g) => g.valor)).toEqual([70, -20]);
  });

  it("o lucro em % é o do grupo sobre o que pagou, não a média das percentagens", () => {
    // Tecnologia: (50 + 20) / (100 + 50) = 46,67%
    expect(agregar(itens, "setor", "lucroPct").grupos[0].valor).toBe(46.67);
  });

  it("deixa de fora e conta os ativos sem o dado da medida", () => {
    const r = agregar(itens, "ativo", "valor");
    expect(r.grupos.map((g) => g.id)).toEqual(["A", "B", "C"]);
    expect(r.semDados).toBe(1);
    expect(agregar(itens, "ativo", "custo").semDados).toBe(0);
  });

  it("explica as combinações que não fazem sentido", () => {
    expect(compatibilidade("circular", "lucro", true)).toMatch(/partes de um todo/);
    expect(compatibilidade("circular", "valor", false)).toBeNull();
    expect(compatibilidade("evolucao", "valor", false)).toMatch(/evolução/);
    expect(compatibilidade("barras", "lucroPct", false)).toBeNull();
  });
});
