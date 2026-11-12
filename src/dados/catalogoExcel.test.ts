import { describe, expect, it } from "vitest";
import { criarLivro, lerLivro } from "./excel";
import { livroCatalogo, lerLivroCatalogo, COLUNAS_CATALOGO, FOLHA_CATALOGO } from "./catalogoExcel";
import { novoETF, type ETF } from "./etf";

const etf = (o: Partial<ETF>): ETF => ({ ...novoETF("2026-01-01"), ticker: "EXMW", isin: "IE00B4L5Y983", nome: "Fundo Exemplo Mundial", ter: 0.2, ...o });

describe("catálogo de ETF em Excel", () => {
  it("descarrega uma linha por ETF, pela ordem do código", () => {
    const livro = lerLivro(livroCatalogo([etf({ ticker: "ZZZ1", isin: "IE00B5BMR087", nome: "Z" }), etf({ regiao: "eua", setor: "tecnologia" })]));
    const f = livro.folhas[0];
    expect(f.nome).toBe(FOLHA_CATALOGO);
    expect(f.linhas[0]).toEqual(COLUNAS_CATALOGO.map((c) => c.titulo));
    expect(f.linhas[1].slice(0, 3)).toEqual(["EXMW", "IE00B4L5Y983", "Fundo Exemplo Mundial"]);
    expect(f.linhas[1][5]).toBe("EUA");
    expect(f.linhas[1][6]).toBe("Tecnologia");
    expect(f.linhas[2][0]).toBe("ZZZ1");
  });

  it("o mesmo ficheiro carregado de volta não muda nada", () => {
    const cat = [etf({ dimensao: 1500, dataLancamento: "2015-03-02", numeroPosicoes: 1400 })];
    const r = lerLivroCatalogo(livroCatalogo(cat), cat, "2026-11-12");
    expect(r.erro).toBeNull();
    expect(r.linhas.map((l) => l.estado)).toEqual(["igual"]);
  });

  it("acrescenta os novos, atualiza os que mudam e recusa as linhas com erros", () => {
    const cat = [etf({})];
    const titulos = COLUNAS_CATALOGO.map((c) => c.titulo);
    const linha = (o: Record<string, string | number | null>) => titulos.map((t) => o[t] ?? null);
    const bytes = criarLivro([
      {
        nome: FOLHA_CATALOGO,
        colunas: titulos.map(() => ({ largura: 10 })),
        linhas: [
          titulos,
          linha({ "Código Xetra": "exmw", ISIN: "IE00B4L5Y983", Nome: "Fundo Exemplo Mundial", "TER (%)": "0,12", Região: "Global", Setor: "Diversificado" }),
          linha({ "Código Xetra": "TSTT", ISIN: "IE00B5BMR087", Nome: "Fundo Teste Tecnologia", "TER (%)": 0.4, Região: "EUA", Setor: "tecnologia", "Política de dividendos": "Distribuição", "Dividendos (%)": 1.5 }),
          linha({ "Código Xetra": "MAU1", ISIN: "IE00B4L5Y984", Nome: "ISIN errado", "TER (%)": 0.1, Região: "Marte" }),
        ],
      },
    ]);
    const r = lerLivroCatalogo(bytes, cat, "2026-11-12");
    expect(r.linhas.map((l) => [l.linha, l.estado])).toEqual([
      [2, "alterado"],
      [3, "novo"],
      [4, "erro"],
    ]);
    expect(r.linhas[0].mudancas).toEqual(["TER (%)"]);
    expect(r.linhas[0].etf).toMatchObject({ ter: 0.12, atualizadoEm: "2026-11-12" });
    expect(r.linhas[1].etf).toMatchObject({ ticker: "TSTT", regiao: "eua", setor: "tecnologia", politica: "distribuicao", dividendosPct: 1.5 });
    expect(r.linhas[2].erros.join(" ")).toMatch(/Região «Marte»/);
    expect(r.linhas[2].erros.join(" ")).toMatch(/ISIN não é válido/);
  });

  it("explica quando o ficheiro não é o do catálogo", () => {
    const bytes = criarLivro([{ nome: "Outra", colunas: [{ largura: 10 }], linhas: [["Olá"]] }]);
    expect(lerLivroCatalogo(bytes, [], "2026-11-12").erro).toMatch(/títulos das colunas/);
  });
});
