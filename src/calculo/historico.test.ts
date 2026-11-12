import { describe, expect, it } from "vitest";
import { CARTEIRA_VAZIA, novoImovel, type Avaliacao, type DadosCarteira, type Imovel } from "../dados/imoveis";
import type { Movimento } from "../dados/movimentosEtf";
import { PERFIL_VAZIO } from "../dados/perfil";
import { analisarImovel } from "./imovel";
import { acontecimentos, historicoCarteira, pontoEm, serieEtf, serieImovel, somarSeries, valorDaMetrica } from "./historico";
import { grupoImobiliario } from "./patrimonio";

const HOJE = "2026-10-24";
const aval = (data: string, valor: number): Avaliacao => ({ id: data, data, valor, renda: null, metodo: "manual", fonte: "" });

// Habitação secundária de 200 000 €: custos de compra 6 580,50 € (ver carteira.test.ts), custo investido 206 580,50 €.
const imovel = (carteira: Partial<DadosCarteira>, d: Partial<Imovel> = {}): Imovel => ({
  ...novoImovel("continente"),
  nome: "T2 Porto",
  destino: "secundaria",
  estado: "comprado",
  preco: 200_000,
  vpt: 120_000,
  carteira: { ...CARTEIRA_VAZIA, ...carteira },
  ...d,
});
const comAnalise = (i: Imovel) => ({ i, a: analisarImovel(i, PERFIL_VAZIO) });

let n = 0;
const mov = (d: Partial<Movimento>): Movimento => ({
  id: String(n++),
  isin: "IE00B4L5Y983",
  tipo: "compra",
  data: "2025-01-10",
  quantidade: 0,
  preco: 0,
  comissao: 0,
  valor: 0,
  imposto: 0,
  corretora: "",
  origem: null,
  ...d,
});

describe("histórico: séries dos imóveis", () => {
  it("começa na compra, muda em cada avaliação e acaba hoje; o último ponto bate com a carteira global", () => {
    const i = imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2025-09-01", 210_000), aval("2026-06-01", 230_000)] });
    const { a } = comAnalise(i);
    const s = serieImovel(i, a, HOJE)!;
    expect(s.pontos.map((p) => [p.data, p.valor])).toEqual([
      ["2025-01-01", 200_000],
      ["2025-09-01", 210_000],
      ["2026-06-01", 230_000],
      ["2026-10-24", 230_000],
    ]);
    expect(s.pontos.every((p) => p.custo === 206_580.5)).toBe(true);
    expect(s.pontos[0].lucro).toBe(-6_580.5);
    const g = grupoImobiliario([{ i, a }], HOJE);
    expect(pontoEm(s, HOJE)!.lucro).toBe(g.lucro);
  });

  it("as rendas entram no lucro a cada dia 8, e hoje o lucro bate com a carteira global", () => {
    const i = imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2026-06-01", 230_000)], arrendadoDesde: "2025-04-01", rendaContrato: 800 }, { estado: "arrendado" });
    const { a } = comAnalise(i);
    const s = serieImovel(i, a, HOJE)!;
    // 8 de abril de 2025: 1.ª renda; 8 de maio: 2.ª
    expect(pontoEm(s, "2025-04-07")!.lucro).toBe(-6_580.5);
    expect(pontoEm(s, "2025-04-08")!.lucro).toBe(-5_780.5);
    expect(pontoEm(s, "2025-05-08")!.lucro).toBe(-4_980.5);
    expect(pontoEm(s, HOJE)!.lucro).toBe(grupoImobiliario([{ i, a }], HOJE).lucro); // 38 619,50
  });

  it("com o total de rendas indicado pelo utilizador, reparte-o pela estimativa e termina nesse valor", () => {
    const i = imovel({ dataCompra: "2025-01-01", arrendadoDesde: "2025-04-01", rendaContrato: 800, rendasRecebidas: 9_500 }, { estado: "arrendado" });
    const { a } = comAnalise(i);
    const s = serieImovel(i, a, HOJE)!;
    expect(pontoEm(s, HOJE)!.lucro).toBe(9_500 - 6_580.5);
    expect(pontoEm(s, "2025-03-31")!.lucro).toBe(-6_580.5);
  });

  it("não há série sem data de compra, nem para imóveis em análise ou vendidos", () => {
    for (const d of [{ estado: "analise" as const }, { estado: "vendido" as const }]) {
      const i = imovel({ dataCompra: "2025-01-01" }, d);
      expect(serieImovel(i, comAnalise(i).a, HOJE)).toBeNull();
    }
    const sem = imovel({});
    expect(serieImovel(sem, comAnalise(sem).a, HOJE)).toBeNull();
  });
});

