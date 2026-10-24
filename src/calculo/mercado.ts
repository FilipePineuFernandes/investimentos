// Valores de mercado e projeção do valor do imóvel (pontos 5.3 e 5.5 da especificação),
// a partir dos dados oficiais do INE. Quando não há dados, devolve null ("Não encontrado"):
// nunca há estimativas inventadas.

import type { Conservacao } from "../dados/imoveis";
import { fimPeriodo, municipioDe, type DadosIne } from "../dados/ine";
import { mesesEntre } from "./carteira";
import { centimos } from "./util";

/** Prazo a partir do qual um valor de referência do INE aparece como desatualizado. */
export const MESES_VALIDADE_INE = 12;

export interface ValorIne {
  /** € por m². */
  m2: number;
  /** € por m² × área. Null sem área. */
  total: number | null;
  /** Nível geográfico de onde veio: a freguesia, ou o município se a freguesia não tiver dados. */
  nivel: "freguesia" | "municipio";
  geocod: string;
  nome: string;
  periodo: string;
  desatualizado: boolean;
  /** Só nas vendas: categoria usada (novos, existentes ou total). */
  categoria?: "novos" | "existentes" | "total";
}

export interface Local {
  municipio: string | null;
  freguesia: string | null;
}

/** Códigos a tentar, do mais local para o mais geral. */
function niveis(l: Local): { geocod: string; nivel: ValorIne["nivel"] }[] {
  const lista: { geocod: string; nivel: ValorIne["nivel"] }[] = [];
  if (l.freguesia) lista.push({ geocod: l.freguesia, nivel: "freguesia" });
  const m = l.municipio ?? (l.freguesia ? municipioDe(l.freguesia) : null);
  if (m) lista.push({ geocod: m, nivel: "municipio" });
  return lista;
}

const desatualizado = (periodo: string, hoje: string) => mesesEntre(fimPeriodo(periodo), hoje) > MESES_VALIDADE_INE;

/** Mediana de venda por m² (preço de transação). Imóveis novos usam a mediana dos novos; os outros, a dos existentes. */
export function valorVenda(d: DadosIne, l: Local, area: number | null, conservacao: Conservacao, hoje: string): ValorIne | null {
  const periodo = d.vendas.periodos[d.vendas.periodos.length - 1];
  for (const { geocod, nivel } of niveis(l)) {
    const v = d.vendas.valores[geocod];
    if (!v) continue;
    const preferida = conservacao === "novo" ? v.n : v.e;
    const total = v.h[v.h.length - 1];
    const m2 = preferida ?? total;
    if (m2 === null) continue;
    return {
      m2,
      total: area ? centimos(m2 * area) : null,
      nivel,
      geocod,
      nome: d.nomes[geocod],
      periodo,
      desatualizado: desatualizado(periodo, hoje),
      categoria: preferida !== null ? (conservacao === "novo" ? "novos" : "existentes") : "total",
    };
  }
  return null;
}

/** Renda mediana por m² de novos contratos, no último período com valor. */
export function valorRenda(d: DadosIne, l: Local, area: number | null, hoje: string): ValorIne | null {
  for (const { geocod, nivel } of niveis(l)) {
    const serie = d.rendas.valores[geocod];
    if (!serie) continue;
    for (let k = serie.length - 1; k >= 0; k--) {
      const m2 = serie[k];
      if (m2 === null) continue;
      const periodo = d.rendas.periodos[k];
      return { m2, total: area ? centimos(m2 * area) : null, nivel, geocod, nome: d.nomes[geocod], periodo, desatualizado: desatualizado(periodo, hoje) };
    }
  }
  return null;
}

// --- Projeção (5.5) --------------------------------------------------------------------------

export interface Cenarios {
  /** Taxas anuais em %. */
  pessimista: number;
  base: number;
  otimista: number;
  /** Variações anuais usadas (da mais antiga para a mais recente), em %. */
  variacoes: { periodo: string; taxa: number }[];
  nivel: ValorIne["nivel"];
  nome: string;
}

/**
 * Cenários a partir do histórico da mediana de venda (total) da zona:
 * - pessimista: a pior variação anual dos últimos 5 anos, ou 0% se todas forem positivas;
 * - base: a média dos últimos 5 anos;
 * - otimista: a média dos últimos 3 anos.
 * Cada variação anual compara um trimestre com o mesmo trimestre do ano anterior.
 * Null se a zona não tiver 5 anos de histórico.
 */
export function cenarios(d: DadosIne, l: Local): Cenarios | null {
  const periodos = d.vendas.periodos;
  for (const { geocod, nivel } of niveis(l)) {
    const h = d.vendas.valores[geocod]?.h;
    if (!h) continue;
    const variacoes: Cenarios["variacoes"] = [];
    for (let k = h.length - 1; k >= 4 && variacoes.length < 5; k -= 4) {
      const agora = h[k];
      const antes = h[k - 4];
      if (agora === null || antes === null || antes === 0) break;
      variacoes.unshift({ periodo: periodos[k], taxa: ((agora - antes) / antes) * 100 });
    }
    if (variacoes.length < 5) continue;
    const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const taxas = variacoes.map((v) => v.taxa);
    const arred = (n: number) => Math.round(n * 100) / 100;
    return {
      pessimista: arred(Math.min(...taxas, 0)),
      base: arred(media(taxas)),
      otimista: arred(media(taxas.slice(-3))),
      variacoes: variacoes.map((v) => ({ ...v, taxa: arred(v.taxa) })),
      nivel,
      nome: d.nomes[geocod],
    };
  }
  return null;
}

/** Valor ao fim de n anos à taxa anual (em %). */
export const projetar = (valor: number, taxa: number, anos: number) => centimos(valor * Math.pow(1 + taxa / 100, anos));
