import { describe, expect, it } from "vitest";
import { fimPeriodo, freguesias, municipios, nomePeriodo, type DadosIne } from "../dados/ine";
import { cenarios, projetar, valorRenda, valorVenda } from "./mercado";

// 21 trimestres: de 2021-T2 a 2026-T2. O município cresce 10% ao ano até 2024 e 5% depois;
// a freguesia só tem o último valor.
const periodos: string[] = [];
for (let ano = 2021; ano <= 2026; ano++) for (let t = 1; t <= 4; t++) if (!(ano === 2021 && t < 2) && !(ano === 2026 && t > 2)) periodos.push(`${ano}-T${t}`);
const anual = [1000, 1100, 1210, 1331, 1397.55, 1467.43]; // 2021 … 2026 (taxas 10, 10, 10, 5, 5)
const historico = periodos.map((p) => anual[Number(p.slice(0, 4)) - 2021]);

const d: DadosIne = {
  geradoEm: "2026-10-24T00:00:00Z",
  fonte: "INE",
  vendas: {
    codigo: "0012234",
    titulo: "",
    atualizadoEm: "2026-10-23",
    periodos,
    valores: {
      "1A01106": { h: historico, n: 1800, e: 1400 },
      "1A0110656": { h: [...historico.slice(0, -1).map(() => null), 2000], n: null, e: 1950 },
      "1A01107": { h: [null, null], n: null, e: null },
    },
  },
  rendas: {
    codigo: "0012598",
    titulo: "",
    atualizadoEm: "2025-06-27",
    periodos: ["2024-S1", "2024-S2"],
    valores: { "1A01106": [10, 11], "1A0110656": [12, null] },
  },
  nomes: { "1A01106": "Lisboa", "1A0110656": "Arroios", "1A0110657": "Avenidas Novas", "1A01107": "Loures", "11A1312": "Porto" },
};

const HOJE = "2026-10-24";

describe("lista de zonas", () => {
  it("municípios por ordem alfabética e freguesias de cada município", () => {
    expect(municipios(d).map((m) => m.nome)).toEqual(["Lisboa", "Loures", "Porto"]);
    expect(freguesias(d, "1A01106").map((f) => f.nome)).toEqual(["Arroios", "Avenidas Novas"]);
  });

  it("nomes e fim dos períodos", () => {
    expect(nomePeriodo("2026-T2")).toBe("2.º trim. 2026");
    expect(nomePeriodo("2024-S2")).toBe("2.º sem. 2024");
    expect(fimPeriodo("2026-T2")).toBe("2026-06-30");
    expect(fimPeriodo("2024-S2")).toBe("2024-12-31");
  });
});

describe("valor de venda (INE)", () => {
  it("freguesia com dados: existentes, × área", () => {
    expect(valorVenda(d, { municipio: "1A01106", freguesia: "1A0110656" }, 80, "bom", HOJE)).toMatchObject({
      m2: 1950,
      total: 156_000,
      nivel: "freguesia",
      nome: "Arroios",
      periodo: "2026-T2",
      categoria: "existentes",
      desatualizado: false,
    });
  });

  it("imóvel novo sem dados de novos na freguesia: usa o total da freguesia", () => {
    expect(valorVenda(d, { municipio: "1A01106", freguesia: "1A0110656" }, null, "novo", HOJE)).toMatchObject({ m2: 2000, categoria: "total", total: null });
  });

  it("freguesia sem dados: passa para o município", () => {
    expect(valorVenda(d, { municipio: "1A01106", freguesia: "1A0110657" }, 100, "novo", HOJE)).toMatchObject({ m2: 1800, nivel: "municipio", nome: "Lisboa" });
  });

  it("sem dados nenhuns: Não encontrado (null)", () => {
    expect(valorVenda(d, { municipio: "1A01107", freguesia: null }, 100, "bom", HOJE)).toBeNull();
    expect(valorVenda(d, { municipio: null, freguesia: null }, 100, "bom", HOJE)).toBeNull();
  });
});

describe("renda (INE)", () => {
  it("último período com valor, e aviso de desatualizado", () => {
    expect(valorRenda(d, { municipio: "1A01106", freguesia: "1A0110656" }, 80, HOJE)).toMatchObject({ m2: 12, total: 960, periodo: "2024-S1", nivel: "freguesia", desatualizado: true });
    expect(valorRenda(d, { municipio: "1A01106", freguesia: null }, 80, HOJE)).toMatchObject({ m2: 11, periodo: "2024-S2" });
  });
});

describe("cenários de valorização (5.5)", () => {
  it("pessimista, base e otimista a partir das variações anuais dos últimos 5 anos", () => {
    const c = cenarios(d, { municipio: "1A01106", freguesia: null })!;
    expect(c.variacoes.map((v) => v.taxa)).toEqual([10, 10, 10, 5, 5]);
    expect(c.pessimista).toBe(0); // todas positivas → 0%
    expect(c.base).toBe(8); // (10 + 10 + 10 + 5 + 5) ÷ 5
    expect(c.otimista).toBeCloseTo(6.67, 2); // (10 + 5 + 5) ÷ 3
  });

  it("a freguesia sem 5 anos de histórico usa o município", () => {
    expect(cenarios(d, { municipio: "1A01106", freguesia: "1A0110656" })?.nivel).toBe("municipio");
  });

  it("com um ano negativo, o pessimista repete-o", () => {
    const h = [...historico];
    h[h.length - 1] = 1397.55 * 0.95; // último ano −5%
    const c = cenarios({ ...d, vendas: { ...d.vendas, valores: { X: { h, n: null, e: null } } } }, { municipio: "X", freguesia: null })!;
    expect(c.pessimista).toBe(-5);
  });

  it("sem histórico: null", () => {
    expect(cenarios(d, { municipio: "1A01107", freguesia: null })).toBeNull();
  });

  it("projeção composta", () => {
    expect(projetar(200_000, 8, 2)).toBe(233_280);
  });
});
