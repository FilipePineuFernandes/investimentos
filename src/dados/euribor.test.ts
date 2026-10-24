import { describe, expect, it } from "vitest";
import exemplo from "./euribor-exemplo.test.json";
import { lerRespostaBce, urlEuribor } from "./euribor";

describe("Euribor do BCE", () => {
  it("lê o valor e o mês de uma resposta real do BCE", () => {
    const v = lerRespostaBce("euribor6", exemplo, new Date("2026-10-24T10:00:00Z"));
    expect(v.indexante).toBe("euribor6");
    expect(v.periodo).toMatch(/^\d{4}-\d{2}$/);
    expect(v.valor).toBeGreaterThan(-1);
    expect(v.valor).toBeLessThan(10);
    expect(v.consultadoEm).toBe("2026-10-24T10:00:00.000Z");
  });

  it("recusa respostas num formato inesperado", () => {
    expect(() => lerRespostaBce("euribor6", { erro: true })).toThrow("formato inesperado");
  });

  it("usa a série certa para cada prazo", () => {
    expect(urlEuribor("euribor3")).toContain("EURIBOR3MD_");
    expect(urlEuribor("euribor12")).toContain("EURIBOR1YD_");
  });
});
