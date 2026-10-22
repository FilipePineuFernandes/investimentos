// Carteira imobiliária e histórico (ponto 5.11 da especificação): valor atual, mais-valia
// latente, dívida em curso, capital próprio, evolução e resultado dos imóveis vendidos.

import { naCarteira, type Imovel } from "../dados/imoveis";
import type { AnaliseImovel } from "./imovel";
import { centimos, lerData, tirDatas } from "./util";

/** "AAAA-MM-DD" da data local. */
export function diaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Meses completos entre duas datas "AAAA-MM-DD". */
export function mesesEntre(inicio: string, fim: string): number {
  const a = lerData(inicio);
  const b = lerData(fim);
  if (!a || !b || b < a) return 0;
  const meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  return b.getUTCDate() < a.getUTCDate() ? meses - 1 : meses;
}

export interface PontoEvolucao {
  data: string;
  valor: number;
}

/** Valor do imóvel ao longo do tempo: o preço na data de compra e depois cada avaliação. */
export function evolucaoImovel(i: Imovel): PontoEvolucao[] {
  const c = i.carteira;
  const pontos: PontoEvolucao[] = [];
  if (c?.dataCompra && i.preco) pontos.push({ data: c.dataCompra, valor: i.preco });
  for (const a of c?.avaliacoes ?? []) pontos.push({ data: a.data, valor: a.valor });
  return pontos.sort((x, y) => x.data.localeCompare(y.data));
}

/** Última avaliação até à data, ou o preço de compra se ainda não houver avaliações. */
export function valorEm(i: Imovel, data: string): number | null {
  const anteriores = evolucaoImovel(i).filter((p) => p.data <= data);
  return anteriores.length > 0 ? anteriores[anteriores.length - 1].valor : (i.preco ?? null);
}

export interface Posicao {
  /** Preço + custos de compra + obras realizadas. */
  custoInvestido: number;
  valorAtual: number;
  /** Data da avaliação usada no valor atual, ou null se for o preço de compra. */
  avaliadoEm: string | null;
  maisValiaLatente: number;
  maisValiaPct: number;
  /** Capital em dívida hoje, pelo plano de pagamentos. Null se faltar a data de compra. */
  divida: number | null;
  /** Valor atual − dívida. */
  capitalProprio: number | null;
}

export function posicao(i: Imovel, a: AnaliseImovel, hoje: string): Posicao | null {
  if (!i.preco || !a.aquisicao) return null;
  const c = i.carteira;
  const custoInvestido = i.preco + a.aquisicao.total + (c?.obrasRealizadas ?? 0);
  const ultima = (c?.avaliacoes ?? []).filter((x) => x.data <= hoje).sort((x, y) => x.data.localeCompare(y.data)).pop();
  const valorAtual = ultima?.valor ?? i.preco;

  let divida: number | null = 0;
  if (i.financiamento && a.credito) {
    if (!c?.dataCompra) divida = null;
    else {
      const m = mesesEntre(c.dataCompra, hoje);
      const plano = a.credito.plano;
      divida = m === 0 ? (i.financiamento.montante ?? 0) : m >= plano.length ? 0 : plano[m - 1].divida;
    }
  }

  const latente = valorAtual - custoInvestido;
  return {
    custoInvestido: centimos(custoInvestido),
    valorAtual,
    avaliadoEm: ultima?.data ?? null,
    maisValiaLatente: centimos(latente),
    maisValiaPct: centimos((latente / custoInvestido) * 100),
    divida: divida === null ? null : centimos(divida),
    capitalProprio: divida === null ? null : centimos(valorAtual - divida),
  };
}

export interface ResultadoVenda {
  /** Venda − custos de venda − IRS + rendas líquidas − custo investido. */
  lucro: number;
  roi: number;
  /** TIR anual em %, entre a data de compra e a da venda. */
  tir: number | null;
}

/**
 * Resultado realizado de um imóvel vendido. Simplificação: considera o custo investido
 * todo na data de compra e o que recebeu todo na data da venda (não separa o crédito).
 */
export function resultadoVenda(i: Imovel, p: Posicao): ResultadoVenda | null {
  const c = i.carteira;
  const v = c?.venda;
  if (!v?.valor || !lerData(v.data) || !lerData(c!.dataCompra)) return null;
  const recebido = v.valor - (v.custos ?? 0) - (v.irs ?? 0) + (v.rendimentoLiquido ?? 0);
  const lucro = recebido - p.custoInvestido;
  const r = tirDatas([
    { data: lerData(c!.dataCompra)!, valor: -p.custoInvestido },
    { data: lerData(v.data)!, valor: recebido },
  ]);
  return { lucro: centimos(lucro), roi: centimos((lucro / p.custoInvestido) * 100), tir: Number.isFinite(r) ? centimos(r * 100) : null };
}

export interface ResumoCarteira {
  imoveis: number;
  valorAtual: number;
  custoInvestido: number;
  maisValiaLatente: number;
  divida: number;
  capitalProprio: number;
  /** Imóveis a que falta a data de compra (a dívida deles não entra). */
  semDataCompra: number;
  vendidos: number;
  lucroRealizado: number;
}

/** Totais dos imóveis em carteira (comprados e ainda não vendidos) e dos vendidos. */
export function resumoCarteira(imoveis: { i: Imovel; a: AnaliseImovel }[], hoje: string): ResumoCarteira {
  const r: ResumoCarteira = { imoveis: 0, valorAtual: 0, custoInvestido: 0, maisValiaLatente: 0, divida: 0, capitalProprio: 0, semDataCompra: 0, vendidos: 0, lucroRealizado: 0 };
  for (const { i, a } of imoveis) {
    if (!naCarteira(i)) continue;
    const p = posicao(i, a, hoje);
    if (!p) continue;
    if (i.estado === "vendido") {
      const v = resultadoVenda(i, p);
      r.vendidos++;
      r.lucroRealizado += v?.lucro ?? 0;
      continue;
    }
    r.imoveis++;
    r.valorAtual += p.valorAtual;
    r.custoInvestido += p.custoInvestido;
    r.maisValiaLatente += p.maisValiaLatente;
    if (p.divida === null) r.semDataCompra++;
    r.divida += p.divida ?? 0;
    r.capitalProprio += p.valorAtual - (p.divida ?? 0);
  }
  for (const k of ["valorAtual", "custoInvestido", "maisValiaLatente", "divida", "capitalProprio", "lucroRealizado"] as const) r[k] = centimos(r[k]);
  return r;
}

/**
 * Evolução do valor da carteira: em cada data em que algo mudou (uma compra, uma avaliação,
 * uma venda), a soma do último valor conhecido de cada imóvel que era seu nessa data.
 */
export function evolucaoCarteira(imoveis: Imovel[], hoje: string): PontoEvolucao[] {
  const comData = imoveis.filter((i) => naCarteira(i) && i.carteira?.dataCompra && i.preco);
  const datas = new Set<string>();
  for (const i of comData) {
    for (const p of evolucaoImovel(i)) if (p.data <= hoje) datas.add(p.data);
    if (i.carteira?.venda?.data && i.carteira.venda.data <= hoje) datas.add(i.carteira.venda.data);
  }
  return [...datas].sort().map((data) => ({
    data,
    valor: centimos(
      comData
        .filter((i) => i.carteira!.dataCompra <= data && !(i.carteira!.venda?.data && i.carteira!.venda.data <= data))
        .reduce((s, i) => s + (valorEm(i, data) ?? 0), 0),
    ),
  }));
}
