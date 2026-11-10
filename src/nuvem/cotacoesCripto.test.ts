import { describe, expect, it } from "vitest";
import { pedirCotacoesCripto, procurarId } from "./cotacoesCripto";

const resposta = (corpo: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(corpo) } as Response);

describe("cotações das criptomoedas (CoinGecko)", () => {
  it("as moedas conhecidas não gastam pedidos de procura e todas vêm num só pedido", async () => {
    const pedidos: string[] = [];
    const r = await pedirCotacoesCripto(["BTC", "ETH"], {}, (url) => {
      pedidos.push(String(url));
      return resposta({ bitcoin: { eur: 66294.123, last_updated_at: 1794311599 }, ethereum: { eur: 1866.67 } });
    });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toContain("ids=bitcoin%2Cethereum");
    expect(r.erro).toBeNull();
    expect(r.cotacoes.map((c) => [c.moeda, c.preco])).toEqual([
      ["BTC", 66294.12],
      ["ETH", 1866.67],
    ]);
  });

  it("procura as moedas desconhecidas pelo código e escolhe a de maior capitalização", async () => {
    const id = await procurarId("ABC", () =>
      resposta({ coins: [{ id: "abc-pequena", symbol: "ABC", market_cap_rank: 900 }, { id: "abc-grande", symbol: "abc", market_cap_rank: 40 }, { id: "outra", symbol: "ABCD", market_cap_rank: 1 }] }),
    );
    expect(id).toBe("abc-grande");
  });

  it("guarda mais casas nas moedas muito baratas e diz quais o serviço não conhece", async () => {
    const r = await pedirCotacoesCripto(["SHIB", "XYZ"], { XYZ: "xyz-inexistente" }, () => resposta({ "shiba-inu": { eur: 0.0000123456789 } }));
    expect(r.cotacoes[0].preco).toBe(0.0000123457);
    expect(r.semDados).toEqual(["XYZ"]);
  });

  it("distingue a falta de ligação do pedido para esperar", async () => {
    expect((await pedirCotacoesCripto(["BTC"], {}, () => Promise.reject(new Error("x")))).erro).toBe("rede");
    expect((await pedirCotacoesCripto(["BTC"], {}, () => resposta({}, 429))).erro).toBe("limite");
  });
});
