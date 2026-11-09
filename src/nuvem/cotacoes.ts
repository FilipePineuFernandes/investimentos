// Cotações automáticas dos ETF da Xetra, pelo Alpha Vantage (chave gratuita do utilizador:
// 25 pedidos por dia e 5 por minuto). Não usa a corretora: pede só o código público do ETF.
// A app não envia dados pessoais: o pedido leva o código do ETF e a chave.

import { centimos } from "../calculo/util";

export interface CotacaoObtida {
  preco: number;
  /** Último dia de negociação (AAAA-MM-DD). */
  data: string;
  /** O símbolo que resultou (por exemplo EUNL.DEX). */
  simbolo: string;
}

/** "minuto": passou o limite de 5 pedidos por minuto (passa ao fim de um minuto); "limite": acabaram os 25 pedidos do dia. */
export type ErroCotacao = "limite" | "minuto" | "chave" | "sem-dados" | "rede";
export type RespostaCotacao = { ok: CotacaoObtida } | { erro: ErroCotacao };

/** Os sufixos que o Alpha Vantage usa para a Xetra: tenta-se um e, se não houver dados, o outro. */
export const SUFIXOS_XETRA = [".DEX", ".DE"];

/** Interpreta a resposta do Alpha Vantage a um pedido GLOBAL_QUOTE. */
export function lerResposta(json: unknown, simbolo: string): RespostaCotacao {
  const j = (json ?? {}) as Record<string, unknown>;
  const q = j["Global Quote"] as Record<string, string> | undefined;
  const preco = q ? Number(q["05. price"]) : NaN;
  const dia = q?.["07. latest trading day"];
  if (q && Number.isFinite(preco) && preco > 0 && typeof dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: { preco: centimos(preco), data: dia, simbolo } };

  const aviso = String(j["Note"] ?? j["Information"] ?? "");
  if (aviso) {
    if (/per day|daily/i.test(aviso)) return { erro: "limite" };
    if (/per minute|per second|frequency|spread out|burst/i.test(aviso)) return { erro: "minuto" };
    if (/rate limit|requests per|premium/i.test(aviso)) return { erro: "limite" };
    if (/api key|apikey|demo/i.test(aviso)) return { erro: "chave" };
    return { erro: "limite" };
  }
  return { erro: "sem-dados" };
}

/** Pede a cotação de um ETF da Xetra. Usa o símbolo que já resultou antes, se houver.
 *  antesDoPedido é chamado antes de cada pedido ao serviço (para os espaçar). */
export async function pedirCotacao(
  ticker: string,
  chaveApi: string,
  simboloConhecido?: string,
  pedir: typeof fetch = fetch,
  antesDoPedido: () => Promise<void> = async () => {},
): Promise<RespostaCotacao> {
  const simbolos = simboloConhecido ? [simboloConhecido] : SUFIXOS_XETRA.map((s) => `${ticker.toUpperCase()}${s}`);
  let ultima: RespostaCotacao = { erro: "sem-dados" };
  for (const simbolo of simbolos) {
    await antesDoPedido();
    try {
      const r = await pedir(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(simbolo)}&apikey=${encodeURIComponent(chaveApi)}`);
      if (!r.ok) return { erro: "rede" };
      ultima = lerResposta(await r.json(), simbolo);
    } catch {
      return { erro: "rede" };
    }
    if ("ok" in ultima || ultima.erro !== "sem-dados") return ultima;
  }
  return ultima;
}

export const MENSAGENS_ERRO: Record<ErroCotacao, string> = {
  limite: "Acabaram os 25 pedidos gratuitos de hoje. As restantes cotações atualizam-se amanhã, ao abrir a carteira.",
  minuto: "O serviço pediu para abrandar (5 pedidos por minuto). Tente daqui a um minuto.",
  chave: "O serviço não aceitou a chave. Confirme-a ou peça uma nova em alphavantage.co.",
  "sem-dados": "O serviço não tem cotação para este ETF.",
  rede: "Não foi possível ligar ao serviço de cotações. Verifique a internet.",
};

/** Intervalo entre pedidos: o plano gratuito aceita 5 por minuto. */
export const INTERVALO_PEDIDOS_MS = 13_000;

export interface EtfACotar {
  isin: string;
  ticker: string;
  /** Símbolo que já resultou antes (evita gastar um pedido a experimentar). */
  simbolo?: string;
}

export interface ResultadoSerie {
  atualizadas: number;
  /** Códigos sem cotação no serviço. */
  semDados: string[];
  /** Erro que fez parar (limite do dia, chave, ligação), ou null se correu tudo. */
  erro: ErroCotacao | null;
  /** ETF que ficaram por atualizar por causa do erro. */
  porFazer: number;
}

/** Atualiza vários ETF, um de cada vez, com os pedidos espaçados para não passar dos 5 por minuto.
 *  Se o serviço pedir para abrandar, espera um minuto e tenta de novo uma vez. Para no limite do dia. */
export async function atualizarEmSerie(
  etf: EtfACotar[],
  chaveApi: string,
  opcoes: {
    onCotacao: (isin: string, c: CotacaoObtida) => Promise<void>;
    onProgresso?: (feitos: number, total: number, ticker: string) => void;
    pedir?: typeof fetch;
    esperar?: (ms: number) => Promise<void>;
    intervaloMs?: number;
  },
): Promise<ResultadoSerie> {
  const esperar = opcoes.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const intervalo = opcoes.intervaloMs ?? INTERVALO_PEDIDOS_MS;
  let primeiro = true;
  const antesDoPedido = async () => {
    if (!primeiro) await esperar(intervalo);
    primeiro = false;
  };
  const r: ResultadoSerie = { atualizadas: 0, semDados: [], erro: null, porFazer: 0 };
  for (let i = 0; i < etf.length; i++) {
    const e = etf[i];
    opcoes.onProgresso?.(i, etf.length, e.ticker);
    let resposta = await pedirCotacao(e.ticker, chaveApi, e.simbolo, opcoes.pedir, antesDoPedido);
    if ("erro" in resposta && resposta.erro === "minuto") {
      await esperar(60_000);
      resposta = await pedirCotacao(e.ticker, chaveApi, e.simbolo, opcoes.pedir);
    }
    if ("ok" in resposta) {
      await opcoes.onCotacao(e.isin, resposta.ok);
      r.atualizadas++;
    } else if (resposta.erro === "sem-dados") {
      r.semDados.push(e.ticker);
    } else {
      r.erro = resposta.erro;
      r.porFazer = etf.length - i;
      break;
    }
  }
  return r;
}
