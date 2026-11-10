// Carteira de criptomoedas calculada a partir dos movimentos, com o método FIFO (as primeiras
// unidades compradas são as primeiras vendidas), e o IRS das vendas pela regra em vigor desde 2023:
// ganhos de criptoativos detidos menos de 365 dias pagam a taxa especial (28%), ou entram no
// englobamento; detidos 365 dias ou mais, ficam excluídos de tributação.

import type { Movimento } from "../dados/movimentosEtf";
import type { MovimentoCripto } from "../dados/movimentosCripto";
import { valorParametro } from "../dados/parametros";
import { posicaoEtf, type PosicaoEtf } from "./carteiraEtf";
import { centimos } from "./util";

/** Dias de detenção a partir dos quais o ganho fica isento. */
export const DIAS_ISENCAO_CRIPTO = 365;

const DIA = 86_400_000;
const dias = (a: string, b: string) => (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DIA;
const q8 = (n: number) => Math.round(n * 1e8) / 1e8;

/** O cálculo FIFO da posição é o mesmo dos ETF: a moeda faz de identificador. */
const comoMovimento = (m: MovimentoCripto): Movimento => ({ ...m, isin: m.moeda, valor: 0, imposto: 0, corretora: "", origem: null });

/** Posição numa moeda: quantidade, custo FIFO, valor atual e ganhos (os movimentos vêm por ordem de data). */
export function posicaoCripto(moeda: string, movimentos: MovimentoCripto[], cotacao: number | null): PosicaoEtf {
  return posicaoEtf(moeda, movimentos.filter((m) => m.moeda === moeda).map(comoMovimento), cotacao);
}

export interface ImpostoCriptoAno {
  ano: number;
  /** Saldo dos ganhos e perdas das unidades detidas menos de 365 dias. */
  tributavel: number;
  /** Saldo das unidades detidas 365 dias ou mais (excluído de tributação). */
  isento: number;
  /** IRS à taxa especial sobre o saldo tributável positivo. */
  imposto: number;
}

/** Ganho de cada venda separado pelo tempo de detenção de cada lote (FIFO), somado por ano. */
export function impostoCripto(movimentos: MovimentoCripto[]): ImpostoCriptoAno[] {
  const anos = new Map<number, { tributavel: number; isento: number }>();
  const porMoeda = new Map<string, MovimentoCripto[]>();
  for (const m of movimentos) porMoeda.set(m.moeda, [...(porMoeda.get(m.moeda) ?? []), m]);

  for (const lista of porMoeda.values()) {
    const lotes: { data: string; quantidade: number; custoUnitario: number }[] = [];
    for (const m of lista) {
      if (m.tipo === "compra") {
        if (m.quantidade > 0) lotes.push({ data: m.data, quantidade: m.quantidade, custoUnitario: (m.quantidade * m.preco + m.comissao) / m.quantidade });
        continue;
      }
      const ano = Number(m.data.slice(0, 4));
      const a = anos.get(ano) ?? { tributavel: 0, isento: 0 };
      let falta = m.quantidade;
      while (q8(falta) > 0 && lotes.length > 0) {
        const lote = lotes[0];
        const usa = Math.min(lote.quantidade, falta);
        const receita = usa * m.preco - (m.comissao * usa) / m.quantidade;
        const ganho = receita - usa * lote.custoUnitario;
        if (dias(lote.data, m.data) >= DIAS_ISENCAO_CRIPTO) a.isento += ganho;
        else a.tributavel += ganho;
        lote.quantidade = q8(lote.quantidade - usa);
        falta = q8(falta - usa);
        if (lote.quantidade <= 0) lotes.shift();
      }
      anos.set(ano, a);
    }
  }
  const taxa = valorParametro("irs.cripto-taxa");
  return [...anos.entries()]
    .sort((x, y) => y[0] - x[0])
    .map(([ano, a]) => ({ ano, tributavel: centimos(a.tributavel), isento: centimos(a.isento), imposto: centimos((Math.max(a.tributavel, 0) * taxa) / 100) }));
}