describe("histórico: séries dos ETF", () => {
  const movimentos = [
    mov({ data: "2025-01-10", quantidade: 10, preco: 100, comissao: 2 }),
    mov({ data: "2025-06-10", quantidade: 5, preco: 110, comissao: 1 }),
  ];

  it("sem histórico guardado, usa o preço das compras como cotação desses dias; hoje usa a cotação", () => {
    const s = serieEtf("IE00B4L5Y983", "MSCI World", movimentos, 130, HOJE)!;
    expect(s.pontos.map((p) => [p.data, p.valor, p.custo, p.lucro])).toEqual([
      ["2025-01-10", 1000, 1002, -2],
      ["2025-06-10", 1650, 1553, 97],
      ["2026-10-24", 1950, 1553, 397],
    ]);
  });

  it("sem cotação, hoje o valor é o que pagou e o lucro fica a zero", () => {
    const s = serieEtf("IE00B4L5Y983", "MSCI World", movimentos, null, HOJE)!;
    expect(pontoEm(s, HOJE)).toMatchObject({ valor: 1553, lucro: 0 });
  });

  it("sem unidades já não há série", () => {
    const vendido = [...movimentos, mov({ tipo: "venda", data: "2026-01-10", quantidade: 15, preco: 120 })];
    expect(serieEtf("IE00B4L5Y983", "MSCI World", vendido, 130, HOJE)).toBeNull();
  });
});

describe("histórico: somas e métricas", () => {
  const i = imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2026-06-01", 230_000)] });
  const movimentos = [mov({ data: "2025-06-10", quantidade: 10, preco: 100 })];

  it("a soma só conta cada ativo a partir da sua primeira data", () => {
    const h = historicoCarteira([comAnalise(i)], movimentos, { IE00B4L5Y983: 130 }, { IE00B4L5Y983: "MSCI World" }, HOJE);
    expect(h.somas.map((s) => s.id)).toEqual(["total", "imobiliario", "etf"]);
    const total = h.somas[0];
    expect(pontoEm(total, "2025-03-01")).toMatchObject({ valor: 200_000, custo: 206_580.5 }); // ainda sem ETF
    expect(pontoEm(total, "2025-06-10")).toMatchObject({ valor: 201_000, custo: 207_580.5 });
    expect(pontoEm(total, HOJE)).toMatchObject({ valor: 231_300, custo: 207_580.5, lucro: 23_719.5 }); // 23 419,50 + 300
    expect(h.ativos.map((s) => s.nome)).toEqual(["T2 Porto", "MSCI World"]);
  });

  it("os imóveis sem data de compra ficam fora e são avisados", () => {
    const sem = imovel({}, { nome: "T1 sem data" });
    const h = historicoCarteira([comAnalise(sem)], [], {}, {}, HOJE);
    expect(h.fora).toEqual(["T1 sem data"]);
    expect(h.somas).toEqual([]);
  });

  it("a percentagem é o lucro sobre o que pagou", () => {
    const s = somarSeries("t", "Total", "total", [serieImovel(i, comAnalise(i).a, HOJE)!])!;
    const p = pontoEm(s, HOJE)!;
    expect(valorDaMetrica(p, "lucroPct")).toBe(11.34); // 23 419,50 ÷ 206 580,50
    expect(valorDaMetrica(p, "custo")).toBe(206_580.5);
    expect(valorDaMetrica({ data: HOJE, valor: 0, custo: 0, lucro: 0 }, "lucroPct")).toBeNull();
  });
});

describe("histórico: acontecimentos", () => {
  it("junta compras, avaliações, arrendamento, vendas e movimentos de ETF, do mais recente para o mais antigo", () => {
    const i = imovel({ dataCompra: "2025-01-01", avaliacoes: [aval("2026-06-01", 230_000)], arrendadoDesde: "2025-04-01", rendaContrato: 800 }, { estado: "arrendado" });
    const emAnalise = imovel({ dataCompra: "2020-01-01" }, { estado: "analise" });
    const lista = acontecimentos(
      [i, emAnalise],
      [mov({ data: "2025-06-10", quantidade: 10, preco: 100 }), mov({ tipo: "dividendo", data: "2026-03-01", valor: 12 })],
      { IE00B4L5Y983: "MSCI World" },
    );
    expect(lista.map((a) => [a.data, a.area, a.descricao, a.valor])).toEqual([
      ["2026-06-01", "Imóvel", "Avaliação", 230_000],
      ["2026-03-01", "ETF", "Dividendo", 12],
      ["2025-06-10", "ETF", "Compra de 10 unidades", 1000],
      ["2025-04-01", "Imóvel", "Início do arrendamento", 800],
      ["2025-01-01", "Imóvel", "Compra (escritura)", 200_000],
    ]);
  });
});

