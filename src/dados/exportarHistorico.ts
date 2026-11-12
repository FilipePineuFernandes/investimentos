// Excel do histórico da carteira, de uma data a outra: uma linha por acontecimento, com a mesma
// descrição que aparece na app.

import type { Acontecimento } from "../calculo/historico";
import { criarLivro, type Celula } from "./excel";

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Nome do ficheiro: historico-carteira_2026-01-01_a_2026-11-12.xlsx */
export const nomeFicheiroHistorico = (de: string, ate: string) => `historico-carteira_${de || "inicio"}_a_${ate || "hoje"}.xlsx`;

export function livroHistorico(lista: Acontecimento[]): Uint8Array {
  // Do mais antigo para o mais recente, como num extrato.
  const linhas: Celula[][] = [...lista]
    .reverse()
    .map((a) => [{ data: a.data }, a.area, a.ativo, a.codigo || null, a.descricao, a.quantidade, a.valor]);
  return criarLivro([
    {
      nome: "Histórico",
      cabecalho: true,
      colunas: [{ largura: 12, formato: "data" }, { largura: 9 }, { largura: 42 }, { largura: 10 }, { largura: 34 }, { largura: 14, formato: "numero" }, { largura: 14, formato: "numero" }],
      linhas: [["Data", "Área", "Ativo", "Código", "Descrição", "Unidades", "Valor (€)"], ...linhas],
    },
  ]);
}
