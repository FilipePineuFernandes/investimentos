import { describe, expect, it } from "vitest";
import { distanciaKm, etiquetaPreco } from "./geo";

describe("distância (Haversine)", () => {
  it("Lisboa (Praça do Comércio) ao Porto (Avenida dos Aliados): cerca de 275 km", () => {
    expect(distanciaKm({ lat: 38.7075, lng: -9.1364 }, { lat: 41.1486, lng: -8.611 })).toBeCloseTo(275, 0);
  });

  it("0,01 graus de latitude são cerca de 1,11 km", () => {
    expect(distanciaKm({ lat: 38.7, lng: -9.1 }, { lat: 38.71, lng: -9.1 })).toBeCloseTo(1.112, 2);
  });

  it("o mesmo ponto está a 0 km", () => {
    expect(distanciaKm({ lat: 38.7, lng: -9.1 }, { lat: 38.7, lng: -9.1 })).toBe(0);
  });
});

describe("etiquetas de preço", () => {
  it("venda em milhares ou milhões, arrendamento por mês", () => {
    expect(etiquetaPreco(395_000, false)).toBe("395 mil €");
    expect(etiquetaPreco(1_250_000, false)).toBe("1,25 M€");
    expect(etiquetaPreco(1200, true)).toBe("1200 €/mês");
    expect(etiquetaPreco(850, true)).toBe("850 €/mês");
  });
});
