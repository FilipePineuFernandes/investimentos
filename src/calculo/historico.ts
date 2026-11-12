// Histórico da carteira global: as séries no tempo (valor, custo e lucro de cada imóvel e de cada
// ETF, e as somas) para os gráficos de comparação, e a lista de acontecimentos (compras,
// avaliações, rendas, vendas, movimentos de ETF).
//
// - Imóveis: o valor é a última avaliação conhecida em cada data (ou o preço de compra); o custo é
//   o que pagou (preço, custos de compra e obras); o lucro soma ainda as rendas já recebidas nessa data
//   (a renda do contrato em cada dia 8, como na carteira global).
// - ETF: a app só guarda a cotação de hoje. Antes de hoje, o valor é o que pagou pelas unidades que tinha e
//   o lucro só passa a ser conhecido hoje.
// Só entram os ativos em posse (como na carteira global).

import { naCarteira, type Imovel } from "../dados/imoveis";
import type { Movimento } from "../dados/movimentosEtf";
import { posicao, valorEm } from "./carteira";
import { posicaoEtf } from "./carteiraEtf";
import type { AnaliseImovel } from "./imovel";
import { DIA_DA_RENDA, pagamentosDeRenda } from "./patrimonio";
import { centimos } from "./util";

export interface PontoHistorico {
  data: string;
  valor: number;
  /** O que pagou até esta data. */
  custo: number;
  /** Valor − custo + rendas recebidas. */
  lucro: number;
}

export interface SerieHistorico {
  id: string;
  nome: string;
  tipo: "total" | "imobiliario" | "etf" | "imovel" | "etfAtivo";
  pontos: PontoHistorico[];
}

export type Metrica = "valor" | "custo" | "lucro" | "lucroPct";

export const NOMES_METRICA: Record<Metrica, string> = { valor: "Valor", custo: "O que pagou", lucro: "Lucro líquido (€)", lucroPct: "Lucro líquido (%)" };

/** O número que a métrica escolhida tem neste ponto (null se não se pode calcular). */
export function valorDaMetrica(p: PontoHistorico, m: Metrica): number | null {
  if (m === "valor") return p.valor;
  if (m === "custo") return p.custo;
  if (m === "lucro") return p.lucro;
  return p.custo > 0 ? centimos((p.lucro / p.custo) * 100) : null;
}

/** O ponto em vigor numa data: o último até essa data (null antes do primeiro). */
export function pontoEm(s: SerieHistorico, data: string): PontoHistorico | null {
  let r: PontoHistorico | null = null;
  for (const p of s.pontos) {
    if (p.data > data) break;
    r = p;
  }
  return r;
}

