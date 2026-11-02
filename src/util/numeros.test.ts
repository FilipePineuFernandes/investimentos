import { describe, expect, it } from "vitest";
import { dataPt, lerNumero } from "./numeros";
import { idade } from "../dados/perfil";

describe("lerNumero", () => {
  it.each([
    ["1234", 1234],
    ["1 234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1.234.567", 1234567],
    ["0,8", 0.8],
    ["12.5", 12.5],
    ["250 000 €", 250000],
    ["", null],
    ["abc", null],
  ])("%s → %s", (texto, esperado) => {
    expect(lerNumero(texto)).toBe(esperado);
  });
});

describe("idade", () => {
  it("conta o aniversário", () => {
    expect(idade("1990-10-22", new Date(2026, 9, 21))).toBe(35);
    expect(idade("1990-10-22", new Date(2026, 9, 22))).toBe(36);
    expect(idade("", new Date())).toBeNull();
  });
});

describe("dataPt", () => {
  it("passa a data ISO para o formato português e deixa o resto como está", () => {
    expect(dataPt("2026-06-26")).toBe("26/06/2026");
    expect(dataPt("")).toBe("");
    expect(dataPt("26/06/2026")).toBe("26/06/2026");
  });
});
