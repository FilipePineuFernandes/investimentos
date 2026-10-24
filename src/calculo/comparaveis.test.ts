import { describe, expect, it } from "vitest";
import type { Comparavel } from "../dados/imoveis";
import { comparar, estatistica, mediana } from "./comparaveis";
import { distritoDe, linkPesquisa, PORTAIS, portalDoLink, slug, type Pesquisa } from "./portais";

let n = 0;
const c = (d: Partial<Comparavel>): Comparavel => ({
  id: String(n++),
  link: "",
  portal: "idealista",
  operacao: "venda",
  segmento: "mercado",
  tipologia: "T2",
  preco: 0,
  area: null,
  nota: "",
  registadoEm: "2026-10-24",
  ...d,
});

describe("estatísticas", () => {
  it("mediana com número par e ímpar de valores", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
  });

  it("mínimo, máximo e mediana em € e em €/m² (só com área)", () => {
    const e = estatistica([c({ preco: 300_000, area: 75 }), c({ preco: 360_000, area: 80 }), c({ preco: 420_000, area: null })])!;
    expect(e).toMatchObject({ n: 3, min: 300_000, max: 420_000, mediana: 360_000 });
    expect(e.m2).toEqual({ n: 2, min: 4000, max: 4500, mediana: 4250 });
    expect(estatistica([])).toBeNull();
  });
});

describe("comparação", () => {
  const lista = [
    c({ portal: "idealista", preco: 300_000, area: 75 }), // 4 000 €/m²
    c({ portal: "imovirtual", preco: 360_000, area: 80 }), // 4 500 €/m²
    c({ portal: "imovirtual", preco: 400_000, area: 80 }), // 5 000 €/m²
    c({ portal: "idealista", tipologia: "T3", preco: 500_000, area: 110 }),
    c({ portal: "eleiloes", segmento: "leilao", preco: 150_000, area: 70 }),
    c({ portal: "bquarto", operacao: "arrendamento", segmento: "quarto", preco: 450 }),
  ];

  it("mesma tipologia só com anúncios de mercado; leilões à parte", () => {
    const r = comparar(lista, "venda", "T2", 380_000, 80);
    expect(r.mesmaTipologia).toMatchObject({ n: 3, mediana: 360_000 });
    expect(r.mesmaTipologia?.m2?.mediana).toBe(4500);
    expect(r.porTipologia.map((x) => [x.tipologia, x.e.n])).toEqual([
      ["T2", 3],
      ["T3", 1],
    ]);
    expect(r.aParte).toEqual([{ segmento: "leilao", e: expect.objectContaining({ n: 1, mediana: 150_000 }) }]);
  });

  it("por portal, e posição do imóvel face à mediana por m²", () => {
    const r = comparar(lista, "venda", "T2", 380_000, 80); // 4 750 €/m² vs 4 500
    expect(r.porPortal.map((x) => [x.portal, x.e.n, x.e.m2?.mediana])).toEqual([
      ["imovirtual", 2, 4750],
      ["idealista", 1, 4000],
    ]);
    expect(r.posicao).toBe(5.6);
  });

  it("arrendamento separado da venda; quartos à parte", () => {
    const r = comparar(lista, "arrendamento", "T2", 1200, 80);
    expect(r.mesmaTipologia).toBeNull();
    expect(r.aParte.map((x) => x.segmento)).toEqual(["quarto"]);
    expect(r.posicao).toBeNull();
  });
});

describe("portais", () => {
  const p: Pesquisa = {
    operacao: "venda",
    tipologia: "T2",
    moradia: false,
    distrito: "Lisboa",
    municipio: "Lisboa",
    freguesia: "Arroios",
    precoMin: 320_000,
    precoMax: 480_000,
    areaMin: 64,
  };
  const portal = (id: string) => PORTAIS.find((x) => x.id === id)!;

  it("endereços diretos confirmados", () => {
    expect(linkPesquisa(portal("imovirtual"), p).url).toBe(
      "https://www.imovirtual.com/pt/resultados/comprar/apartamento,t2/lisboa/lisboa/arroios?priceMin=320000&priceMax=480000&areaMin=64",
    );
    expect(linkPesquisa(portal("remax"), { ...p, operacao: "arrendamento" }).url).toBe("https://www.remax.pt/pt/arrendar/imoveis/apartamento/lisboa/lisboa/arroios/r/t2");
  });

  it("uniões de freguesias: a pesquisa fica no concelho", () => {
    expect(linkPesquisa(portal("imovirtual"), { ...p, freguesia: "União das freguesias de Souselas e Botão", precoMin: null, precoMax: null, areaMin: null }).url).toBe(
      "https://www.imovirtual.com/pt/resultados/comprar/apartamento,t2/lisboa/lisboa",
    );
  });

  it("sem formato confirmado: pesquisa no Google limitada ao portal", () => {
    const l = linkPesquisa(portal("idealista"), p);
    expect(l.direto).toBe(false);
    expect(decodeURIComponent(l.url)).toContain("q=site:idealista.pt T2 comprar Arroios Lisboa");
    expect(decodeURIComponent(linkPesquisa(portal("bquarto"), { ...p, operacao: "arrendamento" }).url)).toContain("site:bquarto.pt quarto arrendar");
  });

  it("reconhece o portal pelo link do anúncio", () => {
    expect(portalDoLink("https://www.idealista.pt/imovel/12345/")?.id).toBe("idealista");
    expect(portalDoLink("https://casa.sapo.pt/venda/x")?.id).toBe("casasapo");
    expect(portalDoLink("https://www.e-leiloes.pt/detalhe/1")?.segmento).toBe("leilao");
    expect(portalDoLink("https://exemplo.pt/x")).toBeNull();
    expect(portalDoLink("isto não é um link")).toBeNull();
  });

  it("nomes e distritos", () => {
    expect(slug("Vila Nova de Gaia")).toBe("vila-nova-de-gaia");
    expect(slug("Santa Maria Maior")).toBe("santa-maria-maior");
    expect(slug("Évora")).toBe("evora");
    expect(distritoDe("1A01106")).toBe("Lisboa");
    expect(distritoDe("11A1312")).toBe("Porto");
    expect(distritoDe("3003101")).toBeNull(); // Madeira
  });
});
