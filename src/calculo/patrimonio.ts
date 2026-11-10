// Carteira global (ponto 7 da especificação): os imóveis que tem (comprados, em obra,
// arrendados ou à venda) e os ETF que detém, com o lucro líquido de cada um desde a
// aquisição até hoje, separado entre imobiliário e ETF.
//
// Lucro líquido = valorização + rendas líquidas recebidas (só imóveis arrendados), em que:
// - valorização = valor de hoje − tudo o que pagou na aquisição. Nos imóveis: preço + impostos e
//   custos de compra + obras realizadas (ver carteira.ts). Nos ETF: custo das unidades que ainda
//   tem, com as comissões de compra (FIFO, ver carteiraEtf.ts);
// - rendas recebidas = a renda do contrato registada na ficha do imóvel, somada em cada dia 8 (dia
//   do pagamento) desde o início do contrato, ou o valor exato que o utilizador indicar.
// Não desconta os custos do arrendamento nem o IRS das rendas, nem o IRS que pagaria se vendesse hoje,
// nem os juros do crédito.

import { naCarteira, NOMES_ESTADO, type Imovel } from "../dados/imoveis";
import type { Movimento } from "../dados/movimentosEtf";
import { posicao, resultadoVenda } from "./carteira";
import type { PosicaoEtf } from "./carteiraEtf";
import type { AnaliseImovel } from "./imovel";
import { centimos } from "./util";

export interface Ativo {
  id: string;
  nome: string;
  /** Estado do imóvel, ou código e quantidade do ETF. */
  detalhe: string;
  /** Data da aquisição (do imóvel ou da primeira compra do ETF), se for conhecida. */
  desde: string | null;
  /** Tudo o que pagou na aquisição. Null se faltarem dados. */
  custo: number | null;
  /** Valor de hoje. Null se faltarem dados (por exemplo, ETF sem cotação). */
  valorAtual: number | null;
  /** Valor de hoje − custo. */
  valorizacao: number | null;
  /** Rendas líquidas recebidas (só imóveis arrendados). Null se não houver. */
  rendas: number | null;
  /** Como foram obtidas as rendas: "estimadas, 18 meses × 600 €" ou "valor indicado". */
  rendasNota?: string;
  /** Valorização + rendas. */
  lucro: number | null;
  lucroPct: number | null;
  /** O que falta para calcular o lucro. */
  falta?: string;
}

export interface Grupo {
  ativos: Ativo[];
  /** Somas só dos ativos com o lucro calculado. */
  custo: number;
  valorAtual: number;
  valorizacao: number;
  rendas: number;
  lucro: number;
  lucroPct: number | null;
  /** Ativos sem lucro calculado (ficam fora das somas). */
  incompletos: number;
}

function somar(ativos: Ativo[]): Grupo {
  const com = ativos.filter((a) => a.lucro !== null);
  const custo = centimos(com.reduce((s, a) => s + a.custo!, 0));
  const valorAtual = centimos(com.reduce((s, a) => s + a.valorAtual!, 0));
  const valorizacao = centimos(valorAtual - custo);
  const rendas = centimos(com.reduce((s, a) => s + (a.rendas ?? 0), 0));
  const lucro = centimos(valorizacao + rendas);
  return { ativos, custo, valorAtual, valorizacao, rendas, lucro, lucroPct: custo > 0 ? centimos((lucro / custo) * 100) : null, incompletos: ativos.length - com.length };
}

/** Dia do mês em que a renda é paga. */
export const DIA_DA_RENDA = 8;

