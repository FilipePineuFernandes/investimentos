// Cotações das criptomoedas pelo CoinGecko: gratuito, sem chave, e um só pedido traz o preço em
// euros de todas as moedas. A app envia só os nomes públicos das moedas, nunca dados pessoais.

import { centimos } from "../calculo/util";

const API = "https://api.coingecko.com/api/v3";

/** Identificador no CoinGecko das moedas mais comuns (o código sozinho pode ser ambíguo). */
export const IDS_CONHECIDOS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  BNB: "binancecoin",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  POL: "polygon-ecosystem-token",
  MATIC: "matic-network",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  TRX: "tron",
  XLM: "stellar",
  ATOM: "cosmos",
  UNI: "uniswap",
  SHIB: "shiba-inu",
  NEAR: "near",
  TON: "the-open-network",
  SUI: "sui",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  PEPE: "pepe",
  ETC: "ethereum-classic",
  XMR: "monero",
  ALGO: "algorand",
  FIL: "filecoin",
  ICP: "internet-computer",
  HBAR: "hedera-hashgraph",
  VET: "vechain",
  AAVE: "aave",
  INJ: "injective-protocol",
  TAO: "bittensor",
  KAS: "kaspa",
  CRO: "crypto-com-chain",
  USDT: "tether",
  USDC: "usd-coin",
  EURC: "euro-coin",
};

export type ErroCripto = "rede" | "limite";

export interface CotacaoObtidaCripto {
  moeda: string;
  idServico: string;
  preco: number;
  /** Dia da cotação (AAAA-MM-DD). */
  data: string;
}

export interface ResultadoCripto {
  cotacoes: CotacaoObtidaCripto[];
  /** Moedas que o serviço não conhece. */
  semDados: string[];
  erro: ErroCripto | null;
}

export const MENSAGENS_ERRO_CRIPTO: Record<ErroCripto, string> = {
  rede: "Não foi possível ligar ao serviço de cotações (CoinGecko). Verifique a internet e tente de novo.",
  limite: "O serviço de cotações pediu para esperar um pouco. Tente daqui a um minuto.",
};

/** Procura o identificador de uma moeda pelo código: o resultado com o mesmo código e mais capitalização. */
export async function procurarId(moeda: string, pedir: typeof fetch = fetch): Promise<string | null | ErroCripto> {
  const conhecido = IDS_CONHECIDOS[moeda.toUpperCase()];
  if (conhecido) return conhecido;
  let r: Response;
  try {
    r = await pedir(`${API}/search?query=${encodeURIComponent(moeda)}`);
  } catch {
    return "rede";
  }
  if (r.status === 429) return "limite";
  if (!r.ok) return "rede";
  const j = (await r.json()) as { coins?: { id: string; symbol: string; market_cap_rank: number | null }[] };
  const iguais = (j.coins ?? []).filter((c) => c.symbol?.toUpperCase() === moeda.toUpperCase());
  iguais.sort((a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity));
  return iguais[0]?.id ?? null;
}

/** Cotações em euros de várias moedas, num só pedido. idsGuardados evita voltar a procurar as moedas já conhecidas. */
export async function pedirCotacoesCripto(moedas: string[], idsGuardados: Record<string, string> = {}, pedir: typeof fetch = fetch): Promise<ResultadoCripto> {
  const semDados: string[] = [];
  const ids = new Map<string, string>(); // moeda → id
  for (const moeda of moedas) {
    const id = idsGuardados[moeda] ?? (await procurarId(moeda, pedir));
    if (id === "rede" || id === "limite") return { cotacoes: [], semDados, erro: id };
    if (id) ids.set(moeda, id);
    else semDados.push(moeda);
  }
  if (ids.size === 0) return { cotacoes: [], semDados, erro: null };

  let r: Response;
  try {
    r = await pedir(`${API}/simple/price?ids=${encodeURIComponent([...new Set(ids.values())].join(","))}&vs_currencies=eur&include_last_updated_at=true`);
  } catch {
    return { cotacoes: [], semDados, erro: "rede" };
  }
  if (r.status === 429) return { cotacoes: [], semDados, erro: "limite" };
  if (!r.ok) return { cotacoes: [], semDados, erro: "rede" };
  const j = (await r.json()) as Record<string, { eur?: number; last_updated_at?: number }>;

  const cotacoes: CotacaoObtidaCripto[] = [];
  for (const [moeda, id] of ids) {
    const p = j[id];
    if (p && typeof p.eur === "number" && p.eur > 0) {
      const quando = p.last_updated_at ? new Date(p.last_updated_at * 1000) : new Date();
      // Moedas muito baratas (SHIB, PEPE): guarda-se o preço com mais casas do que o cêntimo.
      const preco = p.eur >= 1 ? centimos(p.eur) : Number(p.eur.toPrecision(6));
      cotacoes.push({ moeda, idServico: id, preco, data: quando.toISOString().slice(0, 10) });
    } else semDados.push(moeda);
  }
  return { cotacoes, semDados, erro: null };
}