describe("ETF com histórico de cotações", () => {
  it("o valor e o lucro de cada dia usam a cotação desse dia", async () => {
    const { serieEtf } = await import("./historico");
    const movs = [{ id: "1", isin: "X", tipo: "compra" as const, data: "2026-01-10", quantidade: 10, preco: 100, comissao: 0, valor: 0, imposto: 0, corretora: "", origem: null }];
    const s = serieEtf("X", "X", movs, 130, "2026-04-01", [
      { data: "2025-12-01", preco: 90 },
      { data: "2026-02-01", preco: 110 },
      { data: "2026-03-01", preco: 95 },
    ])!;
    expect(s.pontos.map((p) => [p.data, p.valor, p.lucro])).toEqual([
      ["2026-01-10", 1000, 0],
      ["2026-02-01", 1100, 100],
      ["2026-03-01", 950, -50],
      ["2026-04-01", 1300, 300],
    ]);
  });
});

describe("histórico: dias, meses, filtro e período", () => {
  const a = (data: string, tipo: "compra" | "venda" | "dividendo" | "avaliacao", valor: number, area: "Imóvel" | "ETF" | "Cripto" = "ETF") => ({
    data, area, tipo, ativo: "X", codigo: "X", descricao: "", quantidade: null, valor,
  });
  it("junta os ETF, as cripto e o código de cada um", async () => {
    const { acontecimentos } = await import("./historico");
    const lista = acontecimentos(
      [],
      [mov({ data: "2026-02-01", quantidade: 2, preco: 50 })],
      { IE00B4L5Y983: "MSCI World" },
      { IE00B4L5Y983: "EUNL" },
      [{ id: "c", moeda: "BTC", tipo: "compra", data: "2026-03-01", quantidade: 0.5, preco: 100, comissao: 0 }],
    );
    expect(lista.map((x) => [x.data, x.area, x.codigo, x.descricao, x.quantidade, x.valor])).toEqual([
      ["2026-03-01", "Cripto", "BTC", "Compra de 0,5 BTC", 0.5, 50],
      ["2026-02-01", "ETF", "EUNL", "Compra de 2 unidades", 2, 100],
    ]);
  });
  it("agrupa por dia com o investido e o recebido", async () => {
    const { agruparPorDia } = await import("./historico");
    const dias = agruparPorDia([a("2026-11-12", "compra", 100), a("2026-11-12", "compra", 50), a("2026-10-01", "dividendo", 7)]);
    expect(dias.map((d) => [d.data, d.quantos, d.investido, d.recebido])).toEqual([
      ["2026-11-12", 2, 150, 0],
      ["2026-10-01", 1, 0, 7],
    ]);
  });
  it("resume os últimos 12 meses, com os meses vazios", async () => {
    const { resumoPorMes } = await import("./historico");
    const meses = resumoPorMes([a("2026-11-12", "compra", 100), a("2026-01-05", "compra", 30), a("2025-11-30", "compra", 999)], "2026-11-12");
    expect(meses).toHaveLength(12);
    expect(meses[0].mes).toBe("2025-12");
    expect(meses[11]).toMatchObject({ mes: "2026-11", investido: 100, quantos: 1 });
    expect(meses[1]).toMatchObject({ mes: "2026-01", investido: 30 });
  });
  it("filtra por área e tipo e escolhe o período", async () => {
    const { filtrarHistorico, entreDatas } = await import("./historico");
    const l = [a("2026-05-01", "compra", 1), a("2026-04-01", "avaliacao", 2, "Imóvel"), a("2026-03-01", "venda", 3)];
    expect(filtrarHistorico(l, { areas: ["ETF"], tipos: ["compra", "venda"] }).map((x) => x.valor)).toEqual([1, 3]);
    expect(entreDatas(l, "2026-03-15", "2026-05-01").map((x) => x.valor)).toEqual([1, 2]);
  });
});
