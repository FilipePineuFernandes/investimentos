import { describe, expect, it } from "vitest";
import { criarLivro, lerLivro, type Celula } from "./excel";
import { COLUNAS_CRIPTO, criarModeloCripto, interpretarFicheiroCripto, lerMoeda } from "./importarCripto";
import type { MovimentoCripto } from "./movimentosCripto";

let n = 0;
const id = () => `id-${++n}`;
const livro = (linhas: Celula[][]) => criarLivro([{ nome: "Movimentos", cabecalho: true, colunas: COLUNAS_CRIPTO.map((c) => ({ largura: c.largura })), linhas: [COLUNAS_CRIPTO.map((c) => c.titulo), ...linhas] }]);

describe("importação de cripto do Excel", () => {
  it("o modelo tem a folha só com os títulos e as instruções", () => {
    const l = lerLivro(criarModeloCripto());
    expect(l.folhas.map((f) => f.nome)).toEqual(["Movimentos", "Instruções"]);
    expect(l.folhas[0].linhas).toEqual([COLUNAS_CRIPTO.map((c) => c.titulo)]);
  });

  it("lê compras e vendas com muitas casas decimais e códigos com «-EUR»", () => {
    const r = interpretarFicheiroCripto(
      livro([
        [{ data: "2024-03-15" }, "Compra", "btc", 0.00125, 61500, 1.5],
        ["02/06/2025", "venda", "BTC-EUR", "0,0005", "95200", null],
      ]),
      [],
      id,
    );
    expect(r.erro).toBeNull();
    expect(r.linhas.map((l) => l.movimento)).toEqual([
      { id: expect.any(String), moeda: "BTC", tipo: "compra", data: "2024-03-15", quantidade: 0.00125, preco: 61500, comissao: 1.5 },
      { id: expect.any(String), moeda: "BTC", tipo: "venda", data: "2025-06-02", quantidade: 0.0005, preco: 95200, comissao: 0 },
    ]);
  });

  it("explica os erros e ignora o que já estava registado", () => {
    const existente: MovimentoCripto = { id: "a", moeda: "ETH", tipo: "compra", data: "2024-05-02", quantidade: 0.4, preco: 2800, comissao: 1 };
    const r = interpretarFicheiroCripto(
      livro([
        [{ data: "2024-05-02" }, "Compra", "ETH", 0.4, 2800, 1],
        ["31/02/2024", "Troca", "B T C !", null, 10, null],
      ]),
      [existente],
      id,
    );
    expect(r.linhas[0].repetido).toBe(true);
    expect(r.linhas[1].erros.join(" ")).toMatch(/data não é válida.*Compra ou Venda.*não parece um código.*Falta: quantidade/);
  });

  it("limpa o código da moeda", () => {
    expect(lerMoeda(" sol/eur ")).toBe("SOL");
    expect(lerMoeda("ETH")).toBe("ETH");
  });
});
