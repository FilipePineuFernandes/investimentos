import { describe, expect, it } from "vitest";
import { lerLivro } from "./excel";
import { livroHistorico, nomeFicheiroHistorico } from "./exportarHistorico";

describe("Excel do histórico", () => {
  it("uma linha por registo, do mais antigo para o mais recente", () => {
    const livro = lerLivro(
      livroHistorico([
        { data: "2026-11-12", area: "ETF", tipo: "compra", ativo: "Fundo Exemplo", codigo: "EXM", descricao: "Compra de 2 unidades", quantidade: 2, valor: 100 },
        { data: "2026-01-02", area: "Imóvel", tipo: "avaliacao", ativo: "Casa Teste", codigo: "", descricao: "Avaliação", quantidade: null, valor: 150000 },
      ]),
    );
    const linhas = livro.folhas[0].linhas;
    expect(linhas[0]).toEqual(["Data", "Área", "Ativo", "Código", "Descrição", "Unidades", "Valor (€)"]);
    expect(linhas[1].slice(1)).toEqual(["Imóvel", "Casa Teste", null, "Avaliação", null, 150000]);
    expect(linhas[2].slice(1)).toEqual(["ETF", "Fundo Exemplo", "EXM", "Compra de 2 unidades", 2, 100]);
    expect(nomeFicheiroHistorico("2026-01-01", "2026-11-12")).toBe("historico-carteira_2026-01-01_a_2026-11-12.xlsx");
  });
});
