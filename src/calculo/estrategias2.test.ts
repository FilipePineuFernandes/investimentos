import { describe, expect, it } from "vitest";
import { CEDENCIA_VAZIA, novoImovel, RECONSTRUCAO_VAZIA, REVENDA_VAZIA, type EstrategiaCedencia, type EstrategiaReconstrucao, type Imovel } from "../dados/imoveis";
import { PERFIL_VAZIO, type Perfil } from "../dados/perfil";
import { calcularCedencia, type ResultadoCedencia } from "./cedencia";
import { analisarImovel } from "./imovel";
import { calcularReconstrucao, custoObra, type ResultadoReconstrucao } from "./reconstrucao";
import { calcularRevenda, type ResultadoRevenda } from "./revenda";
import { tirDatas } from "./util";

const hoje = new Date(2026, 9, 22);
const perfil: Perfil = { ...PERFIL_VAZIO, dataNascimento: "1980-01-01", rendimentoColetavelAnual: 20_000 };

// Habitação secundária de 200 000 €, 100 m², IMI 360 €/ano. Custos de compra 6 580,50 €.
const imovel = (d: Partial<Imovel> = {}): Imovel => ({ ...novoImovel("continente"), destino: "secundaria", preco: 200_000, vpt: 120_000, taxaImi: 0.3, area: 100, ...d });

function reconstrucao(i: Imovel, e: Partial<EstrategiaReconstrucao>) {
  const r = calcularReconstrucao(i, analisarImovel(i, perfil, hoje), { ...RECONSTRUCAO_VAZIA, ...e });
  if (!("totalObra" in r)) throw new Error(`faltam: ${r.faltam}`);
  return r as ResultadoReconstrucao;
}

describe("2: reconstrução", () => {
  const integral: Partial<EstrategiaReconstrucao> = { custoM2: 800, projetoLicenciamento: 5000, prazoObraMeses: 6, valorDepoisObra: 320_000 };

  it("obra integral: €/m² × área, imprevistos, detenção e margem", () => {
    const r = reconstrucao(imovel(), integral);
    expect(r.subtotal).toBe(80_000);
    expect(r.imprevistos).toBe(8000); // 10% por defeito
    expect(r.totalObra).toBe(88_000);
    expect(r.detencao).toBe(180); // 6 meses de IMI
    // 200 000 + 6 580,50 + 88 000 + 5 000 + 180
    expect(r.custoGlobal).toBe(299_760.5);
    expect(r.margem).toBe(20_239.5);
    expect(r.roi).toBe(6.75);
  });

  it("obra por zonas: cada trabalho na sua unidade, com coeficiente regional", () => {
    const r = reconstrucao(imovel(), {
      modo: "zonas",
      prazoObraMeses: 3,
      coeficienteRegional: 1.1,
      trabalhos: [
        { id: "1", tipo: "casa-banho", descricao: "", quantidade: 2, custoUnitario: 6000 },
        { id: "2", tipo: "pintura", descricao: "", quantidade: 300, custoUnitario: 12 },
        { id: "3", tipo: "pavimentos", descricao: "", quantidade: 80, custoUnitario: null },
      ],
    });
    expect(r.linhas.map((l) => [l.descricao, l.unidade, l.total])).toEqual([
      ["Casa de banho", "un.", 12_000],
      ["Pintura", "m² parede/teto", 3600],
    ]);
    expect(r.subtotal).toBe(15_600);
    expect(r.totalObra).toBe(18_876); // 15 600 × 1,1 × 1,10
    expect(r.notas.join()).toContain("1 trabalho não entra");
  });

  it("diz o que falta", () => {
    const i = imovel({ area: null });
    expect(calcularReconstrucao(i, analisarImovel(i, perfil, hoje), RECONSTRUCAO_VAZIA).faltam).toEqual(["área bruta do imóvel", "custo por m² da obra", "prazo da obra"]);
  });

  it("aviso de ARU", () => {
    expect(reconstrucao(imovel({ aru: "sim" }), integral).notas.join()).toContain("a confirmar com a câmara");
  });

  it("a obra entra na revenda como encargo de valorização", () => {
    const i = imovel({ reconstrucao: { ...RECONSTRUCAO_VAZIA, ...integral } });
    const a = analisarImovel(i, perfil, hoje);
    expect(custoObra(i, a)).toBe(93_000);
    const r = calcularRevenda(i, a, { ...REVENDA_VAZIA, precoVenda: 320_000, mesesAteVenda: 12, obras: 1000 }, 20_000, custoObra(i, a)) as ResultadoRevenda;
    expect(r.maisValia?.encargosValorizacao).toBe(94_000);
  });
});