/** Todos os dias 8 entre duas datas (inclusive): os dias em que a renda é paga. */
function diasDeRenda(desde: string, hoje: string): string[] {
  const ini = /^(\d{4})-(\d{2})-\d{2}$/.exec(desde);
  const fim = /^(\d{4})-(\d{2})-\d{2}$/.exec(hoje);
  if (!ini || !fim) return [];
  const dias: string[] = [];
  let ano = Number(ini[1]);
  let mes = Number(ini[2]);
  const ultimo = Number(fim[1]) * 12 + Number(fim[2]);
  while (ano * 12 + mes <= ultimo) {
    const dia = `${ano}-${String(mes).padStart(2, "0")}-${String(DIA_DA_RENDA).padStart(2, "0")}`;
    if (dia >= desde && dia <= hoje) dias.push(dia);
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return dias;
}

/** Rendas recebidas até uma data. Se o utilizador indicou o total exato de hoje, reparte-o pela estimativa. */
function rendasAte(i: Imovel, data: string, hoje: string): number {
  const c = i.carteira;
  if (!c) return 0;
  const estimar = (dia: string) => (c.arrendadoDesde && c.rendaContrato ? c.rendaContrato * pagamentosDeRenda(c.arrendadoDesde, dia) : 0);
  if (c.rendasRecebidas !== null && c.rendasRecebidas !== undefined) {
    const total = estimar(hoje);
    if (total > 0) return (c.rendasRecebidas * estimar(data)) / total;
    return data >= hoje ? c.rendasRecebidas : 0;
  }
  return estimar(data);
}

/** A série de um imóvel em posse. Null se faltarem o preço, os custos ou a data de compra. */
export function serieImovel(i: Imovel, a: AnaliseImovel, hoje: string): SerieHistorico | null {
  if (!naCarteira(i) || i.estado === "vendido") return null;
  const p = posicao(i, a, hoje);
  const compra = i.carteira?.dataCompra;
  if (!p || !compra || compra > hoje) return null;

  const datas = new Set<string>([compra, hoje]);
  for (const av of i.carteira!.avaliacoes) if (av.data > compra && av.data <= hoje) datas.add(av.data);
  if (i.carteira!.arrendadoDesde && i.carteira!.rendaContrato) for (const d of diasDeRenda(i.carteira!.arrendadoDesde, hoje)) if (d > compra) datas.add(d);

  return {
    id: i.id,
    nome: i.nome || i.morada || "Imóvel sem nome",
    tipo: "imovel",
    pontos: [...datas].sort().map((data) => {
      const valor = valorEm(i, data) ?? i.preco!;
      return { data, valor: centimos(valor), custo: p.custoInvestido, lucro: centimos(valor - p.custoInvestido + rendasAte(i, data, hoje)) };
    }),
  };
}

/**
 * A série de um ETF em posse. Null se já não tem unidades. Com o histórico das cotações guardado,
 * o valor em cada dia é unidades × cotação desse dia (a última conhecida até lá); sem cotação
 * conhecida nessa data, conta o que pagou.
 */
export function serieEtf(
  isin: string,
  nome: string,
  movimentos: Movimento[],
  cotacao: number | null,
  hoje: string,
  precos: { data: string; preco: number }[] = [],
): SerieHistorico | null {
  const meus = movimentos.filter((m) => m.isin === isin && m.data <= hoje);
  if (posicaoEtf(isin, meus, cotacao).quantidade <= 0) return null;
  const primeira = meus.map((m) => m.data).sort()[0] ?? hoje;
  const datas = new Set<string>([hoje, ...meus.map((m) => m.data), ...precos.filter((p) => p.data >= primeira && p.data < hoje).map((p) => p.data)]);
  /** A cotação em vigor numa data: a última do histórico até essa data. */
  // O preço das compras e vendas também é uma cotação conhecida nesse dia.
  const porDia = new Map(precos.map((p) => [p.data, p.preco]));
  for (const m of meus) if (m.tipo !== "dividendo" && m.preco > 0) porDia.set(m.data, m.preco);
  const conhecidos = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, preco]) => ({ data, preco }));
  const precoEm = (data: string): number | null => {
    // Hoje conta só a cotação atual (sem ela, o que pagou), como no resumo da carteira.
    if (data === hoje) return cotacao;
    let r: number | null = null;
    for (const p of conhecidos) {
      if (p.data > data) break;
      r = p.preco;
    }
    return r;
  };
  return {
    id: isin,
    nome,
    tipo: "etfAtivo",
    pontos: [...datas].sort().map((data) => {
      const p = posicaoEtf(isin, meus.filter((m) => m.data <= data), precoEm(data));
      return { data, valor: p.valorAtual ?? p.custo, custo: p.custo, lucro: p.latente ?? 0 };
    }),
  };
}

/** Soma séries: em cada data, o ponto em vigor de cada uma (as que ainda não existiam não contam). */
export function somarSeries(id: string, nome: string, tipo: SerieHistorico["tipo"], series: SerieHistorico[]): SerieHistorico | null {
  if (series.length === 0) return null;
  const datas = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.data)))].sort();
  return {
    id,
    nome,
    tipo,
    pontos: datas.map((data) => {
      let valor = 0;
      let custo = 0;
      let lucro = 0;
      for (const s of series) {
        const p = pontoEm(s, data);
        if (!p) continue;
        valor += p.valor;
        custo += p.custo;
        lucro += p.lucro;
      }
      return { data, valor: centimos(valor), custo: centimos(custo), lucro: centimos(lucro) };
    }),
  };
}

