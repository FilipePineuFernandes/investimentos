// Cadernetas inventadas, com a mesma arrumação do PDF do Portal das Finanças.
import { describe, expect, it } from "vitest";
import { hayfordGaussParaWgs84, lerCaderneta, nomeProprio } from "./caderneta";

const FRACAO = `CADERNETA PREDIAL URBANA
SERVIÇO DE FINANÇAS:  9999 - EXEMPLO-1.
IDENTIFICAÇÃO DO PRÉDIO
DISTRITO:  11 - LISBOA  CONCELHO:  06 - LISBOA  FREGUESIA:  64 - ARROIOS
ARTIGO MATRICIAL:  1234  NIP:
LOCALIZAÇÃO DO PRÉDIO
Av./Rua/Praça:  Rua do Exemplo  Nº de polícia:  10  Lugar:  -  Código Postal:  1000-001 LISBOA
DESCRIÇÃO DO PRÉDIO
Tipo de Prédio:  Prédio em Regime de Prop. Horiz.
ÁREAS (em m²)
Área total do terreno:  300,0000 m²  Área de implantação do edifício:  200,0000 m²  Área bruta privativa total:
900,0000 m²
FRACÇÃO AUTÓNOMA: C
LOCALIZAÇÃO DA FRACÇÃO
Av./Rua/Praça:  Rua do Exemplo  Nº de polícia:  10  Lugar:  -  Código Postal:  1000-001 LISBOA
Andar/Divisão:  2 ESQ
ELEMENTOS DA FRACÇÃO
Afectação:  Habitação  Tipologia/Divisões:  T2  Permilagem:  100,0000  Nº de pisos da fracção:  1
ÁREAS (em m²)
Área do terreno integrante:  0,0000 m²  Área bruta privativa:  81,5000 m²  Área bruta dependente:  5,0000 m²
DADOS DE AVALIAÇÃO
Ano de inscrição na matriz:  1960  Valor patrimonial actual (CIMI):  €123.456,78  Determinado no ano:  2023
Tipo de coeficiente de localização:  Habitação  Coordenada X:  110.000,00  Coordenada Y:  195.000,00  Mod 1
TITULARES
Identificação fiscal:  999999990  Nome:  PESSOA INVENTADA
`;

const MORADIA = `CADERNETA PREDIAL URBANA
DISTRITO:  41 - AÇORES  CONCELHO:  01 - VILA DO EXEMPLO  FREGUESIA:  03 - SANTO EXEMPLO
ARTIGO MATRICIAL:  77  NIP:
Av./Rua/Praça:  Caminho Inventado  Nº de polícia:  5  Lugar:  -  Código Postal:  9500-000 VILA DO EXEMPLO
Tipo de Prédio:  Prédio não em Propriedade Horizontal
ELEMENTOS DO PRÉDIO
Afectação:  Habitação  Tipologia/Divisões:  T6  Nº de pisos:  2
Área bruta privativa:  180,0000 m²
Ano de inscrição na matriz:  2001  Valor patrimonial actual (CIMI):  €98.000,00  Determinado no ano:  2022
`;

describe("caderneta predial", () => {
  it("lê uma fração autónoma (apartamento)", () => {
    const l = lerCaderneta(FRACAO)!;
    expect(l).toMatchObject({
      codigoConcelho: "1106",
      codigoFreguesia: "110664",
      concelho: "Lisboa",
      freguesia: "Arroios",
      regiao: "continente",
      morada: "Rua do Exemplo 10, 2 ESQ, 1000-001 Lisboa",
      artigo: "1234",
      fracao: "C",
      moradia: false,
      tipologia: "T2",
      afetacao: "Habitação",
      area: 81.5,
      vpt: 123456.78,
      anoVpt: 2023,
      anoInscricao: 1960,
    });
    expect(l.coordenadas).not.toBeNull();
  });

  it("lê uma moradia nos Açores (sem coordenadas convertidas)", () => {
    const l = lerCaderneta(MORADIA)!;
    expect(l).toMatchObject({ regiao: "acores", moradia: true, tipologia: "T5+", area: 180, vpt: 98000, concelho: "Vila do Exemplo", coordenadas: null });
    expect(l.morada).toBe("Caminho Inventado 5, 9500-000 Vila do Exemplo");
  });

  it("não lê os titulares", () => {
    expect(JSON.stringify(lerCaderneta(FRACAO))).not.toMatch(/PESSOA|999999990/i);
  });

  it("recusa outros documentos", () => {
    expect(lerCaderneta("NOTA DE LIQUIDAÇÃO IRS")).toBeNull();
  });

  it("converte as coordenadas militares para latitude e longitude", () => {
    // Ponto de referência: a origem da projeção (200 000, 300 000) fica perto de 39,67 N e 8,13 O.
    const c = hayfordGaussParaWgs84(200000, 300000);
    expect(c.lat).toBeCloseTo(39.6675, 2);
    expect(c.lng).toBeCloseTo(-8.1339, 2);
    // 100 km para norte fica cerca de 0,9 graus de latitude acima.
    expect(hayfordGaussParaWgs84(200000, 400000).lat - c.lat).toBeCloseTo(0.9, 1);
  });

  it("escreve os nomes como nomes próprios", () => {
    expect(nomeProprio("UNIÃO DAS FREGUESIAS DE SÃO JOÃO E OUTRA")).toBe("União das Freguesias de São João e Outra");
  });
});

describe("aplicar a caderneta ao imóvel", () => {
  it("usa os códigos do INE e só muda o que a caderneta tem", async () => {
    const { aplicarCaderneta } = await import("../ecras/CadernetaPainel");
    const ine = { nomes: { "1701106": "Lisboa", "170110664": "Arroios" } } as never;
    const antes = { nome: "", morada: "", municipio: "", freguesia: "", geoMunicipio: null, geoFreguesia: null, regiao: "madeira", destino: "hpp", moradia: true, tipologia: "", area: null, vpt: null, anoConstrucao: 1999, preco: 150000 } as never;
    const novo = aplicarCaderneta(antes, lerCaderneta(FRACAO)!, ine) as Record<string, unknown>;
    expect(novo).toMatchObject({
      nome: "T2 Rua do Exemplo 10",
      geoMunicipio: "1701106",
      municipio: "Lisboa",
      geoFreguesia: "170110664",
      freguesia: "Arroios",
      regiao: "continente",
      destino: "hpp",
      moradia: false,
      tipologia: "T2",
      area: 81.5,
      vpt: 123456.78,
      anoConstrucao: 1999,
      preco: 150000,
    });
  });
});
