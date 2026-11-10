// Movimentos da carteira de criptomoedas: compras e vendas, registados pelo utilizador ou
// importados do Excel. A carteira e o IRS são calculados a partir deles (FIFO).
// Também guarda a última cotação de cada moeda, obtida automaticamente.

import { apagar, guardar, listar } from "./repositorio";

export type TipoCripto = "compra" | "venda";

export const NOMES_TIPO_CRIPTO: Record<TipoCripto, string> = { compra: "Compra", venda: "Venda" };

export interface MovimentoCripto {
  id: string;
  /** Código da moeda, em maiúsculas (BTC, ETH, SOL…). */
  moeda: string;
  tipo: TipoCripto;
  data: string; // AAAA-MM-DD
  /** Quantidade comprada ou vendida (com as casas decimais que a corretora indicar). */
  quantidade: number;
  /** Preço por unidade, em euros. */
  preco: number;
  /** Comissão paga à corretora, em euros. */
  comissao: number;
}

export interface CotacaoCripto {
  moeda: string;
  /** Identificador da moeda no CoinGecko (bitcoin, ethereum…), para não o procurar outra vez. */
  idServico: string;
  preco: number;
  /** Dia da cotação (AAAA-MM-DD). */
  data: string;
  /** Quando a app a foi buscar (data e hora). */
  obtidaEm: string;
}

/** No mesmo dia, as compras contam antes das vendas. */
const ordem = (m: MovimentoCripto) => (m.tipo === "compra" ? 0 : 1);
export const ordenarMovimentosCripto = (l: MovimentoCripto[]) => [...l].sort((a, b) => a.data.localeCompare(b.data) || ordem(a) - ordem(b));

export const listarMovimentosCripto = async (chave: CryptoKey) => ordenarMovimentosCripto(await listar<MovimentoCripto>(chave, "movimento-cripto"));
export const guardarMovimentoCripto = (chave: CryptoKey, m: MovimentoCripto) => guardar(chave, "movimento-cripto", m.id, m);
export const apagarMovimentoCripto = (id: string) => apagar("movimento-cripto", id);

export const listarCotacoesCripto = (chave: CryptoKey) => listar<CotacaoCripto>(chave, "cotacao-cripto");
export const guardarCotacaoCripto = (chave: CryptoKey, c: CotacaoCripto) => guardar(chave, "cotacao-cripto", c.moeda, c);