describe("3: cedência de posição", () => {
  const e: EstrategiaCedencia = {
    ...CEDENCIA_VAZIA,
    pagamentos: [
      { id: "1", data: "2025-01-01", valor: 20_000, descricao: "Sinal" },
      { id: "2", data: "2025-07-01", valor: 20_000, descricao: "Reforço" },
    ],
    valorCedencia: 60_000,
    dataCedencia: "2026-01-01",
    dataEscritura: "2026-06-30",
    custos: 1000,
  };
  const calc = (x: Partial<EstrategiaCedencia>) => calcularCedencia({ ...e, ...x }, 20_000) as ResultadoCedencia;

  it("ganho, IRS e TIR, conferidos à mão", () => {
    const r = calc({});
    expect(r.totalPago).toBe(40_000);
    expect(r.ganho).toBe(19_000); // 60 000 − 40 000 − 1 000
    expect(r.tributavel).toBe(9500);
    expect(r.irs).toBe(2742.18); // IRS(29 500) − IRS(20 000) = 6 085,65 − 3 343,47
    expect(r.ganhoLiquido).toBe(16_257.82);
    expect(r.roi).toBe(40.64);
    expect(r.meses).toBe(12);
    expect(r.tir).toBeGreaterThan(40);
    expect(r.tir).toBeLessThan(120);
  });

  it("assinala verificações do promotor por fazer e cedência depois da escritura", () => {
    expect(calc({}).riscos).toHaveLength(4);
    expect(calc({ verificacoes: { licenca: true, garantiaSinal: true, historico: true, semAtrasos: false } }).riscos).toEqual(["obra sem atrasos"]);
    expect(calc({ dataEscritura: "2025-12-01" }).notas.join()).toContain("depois da escritura");
  });

  it("diz o que falta", () => {
    expect(calcularCedencia(CEDENCIA_VAZIA, null).faltam).toHaveLength(3);
  });
});

describe("TIR com datas", () => {
  it("investir 100 e receber 110 um ano depois dá 10%", () => {
    const r = tirDatas([
      { data: new Date(Date.UTC(2025, 0, 1)), valor: -100 },
      { data: new Date(Date.UTC(2026, 0, 1)), valor: 110 },
    ]);
    expect(r).toBeCloseTo(0.1, 6);
  });
});

describe("tabela pessoal de custos de obra", () => {
  it("guarda os custos usados e só muda a data dos que mudaram", async () => {
    const { juntarCustos, TABELA_VAZIA } = await import("../dados/custosObra");
    const obra: EstrategiaReconstrucao = {
      ...RECONSTRUCAO_VAZIA,
      modo: "zonas",
      trabalhos: [
        { id: "1", tipo: "casa-banho", descricao: "", quantidade: 1, custoUnitario: 6000 },
        { id: "2", tipo: "outro", descricao: "Muro", quantidade: 1, custoUnitario: 900 },
      ],
    };
    const t1 = juntarCustos(TABELA_VAZIA, obra, "2026-10-01");
    expect(t1.trabalhos).toEqual({ "casa-banho": { valor: 6000, revistoEm: "2026-10-01" } });
    expect(juntarCustos(t1, obra, "2026-10-22").trabalhos["casa-banho"]?.revistoEm).toBe("2026-10-01");
    const t3 = juntarCustos(t1, { ...RECONSTRUCAO_VAZIA, acabamento: "alto", custoM2: 1100 }, "2026-10-22");
    expect(t3.integral.alto).toEqual({ valor: 1100, revistoEm: "2026-10-22" });
    expect(t3.trabalhos["casa-banho"]?.valor).toBe(6000);
  });
});
