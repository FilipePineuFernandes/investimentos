// Taxas de juro médias do crédito à habitação, do Banco de Portugal (BPstat), como referência
// ao lado da proposta do banco (ponto 5.4). O BPstat aceita pedidos diretos da app.
// Os valores ficam guardados (cifrados) com a data da consulta e servem sem internet.

import { guardar, ler } from "./repositorio";

const API = "https://bpstat.bportugal.pt/data/v1/domains/21/datasets";

/** Séries do BPstat (domínio 21, taxas de juro), confirmadas em 24/10/2026. */
export const SERIES_BP = {
  /** Taxa de juro (TAA) de novas operações de empréstimos à habitação com taxa fixa até 1 ano (na prática, taxa variável). */
  taxaVariavel: { serie: 12533730, conjunto: "6eaa8db94523f54733dddc22479c11a4", nome: "Taxa média dos novos créditos à habitação com taxa variável" },
  /** TAEG de novos contratos (exclui renegociações) de empréstimos à habitação. */
  taeg: { serie: 12533714, conjunto: "5e42e78146bb44759188678266b04c4e", nome: "TAEG média dos novos contratos de crédito à habitação" },
} as const;

export type SerieBP = keyof typeof SERIES_BP;

export interface ValorBP {
  /** Em %. */
  valor: number;
  /** Último dia do mês a que se refere (AAAA-MM-DD). */
  data: string;
  consultadoEm: string;
}

export const urlSerieBP = (s: SerieBP) => `${API}/${SERIES_BP[s].conjunto}/?lang=PT&series_ids=${SERIES_BP[s].serie}`;

/**
 * Último valor de uma resposta JSON-stat do BPstat com uma só série. Os valores vêm por ordem
 * das datas (dimensão reference_date), numa lista ou num objeto com os índices como chaves.
 */
export function lerRespostaBP(j: unknown, agora = new Date()): ValorBP {
  const r = j as { value?: (number | null)[] | Record<string, number | null>; dimension?: { reference_date?: { category?: { index?: string[] | Record<string, number> } } } };
  const indice = r.dimension?.reference_date?.category?.index;
  const datas = Array.isArray(indice) ? indice : indice ? Object.keys(indice).sort((a, b) => indice[a] - indice[b]) : [];
  const valores = r.value ?? [];
  for (let k = datas.length - 1; k >= 0; k--) {
    const v = Array.isArray(valores) ? valores[k] : valores[String(k)];
    if (typeof v === "number") return { valor: v, data: datas[k], consultadoEm: agora.toISOString() };
  }
  throw new Error("Resposta do Banco de Portugal num formato inesperado.");
}

const UM_DIA = 86_400_000;

/**
 * Taxas de referência: usa as guardadas se tiverem menos de um dia; senão vai buscá-las ao
 * BPstat. Se falhar, devolve as últimas guardadas (ou null) e o erro.
 */
export async function obterTaxasBP(chave: CryptoKey, forcar = false): Promise<{ taxas: Partial<Record<SerieBP, ValorBP>>; erro: string | null }> {
  const taxas: Partial<Record<SerieBP, ValorBP>> = {};
  let erro: string | null = null;
  for (const s of Object.keys(SERIES_BP) as SerieBP[]) {
    const guardado = await ler<ValorBP>(chave, "referencia", `bp-${s}`);
    if (guardado && !forcar && Date.now() - new Date(guardado.consultadoEm).getTime() < UM_DIA) {
      taxas[s] = guardado;
      continue;
    }
    try {
      const r = await fetch(urlSerieBP(s));
      if (!r.ok) throw new Error(`O Banco de Portugal respondeu com o erro ${r.status}.`);
      taxas[s] = lerRespostaBP(await r.json());
      await guardar(chave, "referencia", `bp-${s}`, taxas[s]);
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
      if (guardado) taxas[s] = guardado;
    }
  }
  return { taxas, erro };
}
