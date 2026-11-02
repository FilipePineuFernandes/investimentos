import { describe, expect, it } from "vitest";
import { PERFIL_VAZIO } from "../dados/perfil";
import { anoDaNotaNecessaria, aplicarNotaAoPerfil, criarNota, lerNota, notaDesatualizada, pedirNovaNotaEm, regiaoPorCodigoPostal } from "./notaIrs";

// Nota inventada (valores sem relação com ninguém), no formato que a leitura da fotografia devolve:
// cada linha da tabela com a etiqueta e o valor juntos.
const NOTA = `
JOANA EXEMPLO DA SILVA
RUA INVENTADA Nº 1
4000-001 PORTO
Nº DOCUMENTO  ID. FISCAL
2026 00001234567   123456789
PERÍODO RENDIMENTOS   ACERTO   Nº LIQUIDAÇÃO   LIQUIDAÇÃO
2025-01-01 a 2025-12-31 | 2026-07-01 | 2026 5000000001 | 2026-06-26
1 | Rendimento global                                                   40.000,00 €
2 | Deduções específicas                                                 4.104,00 €
3 | Perdas a recuperar                                                       0,00 €
4 | Abatimento por mínimo de existência                                      0,00 €
5 | Deduções ao rendimento                                                   0,00 €
6 | Rendimento coletável [1-(2+3+4+5)]                                  35.896,00 €
7 | Quociente rendimentos anos anteriores/Propriedade intelectual            0,00 €
8 | Rendimentos isentos englobados para determinação da taxa                 0,00 €
9 | Total do rendimento para determinação da taxa (6+8-7)               35.896,00 €
10 | Quociente familiar 2,00 ; taxa 24,400%
11 | Importância apurada (9:coef. x taxa)                                 4.379,31 €
12 | Parcela a abater                                                     1.400,00 €
13 | Imposto anos anteriores/Propriedade intelectual                          0,00 €
18 | Coleta total [(11-12)x2,00+13-14+15+16+17]                           5.958,62 €
19 | Deduções à coleta                                                    3.000,00 €
20 | Benefício municipal (1,50% da coleta)                                   44,38 €
21 | Acréscimos à coleta                                                      0,00 €
22 | Coleta líquida [18-19-20(>=0)+21]                                    2.914,24 €
23 | Pagamentos por conta                                                 1.200,00 €
24 | Retenções na fonte                                                     300,00 €
25 | Imposto apurado [22-(23+24)]                                         1.414,24 €
Taxa Efetiva de Tributação - 8,12%      VALOR A PAGAR:                   1.414,24 €
Data limite de pagamento
2026-08-31
`;

const VALORES = {
  rendimentoGlobal: 40_000,
  deducoesEspecificas: 4104,
  rendimentoColetavel: 35_896,
  rendimentoParaTaxa: 35_896,
  importanciaApurada: 4379.31,
  parcelaAbater: 1400,
  coletaTotal: 5958.62,
  deducoesColeta: 3000,
  beneficioMunicipal: 44.38,
  coletaLiquida: 2914.24,
  pagamentosPorConta: 1200,
  retencoes: 300,
  impostoApurado: 1414.24,
};

