import { describe, expect, it } from "vitest";
import { classificar, paraCatalogo, pesquisar, type LinhaXetra } from "./pesquisaEtf";
// @ts-expect-error: programa em JavaScript, sem tipos
import { lerLista } from "../../scripts/dados-xetra.mjs";

// Nomes como aparecem na lista oficial da Xetra.
const linhas: LinhaXetra[] = [
  ["IE00B4L5Y983", "EUNL", "ISHSIII-CORE MSCI WLD DLA", "indice", "2014-08-11"],
  ["IE00B5BMR087", "SXR8", "ISHSVII-CORE S+P500 DLACC", "indice", "2010-09-27"],
  ["IE00B53SZB19", "SXRV", "ISHSVII-NASDAQ 100 DL ACC", "indice", "2010-01-26"],
  ["IE00BK5BQT80", "VWCE", "VANG.FTSE A.W. DLA", "indice", "2019-07-24"],
  ["IE00BM67HK77", "XDWH", "X(IE)-MSCI WO.HE.CA. 1CDL", "indice", "2016-03-10"],
  ["IE00B4K48X80", "EUNK", "ISHSIII-C.M.E.U.E.EO ACC", "indice", "2009-10-20"],
  ["IE00BKM4GZ66", "IS3N", "IS C.MSCI EMIMI U.ETF DLA", "indice", "2014-05-28"],
  ["IE00B3F81R35", "EUNA", "ISHSIII-CORE EO GOVT BOND", "obrigacoes", "2009-12-07"],
];
const etf = linhas.map(classificar);
const de = (c: string) => etf.find((e) => e.codigo === c)!;
const sem = { texto: "", regiao: "todas", setor: "todos", tipo: "todos" } as const;

describe("Novo ETF: lista da Xetra", () => {
  it("deduz a região, o setor, o emitente e a política a partir do nome abreviado", () => {
    expect(de("EUNL")).toMatchObject({ regiao: "global", setor: "diversificado", emitente: "iShares", politica: "acumulacao", domicilio: "IE" });
    expect(de("SXR8")).toMatchObject({ regiao: "eua", setor: "diversificado" });
    expect(de("SXRV")).toMatchObject({ regiao: "eua", setor: "tecnologia" });
    expect(de("VWCE")).toMatchObject({ regiao: "global", emitente: "Vanguard" });
    expect(de("XDWH")).toMatchObject({ regiao: "global", setor: "saude", emitente: "Xtrackers" });
    expect(de("EUNK").regiao).toBe("europa");
    expect(de("IS3N").regiao).toBe("emergentes");
    expect(de("EUNA").setor).toBe("obrigacoes");
  });

  it("pesquisa pelas palavras completas, com as abreviaturas da Xetra", () => {
    expect(pesquisar(etf, { ...sem, texto: "MSCI World" }).map((e) => e.codigo)).toEqual(["EUNL", "XDWH"]);
    expect(pesquisar(etf, { ...sem, texto: "S&P 500" }).map((e) => e.codigo)).toEqual(["SXR8"]);
    expect(pesquisar(etf, { ...sem, texto: "sxrv" }).map((e) => e.codigo)).toEqual(["SXRV"]);
    expect(pesquisar(etf, { ...sem, texto: "IE00BK5BQT80" }).map((e) => e.codigo)).toEqual(["VWCE"]);
  });

  it("combina região, setor e tipo; sem filtros não mostra nada", () => {
    expect(pesquisar(etf, { ...sem, regiao: "eua" }).map((e) => e.codigo)).toEqual(["SXR8", "SXRV"]);
    expect(pesquisar(etf, { ...sem, regiao: "eua", setor: "tecnologia" }).map((e) => e.codigo)).toEqual(["SXRV"]);
    expect(pesquisar(etf, { ...sem, tipo: "obrigacoes" }).map((e) => e.codigo)).toEqual(["EUNA"]);
    expect(pesquisar(etf, sem)).toEqual([]);
  });

  it("leva para o catálogo o que se sabe; o TER fica por preencher", () => {
    const c = paraCatalogo(de("EUNL"));
    expect(c).toMatchObject({ isin: "IE00B4L5Y983", ticker: "EUNL", emitente: "iShares", regiao: "global", politica: "acumulacao", domicilio: "IE" });
    expect(c).not.toHaveProperty("ter");
  });

  it("lê o ficheiro da Deutsche Börse e guarda só os ETF ativos em euros", () => {
    const cab = ["Product Status", "Instrument Status", "Instrument", "ISIN", "Mnemonic", "Product Assignment Group Description", "Instrument Type", "Currency", "First Trading Date"];
    const linha = (v: string[]) => v.join(";");
    const texto = [
      "Market:;XETR",
      "Date Last Update:;10.11.2026",
      linha(cab),
      linha(["Active", "Active", "ISHSIII-CORE MSCI WLD DLA", "IE00B4L5Y983", "EUNL", "EXCHANGE TRADED FUNDS - PASSIV", "ETF", "EUR", "2014-08-11"]),
      linha(["Active", "Active", "ISHSIII-CORE MSCI WLD DLA", "IE00B4L5Y983", "IWDA", "ETF - CURRENCY USD", "ETF", "USD", "2014-08-11"]),
      linha(["Active", "Inactive", "VELHO ETF", "IE0000000000", "OLD1", "EXCHANGE TRADED FUNDS - PASSIV", "ETF", "EUR", ""]),
      linha(["Active", "Active", "SIEMENS AG", "DE0007236101", "SIE", "DAX", "CS", "EUR", ""]),
      linha(["Active", "Active", "ISHSIII-CORE EO GOVT BOND", "IE00B3F81R35", "EUNA", "EXCHANGE TRADED FUNDS - RENTEN", "ETF", "EUR", "2009-12-07"]),
    ].join("\n");
    const l = lerLista(texto);
    expect(l.atualizado).toBe("2026-11-10");
    expect(l.etf).toEqual([
      ["IE00B3F81R35", "EUNA", "ISHSIII-CORE EO GOVT BOND", "obrigacoes", "2009-12-07"],
      ["IE00B4L5Y983", "EUNL", "ISHSIII-CORE MSCI WLD DLA", "indice", "2014-08-11"],
    ]);
  });
});