export interface HistoricoCarteira {
  /** Total da carteira, imobiliário e ETF (as que existirem). */
  somas: SerieHistorico[];
  /** Cada imóvel e cada ETF. */
  ativos: SerieHistorico[];
  /** Imóveis em posse que ficam fora dos gráficos por falta de dados (ex.: data de compra). */
  fora: string[];
}

export function historicoCarteira(
  imoveis: { i: Imovel; a: AnaliseImovel }[],
  movimentos: Movimento[],
  cotacoes: Record<string, number | null>,
  nomesEtf: Record<string, string>,
  hoje: string,
  /** Histórico das cotações de cada ETF (por ISIN), por ordem de data. */
  precos: Record<string, { data: string; preco: number }[]> = {},
): HistoricoCarteira {
  const fora: string[] = [];
  const seriesImoveis: SerieHistorico[] = [];
  for (const { i, a } of imoveis) {
    if (!naCarteira(i) || i.estado === "vendido") continue;
    const s = serieImovel(i, a, hoje);
    if (s) seriesImoveis.push(s);
    else fora.push(i.nome || i.morada || "Imóvel sem nome");
  }
  const seriesEtf = [...new Set(movimentos.map((m) => m.isin))]
    .map((isin) => serieEtf(isin, nomesEtf[isin] || isin, movimentos, cotacoes[isin] ?? null, hoje, precos[isin] ?? []))
    .filter((s): s is SerieHistorico => s !== null);

  const somas = [
    somarSeries("total", "Total da carteira", "total", [...seriesImoveis, ...seriesEtf]),
    somarSeries("imobiliario", "Imobiliário", "imobiliario", seriesImoveis),
    somarSeries("etf", "ETF", "etf", seriesEtf),
  ].filter((s): s is SerieHistorico => s !== null);
  return { somas, ativos: [...seriesImoveis, ...seriesEtf], fora };
}

export interface Acontecimento {
  data: string;
  /** "Imóvel" ou "ETF". */
  area: "Imóvel" | "ETF";
  ativo: string;
  descricao: string;
  valor: number | null;
}

/** Tudo o que aconteceu na carteira, do mais recente para o mais antigo. */
export function acontecimentos(imoveis: Imovel[], movimentos: Movimento[], nomesEtf: Record<string, string>): Acontecimento[] {
  const lista: Acontecimento[] = [];
  for (const i of imoveis) {
    const c = i.carteira;
    if (!naCarteira(i) || !c) continue;
    const ativo = i.nome || i.morada || "Imóvel sem nome";
    const add = (data: string, descricao: string, valor: number | null) => data && lista.push({ data, area: "Imóvel", ativo, descricao, valor });
    add(c.dataCompra, "Compra (escritura)", i.preco);
    for (const av of c.avaliacoes) add(av.data, "Avaliação", av.valor);
    if (c.arrendadoDesde) add(c.arrendadoDesde, "Início do arrendamento", c.rendaContrato ?? null);
    if (c.venda?.data) add(c.venda.data, "Venda", c.venda.valor);
  }
  const verbo = { compra: "Compra", venda: "Venda", dividendo: "Dividendo" } as const;
  for (const m of movimentos) {
    lista.push({
      data: m.data,
      area: "ETF",
      ativo: nomesEtf[m.isin] || m.isin,
      descricao: m.tipo === "dividendo" ? verbo.dividendo : `${verbo[m.tipo]} de ${m.quantidade.toLocaleString("pt-PT", { maximumFractionDigits: 6 })} unidades`,
      valor: m.tipo === "dividendo" ? m.valor : centimos(m.quantidade * m.preco),
    });
  }
  return lista.sort((x, y) => y.data.localeCompare(x.data));
}
