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

export type ErroCotacao = "limite" | "chave" | "sem-dados" | "rede";
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
    if (/rate limit|requests per|per day|per minute|frequency|premium/i.test(aviso)) return { erro: "limite" };
    if (/api key|apikey|demo/i.test(aviso)) return { erro: "chave" };
    return { erro: "limite" };
  }
  return { erro: "sem-dados" };
}

/** Pede a cotação de um ETF da Xetra. Usa o símbolo que já resultou antes, se houver. */
export async function pedirCotacao(ticker: string, chaveApi: string, simboloConhecido?: string, pedir: typeof fetch = fetch): Promise<RespostaCotacao> {
  const simbolos = simboloConhecido ? [simboloConhecido] : SUFIXOS_XETRA.map((s) => `${ticker.toUpperCase()}${s}`);
  let ultima: RespostaCotacao = { erro: "sem-dados" };
  for (const simbolo of simbolos) {
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
  limite: "O serviço de cotações atingiu o limite gratuito (25 pedidos por dia, 5 por minuto). Tente mais tarde ou indique a cotação à mão.",
  chave: "O serviço não aceitou a chave. Confirme-a ou peça uma nova em alphavantage.co.",
  "sem-dados": "O serviço não tem cotação para este ETF. Indique-a à mão.",
  rede: "Não foi possível ligar ao serviço de cotações. Verifique a internet.",
};
