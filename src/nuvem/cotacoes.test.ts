import { describe, expect, it } from "vitest";
import { atualizarEmSerie, lerResposta, pedirCotacao } from "./cotacoes";

const quote = (preco: string, dia = "2026-11-03") => ({ "Global Quote": { "01. symbol": "EUNL.DEX", "05. price": preco, "07. latest trading day": dia } });
const resposta = (corpo: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(corpo) } as Response);

describe("cotações automáticas (Alpha Vantage)", () => {
  it("lê o preço e o dia da cotação", () => {
    expect(lerResposta(quote("112.3400"), "EUNL.DEX")).toEqual({ ok: { preco: 112.34, data: "2026-11-03", simbolo: "EUNL.DEX", historico: [] } });
  });

  it("lê a série diária: a cotação é o último fecho e os anteriores ficam no histórico", () => {
    const r = lerResposta(
      { "Time Series (Daily)": { "2026-11-11": { "4. close": "112.3400" }, "2026-11-10": { "4. close": "110.1234" }, "2026-11-07": { "4. close": "108.5" } } },
      "EUNL.DEX",
    );
    expect(r).toEqual({
      ok: {
        preco: 112.34,
        data: "2026-11-11",
        simbolo: "EUNL.DEX",
        historico: [
          { data: "2026-11-07", preco: 108.5 },
          { data: "2026-11-10", preco: 110.1234 },
          { data: "2026-11-11", preco: 112.34 },
        ],
      },
    });
  });

  it("distingue o limite gratuito, a chave inválida e a falta de dados", () => {
    expect(lerResposta({ Information: "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day." }, "X")).toEqual({ erro: "limite" });
    expect(lerResposta({ Information: "The **demo** API key is for demo purposes only." }, "X")).toEqual({ erro: "chave" });
    expect(lerResposta({ "Global Quote": {} }, "X")).toEqual({ erro: "sem-dados" });
    expect(lerResposta({ "Error Message": "Invalid API call." }, "X")).toEqual({ erro: "sem-dados" });
  });

  it("tenta .DEX e, sem dados, .DE; guarda o símbolo que resultou", async () => {
    const pedidos: string[] = [];
    const r = await pedirCotacao("eunl", "CHAVE", undefined, (url) => {
      pedidos.push(String(url));
      return String(url).includes("symbol=EUNL.DE&") ? resposta(quote("112.34")) : resposta({ "Global Quote": {} });
    });
    expect(r).toEqual({ ok: { preco: 112.34, data: "2026-11-03", simbolo: "EUNL.DE", historico: [] } });
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0]).toContain("symbol=EUNL.DEX&apikey=CHAVE");
  });

  it("com o símbolo já conhecido, faz um único pedido", async () => {
    let n = 0;
    await pedirCotacao("EUNL", "CHAVE", "EUNL.DEX", () => (n++, resposta(quote("112.34"))));
    expect(n).toBe(1);
  });

  it("para ao primeiro limite e devolve erro de ligação se a rede falhar", async () => {
    let n = 0;
    const limite = await pedirCotacao("EUNL", "CHAVE", undefined, () => (n++, resposta({ Information: "rate limit of 25 requests per day" })));
    expect(limite).toEqual({ erro: "limite" });
    expect(n).toBe(1);
    expect(await pedirCotacao("EUNL", "CHAVE", undefined, () => Promise.reject(new Error("offline")))).toEqual({ erro: "rede" });
  });
});

describe("atualização de vários ETF", () => {
  const etf = [
    { isin: "A", ticker: "EUNL", simbolo: "EUNL.DEX" },
    { isin: "B", ticker: "SXR8", simbolo: "SXR8.DEX" },
    { isin: "C", ticker: "VUAA" },
  ];

  it("espaça os pedidos (13 s entre cada um) e guarda cada cotação", async () => {
    const esperas: number[] = [];
    const guardadas: string[] = [];
    const r = await atualizarEmSerie(etf, "CHAVE", {
      pedir: (url) => (String(url).includes("VUAA.DEX") ? resposta({ "Global Quote": {} }) : resposta(quote("100"))),
      esperar: async (ms) => void esperas.push(ms),
      onCotacao: async (isin) => void guardadas.push(isin),
    });
    // 4 pedidos (VUAA experimenta .DEX e .DE): 3 esperas entre eles.
    expect(esperas).toEqual([13_000, 13_000, 13_000]);
    expect(guardadas).toEqual(["A", "B", "C"]);
    expect(r).toEqual({ atualizadas: 3, semDados: [], erro: null, porFazer: 0 });
  });

  it("se o serviço pedir para abrandar, espera um minuto e tenta outra vez", async () => {
    let n = 0;
    const esperas: number[] = [];
    const r = await atualizarEmSerie([etf[0]], "CHAVE", {
      pedir: () => (n++ === 0 ? resposta({ Information: "Please consider spreading out your free API requests more sparingly (1 request per second)." }) : resposta(quote("100"))),
      esperar: async (ms) => void esperas.push(ms),
      onCotacao: async () => {},
    });
    expect(esperas).toEqual([60_000]);
    expect(r.atualizadas).toBe(1);
  });

  it("para no limite do dia e diz quantos ficaram por atualizar", async () => {
    let n = 0;
    const r = await atualizarEmSerie(etf, "CHAVE", {
      pedir: () => (n++ === 0 ? resposta(quote("100")) : resposta({ Information: "Our standard API rate limit is 25 requests per day." })),
      esperar: async () => {},
      onCotacao: async () => {},
    });
    expect(r).toEqual({ atualizadas: 1, semDados: [], erro: "limite", porFazer: 2 });
  });
});
