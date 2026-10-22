// Tabela pessoal de custos de obra (ponto 5.8): não existe fonte pública de preços de obra,
// por isso a app guarda os custos unitários que o utilizador usa (de orçamentos ou da sua
// tabela) e sugere-os nas obras seguintes, com a data da última revisão.

import type { Acabamento, EstrategiaReconstrucao, TipoTrabalho } from "./imoveis";
import { guardar, ler } from "./repositorio";

export interface ValorRevisto {
  valor: number;
  revistoEm: string; // AAAA-MM-DD
}

export interface TabelaCustosObra {
  trabalhos: Partial<Record<TipoTrabalho, ValorRevisto>>;
  /** € por m² da obra integral, por nível de acabamento. */
  integral: Partial<Record<Acabamento, ValorRevisto>>;
}

export const TABELA_VAZIA: TabelaCustosObra = { trabalhos: {}, integral: {} };

export const lerTabelaCustos = async (chave: CryptoKey) => (await ler<TabelaCustosObra>(chave, "tabela-custos-obra", "principal")) ?? TABELA_VAZIA;

/** Junta à tabela os custos usados numa obra. Só muda a data dos valores que mudaram. */
export function juntarCustos(t: TabelaCustosObra, e: EstrategiaReconstrucao, hoje = new Date().toISOString().slice(0, 10)): TabelaCustosObra {
  const novo: TabelaCustosObra = { trabalhos: { ...t.trabalhos }, integral: { ...t.integral } };
  const rever = <K extends string>(mapa: Partial<Record<K, ValorRevisto>>, k: K, valor: number | null) => {
    if (valor && mapa[k]?.valor !== valor) mapa[k] = { valor, revistoEm: hoje };
  };
  if (e.modo === "integral") rever(novo.integral, e.acabamento, e.custoM2);
  else for (const tr of e.trabalhos) if (tr.tipo !== "outro") rever(novo.trabalhos, tr.tipo, tr.custoUnitario);
  return novo;
}

export async function guardarCustosUsados(chave: CryptoKey, e: EstrategiaReconstrucao) {
  await guardar(chave, "tabela-custos-obra", "principal", juntarCustos(await lerTabelaCustos(chave), e));
}
