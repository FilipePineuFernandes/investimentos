import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { criarCofre } from "./cofre";
import { guardar } from "./repositorio";
import { PERFIL_VAZIO, type Perfil } from "./perfil";
import { celula, comMarcaDeCodificacao, gerarCsv, nomeFicheiroExportacao } from "./exportar";

describe("exportação dos dados", () => {
  it("formata as células como o Excel português espera", () => {
    expect(celula(1234.5)).toBe("1234,5");
    expect(celula(true)).toBe("sim");
    expect(celula(false)).toBe("não");
    expect(celula(null)).toBe("");
    expect(celula("a;b")).toBe('"a;b"');
    expect(celula('diz "olá"')).toBe('"diz ""olá"""');
    expect(celula("duas\nlinhas")).toBe('"duas\nlinhas"');
    expect(nomeFicheiroExportacao(new Date(2026, 10, 2))).toBe("investimentos-dados-2026-11-02.csv");
    expect(comMarcaDeCodificacao("x").charCodeAt(0)).toBe(0xfeff);
  });

  it("junta o perfil, a nota, a corretora e os movimentos num só ficheiro legível", async () => {
    const { chave } = await criarCofre("uma frase bem comprida");
    const perfil: Perfil = {
      ...PERFIL_VAZIO,
      dataNascimento: "1985-03-09",
      residenciaFiscal: "madeira",
      quocienteFamiliar: 2,
      corretora: { ...PERFIL_VAZIO.corretora, nome: "Corretora Exemplo", comissaoFixa: 2, comissaoPercentagem: 0.1, comissaoMinima: 5, custodiaAnualPercentagem: 0.2 },
      nota: {
        anoRendimentos: 2025,
        dataLiquidacao: "2026-07-01",
        dataLimitePagamento: null,
        rendimentoGlobal: 40000,
        deducoesEspecificas: 4104,
        rendimentoColetavel: 35896,
        rendimentoParaTaxa: 35896,
        quocienteFamiliar: 2,
        taxaMarginal: 24.4,
        coletaTotal: 5958.62,
        deducoesColeta: 3000,
        coletaLiquida: 2914.24,
        impostoApurado: 1414.24,
        taxaEfetiva: 14.9,
        importadaEm: "2026-11-02",
      },
    };
    await guardar(chave, "perfil", "principal", perfil);
    await guardar(chave, "definicoes", "utilizador", { nome: "Pessoa Exemplo" });
    await guardar(chave, "movimento-etf", "m1", {
      id: "m1", isin: "IE00B4L5Y983", tipo: "compra", data: "2026-05-04", quantidade: 2.5, preco: 100, comissao: 2, valor: 0, imposto: 0, corretora: "Corretora Exemplo", origem: "propria",
    });

    const csv = await gerarCsv(chave, new Date(2026, 10, 2, 12, 0));
    expect(csv).toContain("PERFIL DO INVESTIDOR");
    expect(csv).toContain("Data de nascimento;09/03/1985");
    expect(csv).toContain("Residência fiscal;Madeira");
    expect(csv).toContain("Nome;Corretora Exemplo");
    expect(csv).toContain("Comissão mínima por ordem (€);5");
    expect(csv).toContain("NOTA DE LIQUIDAÇÃO DE IRS");
    expect(csv).toContain("Coleta total (€);5958,62");
    expect(csv).toContain("Imposto apurado (€, negativo = a receber);1414,24");
    expect(csv).toContain("01/07/2026");
    expect(csv).toContain("Sem imóveis registados");
    expect(csv).toContain("04/05/2026;IE00B4L5Y983;Compra;2,5;100;2;0;0;Corretora Exemplo;Escolha própria");
    expect(csv).toContain("não está cifrado");
  }, 60_000);
});