/** Quantos dias 8 houve desde o início do contrato (inclusive) até hoje (inclusive): cada um é uma renda paga. */
export function pagamentosDeRenda(desde: string, hoje: string): number {
  const ini = /^(\d{4})-(\d{2})-\d{2}$/.exec(desde);
  const fim = /^(\d{4})-(\d{2})-\d{2}$/.exec(hoje);
  if (!ini || !fim) return 0;
  let n = 0;
  let ano = Number(ini[1]);
  let mes = Number(ini[2]);
  const ultimo = Number(fim[1]) * 12 + Number(fim[2]);
  while (ano * 12 + mes <= ultimo) {
    const dia = `${ano}-${String(mes).padStart(2, "0")}-${String(DIA_DA_RENDA).padStart(2, "0")}`;
    if (dia >= desde && dia <= hoje) n++;
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return n;
}

/** Rendas recebidas até hoje: o valor indicado pelo utilizador, ou a renda do contrato por cada dia 8 passado. */
export function rendasRecebidas(i: Imovel, hoje: string): { valor: number; nota: string } | null {
  const c = i.carteira;
  if (c?.rendasRecebidas !== null && c?.rendasRecebidas !== undefined) return { valor: centimos(c.rendasRecebidas), nota: "valor indicado por si" };
  if (!c?.arrendadoDesde || !c.rendaContrato) return null;
  const n = pagamentosDeRenda(c.arrendadoDesde, hoje);
  const fmt = (v: number) => v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  return { valor: centimos(c.rendaContrato * n), nota: `${n} ${n === 1 ? "renda paga" : "rendas pagas"} × ${fmt(c.rendaContrato)} (dia ${DIA_DA_RENDA} de cada mês)` };
}

/** Imóveis em posse: os da carteira que ainda não foram vendidos (inclui os arrendados). */
export function grupoImobiliario(imoveis: { i: Imovel; a: AnaliseImovel }[], hoje: string): Grupo {
  const ativos: Ativo[] = [];
  for (const { i, a } of imoveis) {
    if (!naCarteira(i) || i.estado === "vendido") continue;
    const p = posicao(i, a, hoje);
    const rendas = p ? rendasRecebidas(i, hoje) : null;
    const lucro = p ? centimos(p.maisValiaLatente + (rendas?.valor ?? 0)) : null;
    ativos.push({
      id: i.id,
      nome: i.nome || i.morada || "Imóvel sem nome",
      detalhe: NOMES_ESTADO[i.estado],
      desde: i.carteira?.dataCompra || null,
      custo: p?.custoInvestido ?? null,
      valorAtual: p?.valorAtual ?? null,
      valorizacao: p?.maisValiaLatente ?? null,
      rendas: rendas?.valor ?? null,
      rendasNota: rendas?.nota,
      lucro,
      lucroPct: p && lucro !== null ? centimos((lucro / p.custoInvestido) * 100) : null,
      falta: p ? undefined : "Falta o preço de compra ou os dados para os custos de aquisição.",
    });
  }
  return somar(ativos);
}

/** ETF em posse: as posições com unidades. */
export function grupoEtf(posicoes: PosicaoEtf[], movimentos: Movimento[], nomes: Record<string, { nome: string; ticker: string }>): Grupo {
  const ativos: Ativo[] = posicoes
    .filter((p) => p.quantidade > 0)
    .map((p) => {
      const n = nomes[p.isin];
      const compras = movimentos.filter((m) => m.isin === p.isin && m.tipo === "compra").map((m) => m.data).sort();
      return {
        id: p.isin,
        nome: n?.nome || p.isin,
        detalhe: `${n?.ticker ? `${n.ticker} · ` : ""}${p.quantidade.toLocaleString("pt-PT", { maximumFractionDigits: 6 })} unidades`,
        desde: compras[0] ?? null,
        custo: p.custo,
        valorAtual: p.valorAtual,
        valorizacao: p.latente,
        rendas: null,
        lucro: p.latente,
        lucroPct: p.latentePct,
        falta: p.valorAtual === null ? "Falta a cotação de hoje: indique-a na carteira de ETF." : undefined,
      };
    });
  return somar(ativos);
}

/** Criptomoedas em posse: as moedas com quantidade (a moeda faz de identificador da posição). */
export function grupoCripto(posicoes: PosicaoEtf[], primeiraCompra: Record<string, string>): Grupo {
  const ativos: Ativo[] = posicoes
    .filter((p) => p.quantidade > 0)
    .map((p) => ({
      id: p.isin,
      nome: p.isin,
      detalhe: `${p.quantidade.toLocaleString("pt-PT", { maximumFractionDigits: 8 })} ${p.isin}`,
      desde: primeiraCompra[p.isin] ?? null,
      custo: p.custo,
      valorAtual: p.valorAtual,
      valorizacao: p.latente,
      rendas: null,
      lucro: p.latente,
      lucroPct: p.latentePct,
      falta: p.valorAtual === null ? "Falta a cotação: abra a carteira de cripto para a atualizar." : undefined,
    }));
  return somar(ativos);
}

/** Um imóvel vendido: já não está na carteira, mas o lucro realizado conta para o resultado. */
export interface Vendido {
  id: string;
  nome: string;
  dataVenda: string;
  /** Preço, custos de compra e obras. */
  custo: number;
  /** Valor de venda − despesas da venda − IRS + rendas líquidas. */
  recebido: number;
  lucro: number;
  lucroPct: number;
}

export interface GrupoVendidos {
  ativos: Vendido[];
  custo: number;
  lucro: number;
  /** Vendidos a que faltam dados (data de compra, data ou valor da venda): ficam fora das somas. */
  incompletos: string[];
}

/** Lucro realizado = (valor de venda − despesas da venda − IRS + rendas líquidas) − custo global do imóvel. */
export function grupoVendidos(imoveis: { i: Imovel; a: AnaliseImovel }[], hoje: string): GrupoVendidos {
  const ativos: Vendido[] = [];
  const incompletos: string[] = [];
  for (const { i, a } of imoveis) {
    if (i.estado !== "vendido") continue;
    const nome = i.nome || i.morada || "Imóvel sem nome";
    const p = posicao(i, a, hoje);
    const r = p ? resultadoVenda(i, p) : null;
    if (!p || !r) {
      incompletos.push(nome);
      continue;
    }
    ativos.push({ id: i.id, nome, dataVenda: i.carteira!.venda!.data, custo: p.custoInvestido, recebido: centimos(p.custoInvestido + r.lucro), lucro: r.lucro, lucroPct: r.roi });
  }
  return { ativos, custo: centimos(ativos.reduce((s, v) => s + v.custo, 0)), lucro: centimos(ativos.reduce((s, v) => s + v.lucro, 0)), incompletos };
}

export interface Total {
  /** O que pagou pelos ativos que ainda tem. */
  custo: number;
  valorAtual: number;
  /** Lucro dos ativos em posse mais o lucro realizado nos imóveis vendidos. */
  lucro: number;
  /** Só a parte realizada nas vendas. */
  lucroRealizado: number;
  /** Sobre tudo o que pagou, incluindo os imóveis já vendidos. */
  lucroPct: number | null;
}

export function totalCarteira(imobiliario: Grupo, etf: Grupo, vendidos?: GrupoVendidos, cripto?: Grupo): Total {
  const custo = centimos(imobiliario.custo + etf.custo + (cripto?.custo ?? 0));
  const valorAtual = centimos(imobiliario.valorAtual + etf.valorAtual + (cripto?.valorAtual ?? 0));
  const lucroRealizado = vendidos?.lucro ?? 0;
  const lucro = centimos(imobiliario.lucro + etf.lucro + (cripto?.lucro ?? 0) + lucroRealizado);
  const base = custo + (vendidos?.custo ?? 0);
  return { custo, valorAtual, lucro, lucroRealizado, lucroPct: base > 0 ? centimos((lucro / base) * 100) : null };
}
