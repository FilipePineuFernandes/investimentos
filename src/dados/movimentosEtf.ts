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
  /** Dia da cotação (AAAA-MM-DD). */
  data: string;
  /** Só nas cotações automáticas: o símbolo que resultou no serviço (por exemplo EUNL.DEX). */
  simbolo?: string;
  /** Quando a app a foi buscar, ou quando foi indicada à mão (data e hora). */
  obtidaEm?: string;
  /** Indicada à mão, para os ETF que o serviço automático não encontra. */
  manual?: boolean;
}

export const listarMovimentos = async (chave: CryptoKey) =>
  (await listar<Movimento>(chave, "movimento-etf")).sort((a, b) => a.data.localeCompare(b.data) || ordemTipo(a) - ordemTipo(b));
export const guardarMovimento = (chave: CryptoKey, m: Movimento) => guardar(chave, "movimento-etf", m.id, m);
export const apagarMovimento = (id: string) => apagar("movimento-etf", id);

export const listarCotacoes = (chave: CryptoKey) => listar<Cotacao>(chave, "cotacao-etf");

/** Histórico das cotações de um ETF: um preço por dia, guardado sempre que a app vai buscar ou se indica a cotação. */
export interface HistoricoCotacao {
  isin: string;
  /** Por ordem de data, um preço por dia. */
  pontos: { data: string; preco: number }[];
}

/** Junta pontos novos aos antigos: um por dia, o mais recente prevalece, por ordem de data. */
export function juntarPontos(antigos: HistoricoCotacao["pontos"], novos: HistoricoCotacao["pontos"]): HistoricoCotacao["pontos"] {
  const porDia = new Map(antigos.map((p) => [p.data, p.preco]));
  for (const p of novos) if (p.preco > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.data)) porDia.set(p.data, p.preco);
  return [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, preco]) => ({ data, preco }));
}

export const listarHistoricoCotacoes = (chave: CryptoKey) => listar<HistoricoCotacao>(chave, "cotacao-historico");

/** Acrescenta pontos ao histórico de um ETF. */
export async function guardarNoHistorico(chave: CryptoKey, isin: string, novos: HistoricoCotacao["pontos"], existentes?: HistoricoCotacao[]): Promise<void> {
  const lista = existentes ?? (await listarHistoricoCotacoes(chave));
  const antes = lista.find((h) => h.isin === isin)?.pontos ?? [];
  await guardar(chave, "cotacao-historico", isin, { isin, pontos: juntarPontos(antes, novos) });
}
export const guardarCotacao = (chave: CryptoKey, c: Cotacao) => guardar(chave, "cotacao-etf", c.isin, c);

/** No mesmo dia, as compras contam antes das vendas. */
function ordemTipo(m: Movimento) {
  return m.tipo === "compra" ? 0 : m.tipo === "venda" ? 1 : 2;
}
