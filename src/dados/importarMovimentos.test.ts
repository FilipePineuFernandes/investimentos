import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { criarLivro, dataDeSerie, indiceColuna, lerLivro, letraColuna, serieExcel, type Celula } from "./excel";
import { novoETF, type ETF } from "./etf";
import { COLUNAS, criarModelo, FOLHA_MOVIMENTOS, interpretarFicheiro, lerData, lerNumero } from "./importarMovimentos";
import type { Movimento } from "./movimentosEtf";

// Valores inventados: o repositório é público.
const catalogo: ETF[] = [
  { ...novoETF("2026-10-01"), isin: "IE00B4L5Y983", ticker: "EUNL", nome: "Mundo", ter: 0.2 },
  { ...novoETF("2026-10-01"), isin: "IE00B3RBWM25", ticker: "VWRL", nome: "Mundo distribuição", ter: 0.22 },
];
const cabecalho = COLUNAS.map((c) => c.titulo);
const livroCom = (linhas: Celula[][]) => criarLivro([{ nome: FOLHA_MOVIMENTOS, cabecalho: true, colunas: COLUNAS.map((c) => ({ largura: c.largura })), linhas: [cabecalho, ...linhas] }]);
let n = 0;
const opcoes = { corretora: "Corretora X", novoId: () => `id-${++n}` };

