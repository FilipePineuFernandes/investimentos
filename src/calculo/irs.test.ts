import { describe, expect, it } from "vitest";
import { irsAdicional, irsComQuociente, irsPorEscaloes, taxaAutonomaRendas } from "./irs";

describe("IRS por escalões (2026)", () => {
  // 8 342 × 12,5% + (10 000 − 8 342) × 15,7% = 1 042,75 + 260,31
  it("soma cada parte à taxa do seu escalão", () => {
    expect(irsPorEscaloes(10_000)).toBe(1303.06);
    expect(irsPorEscaloes(0)).toBe(0);
  });

  // 1 042,75 + 666,47 + 1 113,21 + (20 000 − 17 838) × 24,1% = 3 343,47
  it("rendimento de 20 000 €", () => {
    expect(irsPorEscaloes(20_000)).toBe(3343.47);
  });

  it("englobamento: diferença entre o IRS com e sem o rendimento extra", () => {
    expect(irsAdicional(null, 10_000)).toBe(1303.06);
    expect(irsAdicional(20_000, 0)).toBe(0);
    expect(irsAdicional(20_000, 8410)).toBe(2399.28); // 5 742,75 − 3 343,47
  });
});

describe("taxa autónoma das rendas", () => {
  it("25% na habitação, menos nos contratos longos, 28% nas outras rendas", () => {
    expect(taxaAutonomaRendas("arrendamento", null)).toBe(25);
    expect(taxaAutonomaRendas("arrendamento", 4)).toBe(25);
    expect(taxaAutonomaRendas("arrendamento", 5)).toBe(15);
    expect(taxaAutonomaRendas("arrendamento", 10)).toBe(10);
    expect(taxaAutonomaRendas("arrendamento", 20)).toBe(5);
    expect(taxaAutonomaRendas("comercial", 20)).toBe(28);
  });
});

describe("quociente familiar (tributação conjunta)", () => {
  it("com quociente 1 é igual ao cálculo normal", () => {
    expect(irsComQuociente(20_000, 1)).toBe(irsPorEscaloes(20_000));
    expect(irsComQuociente(20_000)).toBe(irsPorEscaloes(20_000));
  });

  // Um casal com 35 896 € fica com 17 948 € cada: 1 042,75 + 666,47 + 1 113,21 + 110 × 24,1% = 2 848,94 cada.
  it("parte o rendimento pelo quociente, aplica a tabela e multiplica de volta", () => {
    expect(irsComQuociente(35_896, 2)).toBe(5697.88);
    expect(irsComQuociente(35_896, 2)).toBeLessThan(irsPorEscaloes(35_896));
  });

  it("um quociente inválido conta como 1", () => {
    expect(irsComQuociente(20_000, 0)).toBe(irsPorEscaloes(20_000));
  });

  // Cada um passa de 17 948 € para 20 448 €, sempre no escalão de 24,1%: 2 500 × 24,1% × 2 = 1 205.
  it("englobamento: o casal não sobe de escalão como se fosse uma só pessoa", () => {
    expect(irsAdicional(35_896, 5000, 2)).toBe(1205);
    expect(irsAdicional(35_896, 5000, 1)).toBeGreaterThan(1700);
  });
});
