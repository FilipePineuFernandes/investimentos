import { describe, expect, it } from "vitest";
import exemplo from "./bp-exemplo.test.json";
import { lerRespostaBP, urlSerieBP } from "./bancoPortugal";

describe("taxas do Banco de Portugal (BPstat)", () => {
  it("lê o último valor de uma resposta real (taxa variável, agosto de 2026)", () => {
    const v = lerRespostaBP(exemplo, new Date("2026-10-24T10:00:00Z"));
    expect(v).toEqual({ valor: 3.27, data: "2026-08-31", consultadoEm: "2026-10-24T10:00:00.000Z" });
  });

  it("aceita os valores num objeto e salta os meses sem valor", () => {
    const j = { value: { "0": 3.1, "1": 3.2, "2": null }, dimension: { reference_date: { category: { index: { "2026-06-30": 0, "2026-07-31": 1, "2026-08-31": 2 } } } } };
    expect(lerRespostaBP(j)).toMatchObject({ valor: 3.2, data: "2026-07-31" });
  });

  it("recusa respostas num formato inesperado", () => {
    expect(() => lerRespostaBP({ erro: true })).toThrow("formato inesperado");
  });

  it("pede só a série certa", () => {
    expect(urlSerieBP("taeg")).toContain("series_ids=12533714");
    expect(urlSerieBP("taxaVariavel")).toContain("series_ids=12533730");
  });
});
