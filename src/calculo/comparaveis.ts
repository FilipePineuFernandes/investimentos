// Comparação dos anúncios registados (ponto 5.3, nível 2): mínimo, máximo e mediana em € e
// em €/m², por tipologia e por portal, e posição do imóvel face a eles. Os leilões, os
// arrendamentos temporários e os quartos ficam à parte, para não distorcer o mercado.

import type { Comparavel } from "../dados/imoveis";
import type { Operacao, Segmento } from "./portais";
import { centimos } from "./util";

export interface Estatistica {
  n: number;
  min: number;
  max: number;
  mediana: number;
  /** Só com os anúncios que têm área. Null se nenhum tiver. */
  m2: { n: number; min: number; max: number; mediana: number } | null;
}

export function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function estatistica(lista: Comparavel[]): Estatistica | null {
  if (lista.length === 0) return null;
  const precos = lista.map((c) => c.preco);
  const m2 = lista.filter((c) => c.area && c.area > 0).map((c) => c.preco / c.area!);
  return {
    n: lista.length,
    min: Math.min(...precos),
    max: Math.max(...precos),
    mediana: centimos(mediana(precos)),
    m2: m2.length === 0 ? null : { n: m2.length, min: centimos(Math.min(...m2)), max: centimos(Math.max(...m2)), mediana: centimos(mediana(m2)) },
  };
}

export interface Comparacao {
  /** Anúncios de mercado da mesma tipologia do imóvel. */
  mesmaTipologia: Estatistica | null;
  /** Anúncios de mercado de cada tipologia. */
  porTipologia: { tipologia: string; e: Estatistica }[];
  /** Mediana €/m² dos anúncios de mercado da mesma tipologia, por portal. */
  porPortal: { portal: string | null; e: Estatistica }[];
  /** Leilões, temporários e quartos, cada um à parte. */
  aParte: { segmento: Segmento; e: Estatistica }[];
  /** Diferença do €/m² do imóvel para a mediana da mesma tipologia, em %. Null se faltarem dados. */
  posicao: number | null;
}

/**
 * @param valor  preço de compra (venda) ou renda mensal do imóvel (arrendamento), para a posição.
 */
export function comparar(lista: Comparavel[], operacao: Operacao, tipologia: string | null, valor: number | null, area: number | null): Comparacao {
  const daOperacao = lista.filter((c) => c.operacao === operacao);
  const mercado = daOperacao.filter((c) => c.segmento === "mercado");
  const mesma = tipologia ? mercado.filter((c) => c.tipologia === tipologia) : mercado;

  const agrupar = <K>(xs: Comparavel[], chave: (c: Comparavel) => K) => {
    const m = new Map<K, Comparavel[]>();
    for (const c of xs) m.set(chave(c), [...(m.get(chave(c)) ?? []), c]);
    return [...m.entries()];
  };

  const mesmaTipologia = estatistica(mesma);
  const posicao = valor && area && mesmaTipologia?.m2 ? Math.round(((valor / area - mesmaTipologia.m2.mediana) / mesmaTipologia.m2.mediana) * 1000) / 10 : null;

  return {
    mesmaTipologia,
    porTipologia: agrupar(mercado, (c) => c.tipologia)
      .map(([t, xs]) => ({ tipologia: t, e: estatistica(xs)! }))
      .sort((a, b) => a.tipologia.localeCompare(b.tipologia)),
    porPortal: agrupar(mesma, (c) => c.portal)
      .map(([p, xs]) => ({ portal: p, e: estatistica(xs)! }))
      .sort((a, b) => b.e.n - a.e.n),
    aParte: agrupar(
      daOperacao.filter((c) => c.segmento !== "mercado"),
      (c) => c.segmento,
    ).map(([s, xs]) => ({ segmento: s, e: estatistica(xs)! })),
    posicao,
  };
}