describe("leitura da nota de liquidação", () => {
  it("lê todos os valores, as datas, o quociente e a taxa de uma nota limpa", () => {
    const n = lerNota([NOTA]);
    expect(n.valores).toEqual(VALORES);
    expect(Object.values(n.origem).every((o) => o === "lido")).toBe(true);
    expect(n.anoRendimentos).toBe(2025);
    expect(n.dataLiquidacao).toBe("2026-06-26");
    expect(n.dataLimitePagamento).toBe("2026-08-31");
    expect(n.quocienteFamiliar).toBe(2);
    expect(n.taxaMarginal).toBe(24.4);
    expect(n.taxaEfetiva).toBe(8.12);
    expect(n.regiao).toBe("continente");
    expect(n.aReceber).toBe(false);
    expect(n.duvidas).toEqual([]);
    expect(n.avisos).toEqual([]);
  });

  it("não guarda nomes, NIF nem morada", () => {
    const texto = JSON.stringify(lerNota([NOTA]));
    for (const proibido of ["JOANA", "SILVA", "INVENTADA", "123456789", "4000-001", "5000000001"]) expect(texto).not.toContain(proibido);
  });

  it("aceita erros comuns da leitura: vírgula a mais nos milhares e vírgula perdida", () => {
    const ruido = NOTA.replace("35.896,00 €\n7 |", "35,896,00 €\n7 |")
      .replace("44,38 €", "4438€") // vírgula perdida
      .replace(/25 \| Imposto apurado \[22-\(23\+24\)\] +1\.414,24 €/, "25 | Imposto apurado [22-(23+24)]    141424 €");
    const n = lerNota([ruido]);
    expect(n.valores.rendimentoColetavel).toBe(35_896);
    expect(n.valores.beneficioMunicipal).toBe(44.38);
    expect(n.valores.impostoApurado).toBe(1414.24);
    expect(n.duvidas).toEqual([]);
  });

  it("entre várias leituras escolhe a que bate certo com as contas da nota", () => {
    const errada = NOTA.replace("6 | Rendimento coletável [1-(2+3+4+5)]                                  35.896,00 €", "6 | Rendimento coletável [1-(2+3+4+5)]                                  36.896,00 €");
    expect(errada).not.toBe(NOTA);
    // A leitura errada aparece primeiro, a certa depois: as contas desempatam.
    expect(lerNota([errada, NOTA]).valores.rendimentoColetavel).toBe(35_896);
    expect(lerNota([NOTA, errada]).valores.rendimentoColetavel).toBe(35_896);
  });

  it("repõe pelas contas da nota o que a leitura não apanhou, e diz que foi calculado", () => {
    const semLinhas = NOTA.split("\n")
      .filter((l) => !/Coleta líquida|Benefício municipal/.test(l))
      .join("\n");
    const n = lerNota([semLinhas]);
    expect(n.valores.coletaLiquida).toBe(2914.24);
    expect(n.valores.beneficioMunicipal).toBe(44.38);
    expect(n.origem.coletaLiquida).toBe("calculado");
    expect(n.origem.beneficioMunicipal).toBe("calculado");
    expect(n.origem.coletaTotal).toBe("lido");
  });

  it("corrige um valor lido mal quando duas contas diferentes da nota concordam no valor certo", () => {
    // O rendimento coletável saiu com um algarismo a mais; a diferença das linhas 1 e 2 e a linha 9 dão ambas 35 896.
    const mal = NOTA.replace("6 | Rendimento coletável [1-(2+3+4+5)]                                  35.896,00 €", "6 | Rendimento coletável [1-(2+3+4+5)]                                 358.906,00 €");
    expect(mal).not.toBe(NOTA);
    const n = lerNota([mal]);
    expect(n.valores.rendimentoColetavel).toBe(35_896);
    expect(n.origem.rendimentoColetavel).toBe("calculado");
    expect(n.duvidas).toEqual([]);
  });

  it("não corrige às cegas quando só uma conta discorda: avisa e deixa o valor lido", () => {
    // Com o rendimento global errado não se sabe se falha a linha 1, a 2 ou a 6: só a conta das linhas 1, 2 e 6 o diz.
    const n = lerNota([NOTA.replace("40.000,00 €", "41.000,00 €")]);
    expect(n.valores.rendimentoGlobal).toBe(41_000);
    expect(n.origem.rendimentoGlobal).toBe("lido");
    expect(n.duvidas).toEqual(expect.arrayContaining(["rendimentoGlobal", "deducoesEspecificas", "rendimentoColetavel"]));
    expect(n.avisos.join(" ")).toContain("linhas 1, 2 e 6");
  });

  it("avisa quando uma conta que não sabe corrigir não bate certo", () => {
    const n = lerNota([NOTA.replace("1.400,00 €", "1.500,00 €")]);
    expect(n.valores.parcelaAbater).toBe(1500);
    expect(n.duvidas).toEqual(expect.arrayContaining(["importanciaApurada", "parcelaAbater", "coletaTotal"]));
    expect(n.avisos.join(" ")).toContain("linhas 11, 12 e 18");
  });

  it("calcula a taxa do escalão se a leitura a perder", () => {
    const n = lerNota([NOTA.replace("10 | Quociente familiar 2,00 ; taxa 24,400%", "10 | Quociente familiar 2,00")]);
    expect(n.quocienteFamiliar).toBe(2);
    expect(n.taxaMarginal).toBeCloseTo(24.4, 1);
  });

  it("reconhece uma nota com reembolso (valor a receber) e põe o imposto negativo", () => {
    const reembolso = `
2025-01-01 a 2025-12-31 | 2026-07-01 | 2026 5000000002 | 2026-06-26
22 | Coleta líquida [18-19-20(>=0)+21]    1.000,00 €
23 | Pagamentos por conta                 1.200,00 €
24 | Retenções na fonte                     800,00 €
25 | Imposto apurado [22-(23+24)]         1.000,00 €
Taxa Efetiva de Tributação - 5,00%      VALOR A RECEBER:        1.000,00 €
`;
    const n = lerNota([reembolso]);
    expect(n.aReceber).toBe(true);
    expect(n.valores.impostoApurado).toBe(-1000);
    expect(n.duvidas).toEqual([]);
  });

  it("sem texto nenhum não rebenta e não inventa nada", () => {
    const n = lerNota([]);
    expect(n.valores).toEqual({});
    expect(n.anoRendimentos).toBeNull();
    expect(n.quocienteFamiliar).toBeNull();
    expect(n.regiao).toBeNull();
  });

  it("se a leitura perder o período, o ano dos rendimentos é o anterior ao da liquidação", () => {
    const n = lerNota(["2025-01-01 a 2025-12-31 | 2026-07-01 | 2026 5000000001 | 2026-06-26"]);
    expect(n.anoRendimentos).toBe(2025);
    expect(n.dataLiquidacao).toBe("2026-06-26");
  });
});

