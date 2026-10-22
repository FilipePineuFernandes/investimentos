import { describe, expect, it } from "vitest";
import { impostosTransmissao, type DadosTransmissao } from "./imt";

const base: DadosTransmissao = { preco: 200_000, vpt: null, destino: "hpp", regiao: "continente", idade: 45, primeiraHabitacao: false };
const calc = (d: Partial<DadosTransmissao>) => impostosTransmissao({ ...base, ...d });

describe("IMT", () => {
  // Contas à mão com a tabela de 2026:
  // HPP 200 000 € → (145 470 − 106 346) × 2% + (198 347 − 145 470) × 5% + (200 000 − 198 347) × 7%
  //               = 782,48 + 2 643,85 + 115,71 = 3 542,04 €
  it("habitação própria permanente, escalão progressivo", () => {
    expect(calc({}).imt).toBe(3542.04);
  });

  it("habitação própria permanente, primeiro escalão isento", () => {
    expect(calc({ preco: 100_000 }).imt).toBe(0);
  });

  // Secundária 200 000 € → 106 346 × 1% + 782,48 + 2 643,85 + 115,71 = 4 605,50 €
  it("habitação secundária e arrendamento usam a mesma tabela", () => {
    expect(calc({ destino: "secundaria" }).imt).toBe(4605.5);
    expect(calc({ destino: "arrendamento" }).imt).toBe(4605.5);
    expect(calc({ destino: "secundaria", preco: 100_000 }).imt).toBe(1000);
  });

  it("taxa única nos escalões mais altos", () => {
    expect(calc({ preco: 700_000 }).imt).toBe(42_000);
    expect(calc({ preco: 1_200_000 }).imt).toBe(90_000);
  });

  it("armazéns e outros prédios urbanos: 6,5%", () => {
    expect(calc({ destino: "comercial" }).imt).toBe(13_000);
  });

  // Madeira: limites × 1,25 → 132 932,50 / 181 837,50 / 247 933,75
  // (181 837,50 − 132 932,50) × 2% + (200 000 − 181 837,50) × 5% = 978,10 + 908,13
  it("regiões autónomas com limites 25% mais altos", () => {
    expect(calc({ regiao: "madeira" }).imt).toBe(1886.23);
  });

  it("usa o VPT quando é maior do que o preço", () => {
    const r = calc({ preco: 150_000, vpt: 200_000 });
    expect(r.base).toBe(200_000);
    expect(r.imt).toBe(3542.04);
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

  // 400 000 − 330 539 = 69 461 → IMT 8% = 5 556,88 € · IS 0,8% = 555,69 €
  it("isenção parcial entre o 4.º e o 5.º escalão", () => {
    const r = calc({ ...jovem, preco: 400_000 });
    expect(r).toMatchObject({ imt: 5556.88, impostoSelo: 555.69, isencaoJovem: "parcial" });
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
