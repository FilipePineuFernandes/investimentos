import { describe, expect, it } from "vitest";
import { lerResposta, pedirCotacao } from "./cotacoes";

const quote = (preco: string, dia = "2026-11-03") => ({ "Global Quote": { "01. symbol": "EUNL.DEX", "05. price": preco, "07. latest trading day": dia } });
const resposta = (corpo: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(corpo) } as Response);

describe("cotações automáticas (Alpha Vantage)", () => {
  it("lê o preço e o dia da cotação", () => {
    expect(lerResposta(quote("112.3400"), "EUNL.DEX")).toEqual({ ok: { preco: 112.34, data: "2026-11-03", simbolo: "EUNL.DEX" } });
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
    expect(r).toEqual({ ok: { preco: 112.34, data: "2026-11-03", simbolo: "EUNL.DE" } });
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