describe("região pelo código postal", () => {
  it("Madeira 9000 a 9499, Açores 9500 a 9999, o resto Continente", () => {
    expect(regiaoPorCodigoPostal("3360-073")).toBe("continente");
    expect(regiaoPorCodigoPostal("1000-001")).toBe("continente");
    expect(regiaoPorCodigoPostal("8999-999")).toBe("continente");
    expect(regiaoPorCodigoPostal("9000-100")).toBe("madeira");
    expect(regiaoPorCodigoPostal("9400-100")).toBe("madeira"); // Porto Santo
    expect(regiaoPorCodigoPostal("9500-100")).toBe("acores");
    expect(regiaoPorCodigoPostal("9980-100")).toBe("acores");
    expect(regiaoPorCodigoPostal("abc")).toBeNull();
    expect(regiaoPorCodigoPostal("0500-100")).toBeNull();
  });

  it("só sugere a região se todos os códigos postais da nota coincidirem", () => {
    expect(lerNota(["Serviço de Finanças 9000-100 FUNCHAL\nMorada 9020-200 FUNCHAL"]).regiao).toBe("madeira");
    expect(lerNota(["Serviço de Finanças 9500-100 PONTA DELGADA"]).regiao).toBe("acores");
    expect(lerNota(["Serviço de Finanças 1000-001 LISBOA\nMorada 9000-100 FUNCHAL"]).regiao).toBeNull();
    expect(lerNota(["sem códigos postais"]).regiao).toBeNull();
  });
});

describe("quando é preciso uma nota nova", () => {
  it("antes de 31 de agosto usa-se a nota de há dois anos; depois, a do ano anterior", () => {
    expect(anoDaNotaNecessaria("2026-11-02")).toBe(2025);
    expect(anoDaNotaNecessaria("2027-01-15")).toBe(2025);
    expect(anoDaNotaNecessaria("2027-06-30")).toBe(2025);
    expect(anoDaNotaNecessaria("2027-08-31")).toBe(2025); // o prazo ainda não passou
    expect(anoDaNotaNecessaria("2027-09-01")).toBe(2026);
    expect(anoDaNotaNecessaria("2028-03-01")).toBe(2026);
  });

  it("a nota de 2025 serve até 31/08/2027 e a partir de 1/09/2027 pede-se a de 2026", () => {
    const nota = criarNota({ valores: VALORES, anoRendimentos: 2025, dataLiquidacao: "2026-06-26", dataLimitePagamento: "2026-08-31", quocienteFamiliar: 2, taxaMarginal: 24.4, taxaEfetiva: 8.12, regiao: null }, "2026-11-02");
    expect(notaDesatualizada(nota, "2026-11-02")).toBe(false);
    expect(notaDesatualizada(nota, "2027-08-31")).toBe(false);
    expect(notaDesatualizada(nota, "2027-09-01")).toBe(true);
    expect(notaDesatualizada(nota, "2028-05-01")).toBe(true);
    expect(pedirNovaNotaEm(2025)).toBe("2027-09-01");
  });

  it("sem nota guardada não há nada a pedir", () => {
    expect(notaDesatualizada(null, "2030-01-01")).toBe(false);
    expect(notaDesatualizada(undefined, "2030-01-01")).toBe(false);
  });
});

describe("aplicar a nota ao perfil", () => {
  const nota = criarNota({ valores: VALORES, anoRendimentos: 2025, dataLiquidacao: "2026-06-26", dataLimitePagamento: "2026-08-31", quocienteFamiliar: 2, taxaMarginal: 24.4, taxaEfetiva: 8.12, regiao: "continente" }, "2026-11-02");

  it("passa o rendimento da taxa e o quociente para as contas de IRS", () => {
    const p = aplicarNotaAoPerfil({ ...PERFIL_VAZIO, rendimentoMensalLiquido: 2500 }, nota, null);
    expect(p.rendimentoColetavelAnual).toBe(35_896);
    expect(p.quocienteFamiliar).toBe(2);
    expect(p.nota).toBe(nota);
    expect(p.rendimentoMensalLiquido).toBe(2500); // o que a nota não dá fica como estava
  });

  it("só muda a residência fiscal se a região for confirmada", () => {
    expect(aplicarNotaAoPerfil({ ...PERFIL_VAZIO, residenciaFiscal: "madeira" }, nota, null).residenciaFiscal).toBe("madeira");
    expect(aplicarNotaAoPerfil(PERFIL_VAZIO, nota, "acores").residenciaFiscal).toBe("acores");
  });

  it("a nota guardada só tem números e datas", () => {
    const campos = Object.keys(nota);
    expect(campos).not.toEqual(expect.arrayContaining(["nome", "nif", "morada"]));
    expect(Object.values(nota).every((v) => v === null || typeof v === "number" || /^\d{4}-\d{2}-\d{2}$/.test(String(v)))).toBe(true);
  });
});
