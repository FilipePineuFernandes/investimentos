import { describe, expect, it } from "vitest";
import { irsAdicional, irsPorEscaloes, taxaAutonomaRendas } from "./irs";

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
