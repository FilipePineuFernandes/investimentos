// Movimentos da carteira de ETF (ponto 6.11): compras, vendas e dividendos. A carteira é
// calculada a partir deles. A app não liga à corretora: regista o que o utilizador fez lá.
// Também guarda a última cotação de cada ETF, introduzida pelo utilizador.

import { apagar, guardar, listar } from "./repositorio";

export type TipoMovimento = "compra" | "venda" | "dividendo";
export type Origem = "proposta" | "propria";

export const NOMES_TIPO: Record<TipoMovimento, string> = { compra: "Compra", venda: "Venda", dividendo: "Dividendo" };
export const NOMES_ORIGEM: Record<Origem, string> = { proposta: "Proposta da app", propria: "Escolha própria" };

export interface Movimento {
  id: string;
  isin: string;
  tipo: TipoMovimento;
  data: string; // AAAA-MM-DD
  /** Unidades compradas ou vendidas (pode ser fracionada). */
  quantidade: number;
  /** Preço por unidade, em euros. */
  preco: number;
  /** Comissão e câmbio pagos à corretora, em euros. */
  comissao: number;
  /** Dividendo bruto recebido, em euros (só nos dividendos). */
  valor: number;
  /** Imposto retido sobre o dividendo, em euros. */
  imposto: number;
  corretora: string;
  /** Só nas compras: veio de uma proposta ou foi escolha própria. */
  origem: Origem | null;
}

export interface Cotacao {
  isin: string;
  preco: number;
  data: string;
}

export const listarMovimentos = async (chave: CryptoKey) =>
  (await listar<Movimento>(chave, "movimento-etf")).sort((a, b) => a.data.localeCompare(b.data) || ordemTipo(a) - ordemTipo(b));
export const guardarMovimento = (chave: CryptoKey, m: Movimento) => guardar(chave, "movimento-etf", m.id, m);
export const apagarMovimento = (id: string) => apagar("movimento-etf", id);

export const listarCotacoes = (chave: CryptoKey) => listar<Cotacao>(chave, "cotacao-etf");
export const guardarCotacao = (chave: CryptoKey, c: Cotacao) => guardar(chave, "cotacao-etf", c.isin, c);

/** No mesmo dia, as compras contam antes das vendas. */
function ordemTipo(m: Movimento) {
  return m.tipo === "compra" ? 0 : m.tipo === "venda" ? 1 : 2;
}
