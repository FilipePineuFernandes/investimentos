import { describe, expect, it } from "vitest";
import { impostosTransmissao, type DadosTransmissao } from "./imt";

const base: DadosTransmissao = { preco: 200_000, vpt: null, destino: "hpp", regiao: "continente", idade: 45, primeiraHabitacao: false };
const calc = (d: Partial<DadosTransmissao>) => impostosTransmissao({ ...base, ...d });

describe("IMT", () => {
  // Contas à mão com a parcela a abater da tabela de 2025:
  // HPP 200 000 € → 200 000 × 7% − 10 252,92 = 3 747,08 €
  it("habitação própria permanente, escalão progressivo", () => {
    expect(calc({}).imt).toBe(3747.08);
  });

  it("habitação própria permanente, primeiro escalão isento", () => {
    expect(calc({ preco: 100_000 }).imt).toBe(0);
  });

  // Secundária 200 000 € → 200 000 × 7% − 9 210,31 = 4 789,69 €
  it("habitação secundária e arrendamento usam a mesma tabela", () => {
    expect(calc({ destino: "secundaria" }).imt).toBe(4789.69);
    expect(calc({ destino: "arrendamento" }).imt).toBe(4789.69);
    expect(calc({ destino: "secundaria", preco: 100_000 }).imt).toBe(1000);
  });

  it("taxa única nos escalões mais altos", () => {
    expect(calc({ preco: 700_000 }).imt).toBe(42_000);
    expect(calc({ preco: 1_200_000 }).imt).toBe(90_000);
  });

  it("armazéns e outros prédios urbanos: 6,5%", () => {
    expect(calc({ destino: "comercial" }).imt).toBe(13_000);
  });

  // Madeira: limites × 1,25 → 130 326,25 / 178 272,50 / 243 072,50
  // (178 272,50 − 130 326,25) × 2% + (200 000 − 178 272,50) × 5% = 958,93 + 1 086,38
  it("regiões autónomas com limites 25% mais altos", () => {
    expect(calc({ regiao: "madeira" }).imt).toBe(2045.3);
  });

  it("usa o VPT quando é maior do que o preço", () => {
    const r = calc({ preco: 150_000, vpt: 200_000 });
    expect(r.base).toBe(200_000);
    expect(r.imt).toBe(3747.08);
    expect(r.impostoSelo).toBe(1600);
  });
});

describe("Imposto do Selo na compra", () => {
  it("0,8% sobre o preço", () => {
    expect(calc({}).impostoSelo).toBe(1600);
  });
});

describe("IMT Jovem", () => {
  const jovem = { idade: 30, primeiraHabitacao: true };

  it("isenção total até ao limite do 4.º escalão", () => {
    const r = calc({ ...jovem, preco: 300_000 });
    expect(r).toMatchObject({ imt: 0, impostoSelo: 0, isencaoJovem: "total" });
  });

  // 400 000 − 324 058 = 75 942 → IMT 8% = 6 075,36 € · IS 0,8% = 607,54 €
  it("isenção parcial entre o 4.º e o 5.º escalão", () => {
    const r = calc({ ...jovem, preco: 400_000 });
    expect(r).toMatchObject({ imt: 6075.36, impostoSelo: 607.54, isencaoJovem: "parcial" });
  });

  it("sem isenção acima do 5.º escalão", () => {
    const r = calc({ ...jovem, preco: 700_000 });
    expect(r).toMatchObject({ imt: 42_000, impostoSelo: 5600, isencaoJovem: null });
  });

  it("só para quem cumpre todas as condições", () => {
    expect(calc({ ...jovem, idade: 36 }).isencaoJovem).toBeNull();
    expect(calc({ ...jovem, primeiraHabitacao: false }).isencaoJovem).toBeNull();
    expect(calc({ ...jovem, destino: "secundaria" }).isencaoJovem).toBeNull();
    expect(calc({ ...jovem, idade: null }).isencaoJovem).toBeNull();
    expect(calc({ ...jovem, idade: 35 }).isencaoJovem).toBe("total");
  });
});
