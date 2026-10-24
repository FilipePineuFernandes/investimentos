// Euribor a 3, 6 e 12 meses, do Banco Central Europeu (ECB Data Portal): média mensal.
// O BCE aceita pedidos diretos da app. O último valor obtido fica guardado (cifrado) com a
// data da consulta, e é usado sem internet, com aviso se tiver mais de um dia.

import type { Indexante } from "./imoveis";
import { guardar, ler } from "./repositorio";

const SERIES: Record<Indexante, string> = {
  euribor3: "EURIBOR3MD_",
  euribor6: "EURIBOR6MD_",
  euribor12: "EURIBOR1YD_",
};

export interface ValorEuribor {
  indexante: Indexante;
  /** Em %. */
  valor: number;
  /** Mês da média, "AAAA-MM". */
  periodo: string;
  /** Quando a app foi buscar o valor (ISO). */
  consultadoEm: string;
}

export const urlEuribor = (i: Indexante) => `https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.${SERIES[i]}.HSTA?format=jsondata&lastNObservations=1`;

/** Lê a resposta SDMX-JSON do BCE. Lança erro se o formato não for o esperado. */
export function lerRespostaBce(i: Indexante, j: unknown, agora = new Date()): ValorEuribor {
  const r = j as {
    dataSets: { series: Record<string, { observations: Record<string, [number]> }> }[];
    structure: { dimensions: { observation: { values: { id: string }[] }[] } };
  };
  const serie = Object.values(r.dataSets?.[0]?.series ?? {})[0];
  const chave = Object.keys(serie?.observations ?? {}).pop();
  const valor = chave === undefined ? NaN : Number(serie.observations[chave][0]);
  const periodo = r.structure?.dimensions?.observation?.[0]?.values?.[Number(chave)]?.id;
  if (!Number.isFinite(valor) || !periodo) throw new Error("Resposta do BCE num formato inesperado.");
  return { indexante: i, valor: Math.round(valor * 1000) / 1000, periodo, consultadoEm: agora.toISOString() };
}

/** Vai buscar a Euribor ao BCE e guarda-a. Se falhar, devolve a última guardada (ou null). */
export async function obterEuribor(chave: CryptoKey, i: Indexante): Promise<{ v: ValorEuribor | null; erro: string | null }> {
  try {
    const r = await fetch(urlEuribor(i));
    if (!r.ok) throw new Error(`O BCE respondeu com o erro ${r.status}.`);
    const v = lerRespostaBce(i, await r.json());
    await guardar(chave, "referencia", i, v);
    return { v, erro: null };
  } catch (e) {
    const guardado = (await ler<ValorEuribor>(chave, "referencia", i)) ?? null;
    return { v: guardado, erro: e instanceof Error ? e.message : String(e) };
  }
}

export const lerEuriborGuardada = async (chave: CryptoKey, i: Indexante) => (await ler<ValorEuribor>(chave, "referencia", i)) ?? null;