describe("excel", () => {
  it("converte colunas e datas", () => {
    expect([0, 25, 26, 27, 701].map(letraColuna)).toEqual(["A", "Z", "AA", "AB", "ZZ"]);
    expect(["A1", "Z9", "AA3", "ZZ10"].map(indiceColuna)).toEqual([0, 25, 26, 701]);
    expect(serieExcel("2024-03-15")).toBe(45366);
    expect(dataDeSerie(45366)).toBe("2024-03-15");
    expect(dataDeSerie(43904, true)).toBe("2024-03-15");
  });

  it("lê o que escreveu: texto, números, datas e caracteres especiais", () => {
    const livro = lerLivro(criarLivro([{ nome: "Folha & <1>", colunas: [{ largura: 10 }], linhas: [["Olá «ç» & <b>", 12.5, { data: "2025-01-31" }], [], [null, null, "fim"]] }]));
    expect(livro.folhas[0].nome).toBe("Folha & <1>");
    expect(livro.folhas[0].linhas[0]).toEqual(["Olá «ç» & <b>", 12.5, 45688]);
    expect(livro.folhas[0].linhas[2]).toEqual([null, null, "fim"]);
  });

  it("lê um livro como o Excel o grava (textos partilhados, células sem referência de linha)", () => {
    const zip = zipSync({
      "xl/workbook.xml": strToU8(
        `<workbook xmlns="x" xmlns:r="r"><workbookPr date1904="false"/><sheets><sheet name="Movimentos" sheetId="1" r:id="rId3"/></sheets></workbook>`,
      ),
      "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId3" Type="t" Target="worksheets/folha.xml"/></Relationships>`),
      "xl/sharedStrings.xml": strToU8(`<sst><si><t>Data</t></si><si><r><t>Ti</t></r><r><t>po</t></r></si><si><t>Compra</t></si></sst>`),
      "xl/worksheets/folha.xml": strToU8(
        `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="3"><c r="A3" s="2"><v>45366</v></c><c r="C3" t="s"><v>2</v></c></row></sheetData></worksheet>`,
      ),
    });
    const f = lerLivro(zip).folhas[0];
    expect(f.linhas[0]).toEqual(["Data", "Tipo"]);
    expect(f.linhas[1]).toEqual([]);
    expect(f.linhas[2]).toEqual([45366, null, "Compra"]);
  });

  it("recusa um ficheiro que não é .xlsx", () => {
    expect(() => lerLivro(strToU8("Data;Tipo\n"))).toThrow(/não é um livro de Excel/);
  });
});

describe("leitura de valores", () => {
  it("números com vírgula, pontos de milhar e euros", () => {
    expect(lerNumero(12.5)).toBe(12.5);
    expect(lerNumero("12,5")).toBe(12.5);
    expect(lerNumero("1.234,56 €")).toBe(1234.56);
    expect(lerNumero("85.42")).toBe(85.42);
    expect(lerNumero(null)).toBeNull();
    expect(lerNumero("dez")).toBeNaN();
  });

  it("datas em vários formatos", () => {
    expect(lerData(45366)).toBe("2024-03-15");
    expect(lerData("15/03/2024")).toBe("2024-03-15");
    expect(lerData("5-3-2024")).toBe("2024-03-05");
    expect(lerData("2024-03-15")).toBe("2024-03-15");
    expect(lerData("31/02/2024")).toBeNull();
    expect(lerData("março")).toBeNull();
  });
});

describe("modelo", () => {
  it("tem a folha dos movimentos só com os títulos e a lista dos ETF do catálogo por código", () => {
    const livro = lerLivro(criarModelo([catalogo[1], catalogo[0]]));
    expect(livro.folhas.map((f) => f.nome)).toEqual(["Movimentos", "ETF do catálogo", "Instruções"]);
    expect(livro.folhas[0].linhas).toEqual([cabecalho]);
    expect(livro.folhas[1].linhas.slice(1).map((l) => l[0])).toEqual(["EUNL", "VWRL"]);
  });

  it("o modelo vazio não tem movimentos para importar", () => {
    const r = interpretarFicheiro(criarModelo(catalogo), catalogo, [], opcoes);
    expect(r.erro).toMatch(/não tem movimentos/);
  });
});

describe("importação", () => {
  it("lê compras, vendas e dividendos, pelo código ou pelo ISIN", () => {
    const r = interpretarFicheiro(
      livroCom([
        [{ data: "2024-03-15" }, "Compra", "eunl", 10, 85.42, 1.5, null, null],
        ["02/06/2025", "venda", "EUNL.DE", "4", "101,30", "1,5", null, null],
        [null, null, null, null, null, null, null, null],
        [{ data: "2025-07-10" }, "Dividendo", "IE00B3RBWM25", null, null, null, 12.4, 3.47],
      ]),
      catalogo,
      [],
      opcoes,
    );
    expect(r.erro).toBeNull();
    expect(r.linhas.map((l) => [l.linha, l.codigo, l.erros])).toEqual([
      [2, "EUNL", []],
      [3, "EUNL", []],
      [5, "VWRL", []],
    ]);
    const [compra, venda, dividendo] = r.linhas.map((l) => l.movimento!);
    expect(compra).toMatchObject({ isin: "IE00B4L5Y983", tipo: "compra", data: "2024-03-15", quantidade: 10, preco: 85.42, comissao: 1.5, origem: "propria", corretora: "Corretora X" });
    expect(venda).toMatchObject({ tipo: "venda", data: "2025-06-02", quantidade: 4, preco: 101.3, origem: null });
    expect(dividendo).toMatchObject({ isin: "IE00B3RBWM25", tipo: "dividendo", quantidade: 0, preco: 0, valor: 12.4, imposto: 3.47 });
  });

  it("explica os erros de cada linha e não aceita ETF fora do catálogo", () => {
    const r = interpretarFicheiro(
      livroCom([
        ["32/01/2024", "Troca", "XXXX", null, null, null, null, null],
        [{ data: "2024-03-15" }, "Compra", "EUNL", "dez", null, null, null, null],
        [{ data: "2024-03-15" }, "Dividendo", "EUNL", null, null, null, 5, 9],
        [{ data: "2999-01-01" }, "Compra", "EUNL", 1, 1, null, null, null],
      ]),
      catalogo,
      [],
      opcoes,
    );
    const erros = r.linhas.map((l) => l.erros.join(" "));
    expect(erros[0]).toMatch(/data não é válida.*Compra, Venda ou Dividendo.*«XXXX» não está no catálogo/);
    expect(erros[1]).toMatch(/Unidades: não é um número.*Falta: preço por unidade/);
    expect(erros[2]).toMatch(/imposto retido é maior/);
    expect(erros[3]).toMatch(/futuro/);
    expect(r.linhas.every((l) => l.movimento === null)).toBe(true);
  });

  it("assinala os movimentos já registados e os repetidos no próprio ficheiro", () => {
    const existente: Movimento = { id: "a", isin: "IE00B4L5Y983", tipo: "compra", data: "2024-03-15", quantidade: 10, preco: 85.42, comissao: 1.5, valor: 0, imposto: 0, corretora: "", origem: "propria" };
    const linha: Celula[] = [{ data: "2024-03-15" }, "Compra", "EUNL", 10, 85.42, 1.5, null, null];
    const outra: Celula[] = [{ data: "2024-04-15" }, "Compra", "EUNL", 2, 86, null, null, null];
    const r = interpretarFicheiro(livroCom([linha, outra, outra]), catalogo, [existente], opcoes);
    expect(r.linhas.map((l) => l.repetido)).toEqual([true, false, true]);
  });

  it("encontra as colunas pelo título, mesmo noutra ordem", () => {
    const livro = criarLivro([
      {
        nome: "Folha1",
        colunas: [{ largura: 10 }],
        linhas: [
          ["Notas da minha carteira"],
          ["ISIN", "Data", "Tipo", "Preço", "Quantidade"],
          ["IE00B4L5Y983", "15/03/2024", "Compra", 85, 3],
        ],
      },
    ]);
    const r = interpretarFicheiro(livro, catalogo, [], opcoes);
    expect(r.erro).toBeNull();
    expect(r.linhas[0]).toMatchObject({ linha: 3, erros: [] });
    expect(r.linhas[0].movimento).toMatchObject({ quantidade: 3, preco: 85, data: "2024-03-15" });
  });

  it("diz o que falta quando o ficheiro não segue o modelo", () => {
    expect(interpretarFicheiro(livroCom([]).slice(0, 10), catalogo, [], opcoes).erro).toMatch(/não é um livro de Excel/);
    const semTitulos = criarLivro([{ nome: "Folha1", colunas: [{ largura: 10 }], linhas: [["a", "b"], [1, 2]] }]);
    expect(interpretarFicheiro(semTitulos, catalogo, [], opcoes).erro).toMatch(/Não encontrei os títulos/);
  });
});
