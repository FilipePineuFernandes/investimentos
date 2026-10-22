import { describe, expect, it } from "vitest";
import { calcularCredito, choqueTaxa, impostoSeloCapital, plano, prazoMaximo, prestacao, validarLimites, type DadosCredito, type DadosValidacao } from "./credito";

describe("prestação (método francês)", () => {
  it("valor de referência: 100 000 € a 3% em 30 anos = 421,60 €", () => {
    expect(prestacao(100_000, 3, 360)).toBeCloseTo(421.6, 2);
  });

  it("sem juros, divide o capital pelos meses", () => {
    expect(prestacao(120_000, 0, 120)).toBe(1000);
  });

  it("o plano paga a dívida toda", () => {
    const linhas = plano(100_000, 3, 360);
    expect(linhas).toHaveLength(360);
    expect(linhas.at(-1)!.divida).toBe(0);
    expect(linhas.reduce((s, l) => s + l.capital, 0)).toBeCloseTo(100_000, 6);
    expect(linhas[0].juros).toBeCloseTo(250, 6); // 100 000 × 3% ÷ 12
    expect(linhas[0].impostoSeloJuros).toBeCloseTo(10, 6); // 4% dos juros
  });
});

describe("Imposto do Selo sobre o crédito", () => {
  it("0,6% a 5 anos ou mais, 0,5% abaixo", () => {
    expect(impostoSeloCapital(100_000, 30)).toBe(600);
    expect(impostoSeloCapital(100_000, 5)).toBe(600);
    expect(impostoSeloCapital(100_000, 4)).toBe(500);
  });
});

describe("calcularCredito", () => {
  const dados: DadosCredito = { montante: 100_000, prazoAnos: 30, taxaAnual: 3, tipoTaxa: "variavel", seguroMensal: 0, comissaoMensal: 0, custosIniciais: 0 };

  it("MTIC soma capital, juros e encargos", () => {
    const r = calcularCredito(dados);
    expect(r.totalJuros).toBeCloseTo(421.6 * 360 - 100_000, -1);
    expect(r.mtic).toBeCloseTo(100_000 + r.totalJuros + r.totalImpostoSeloJuros + 600, 1);
  });

  it("a TAEG é maior do que a TAN quando há encargos", () => {
    const sem = calcularCredito(dados);
    const com = calcularCredito({ ...dados, seguroMensal: 30, comissaoMensal: 3, custosIniciais: 500 });
    expect(sem.taeg).toBeGreaterThan(3);
    expect(com.taeg).toBeGreaterThan(sem.taeg);
    expect(com.encargoMensalInicial).toBeCloseTo(421.6 + 10 + 33, 1);
  });

  it("teste de stress com +1, +2 e +3 pontos, exceto na taxa fixa", () => {
    const r = calcularCredito(dados);
    expect(r.stress.map((s) => s.taxa)).toEqual([4, 5, 6]);
    expect(r.stress[0].prestacao).toBeCloseTo(prestacao(100_000, 4, 360), 2);
    expect(r.stress.every((s) => s.diferenca > 0)).toBe(true);
    expect(calcularCredito({ ...dados, tipoTaxa: "fixa" }).stress).toEqual([]);
  });
});

describe("limites do Banco de Portugal", () => {
  const dados: DadosValidacao = {
    destino: "hpp",
    montante: 180_000,
    preco: 200_000,
    avaliacao: null,
    prazoAnos: 30,
    idade: 40,
    taxaAnual: 3,
    tipoTaxa: "variavel",
    periodoFixoAnos: null,
    rendimentoMensal: 3000,
    outrasPrestacoes: 0,
  };
  const validar = (d: Partial<DadosValidacao>) => Object.fromEntries(validarLimites({ ...dados, ...d }).map((v) => [v.id, v]));

  it("LTV: 90% na HPP, 80% nos outros destinos, sobre o menor entre preço e avaliação", () => {
    expect(validar({}).ltv).toMatchObject({ valor: 90, cumpre: true });
    expect(validar({ destino: "secundaria" }).ltv).toMatchObject({ limite: 80, cumpre: false });
    expect(validar({ avaliacao: 190_000 }).ltv.cumpre).toBe(false);
  });

  it("prazo máximo conforme a idade", () => {
    expect([prazoMaximo(30), prazoMaximo(31), prazoMaximo(35), prazoMaximo(36), prazoMaximo(null)]).toEqual([40, 37, 37, 35, null]);
    expect(validar({ idade: 40, prazoAnos: 36 }).prazo.cumpre).toBe(false);
    expect(validar({ idade: null }).prazo.cumpre).toBeNull();
  });

  it("choque de taxa conforme o tipo", () => {
    expect(choqueTaxa("variavel", null)).toBe(3);
    expect(choqueTaxa("mista", 5)).toBe(3);
    expect(choqueTaxa("mista", 7)).toBe(1.5);
    expect(choqueTaxa("mista", 10)).toBe(0);
    expect(choqueTaxa("fixa", null)).toBe(0);
  });

  it("DSTI com o choque de taxa e as outras prestações", () => {
    // 180 000 € a 3% + 3 pontos em 30 anos ≈ 1 079,19 € → 35,97% de 3 000 €
    const v = validar({}).dsti;
    expect(v.valor).toBeCloseTo((prestacao(180_000, 6, 360) / 3000) * 100, 2);
    expect(v.cumpre).toBe(true);
    expect(validar({ outrasPrestacoes: 500 }).dsti.cumpre).toBe(false);
    expect(validar({ rendimentoMensal: null }).dsti.cumpre).toBeNull();
  });

  it("crédito comercial não tem estas validações", () => {
    expect(validarLimites({ ...dados, destino: "comercial" })).toEqual([]);
  });
});
