// Carteira global (ponto 7 da especificação): os imóveis que tem (comprados, em obra,
// arrendados ou à venda) e os ETF que detém, com o lucro líquido de cada um desde a
// aquisição até hoje, separado entre imobiliário e ETF.
//
// Lucro líquido = valorização + rendas líquidas recebidas (só imóveis arrendados), em que:
// - valorização = valor de hoje − tudo o que pagou na aquisição. Nos imóveis: preço + impostos e
//   custos de compra + obras realizadas (ver carteira.ts). Nos ETF: custo das unidades que ainda
//   tem, com as comissões de compra (FIFO, ver carteiraEtf.ts);
// - rendas líquidas = renda do contrato − condomínio, seguros, manutenção, gestão e IMI − IRS,
//   pelos meses desde o início do contrato (o mesmo cálculo da estratégia de arrendamento), ou o
//   valor exato que o utilizador indicar.
// Não desconta o IRS que pagaria se vendesse hoje, nem os juros do crédito.

import { ARRENDAMENTO_VAZIO, naCarteira, NOMES_ESTADO, type Imovel } from "../dados/imoveis";
import type { Perfil } from "../dados/perfil";
import { calcularArrendamento } from "./arrendamento";
import type { Movimento } from "../dados/movimentosEtf";
import { mesesEntre, posicao } from "./carteira";
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

/** Rendas líquidas recebidas até hoje: o valor indicado pelo utilizador, ou a estimativa pelo contrato. */
export function rendasRecebidas(i: Imovel, a: AnaliseImovel, perfil: Perfil | undefined, hoje: string): { valor: number; nota: string } | null {
  const c = i.carteira;
  if (c?.rendasRecebidas !== null && c?.rendasRecebidas !== undefined) return { valor: centimos(c.rendasRecebidas), nota: "valor indicado por si" };
  if (!c?.arrendadoDesde || !c.rendaContrato) return null;
  const meses = mesesEntre(c.arrendadoDesde, hoje);
  const r = calcularArrendamento(i, a, { ...(i.arrendamento ?? ARRENDAMENTO_VAZIO), rendaMensal: c.rendaContrato, mesesVazioAno: 0 }, perfil);
  if (!("rendimentoPredial" in r)) return null;
  const mensal = centimos((r.rendimentoPredial - r.irs) / 12);
  const fmt = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  return { valor: centimos(mensal * meses), nota: `estimadas: ${meses} ${meses === 1 ? "mês" : "meses"} × ${fmt(mensal)} líquidos` };
}

/** Imóveis em posse: os da carteira que ainda não foram vendidos (inclui os arrendados). */
export function grupoImobiliario(imoveis: { i: Imovel; a: AnaliseImovel }[], hoje: string, perfil?: Perfil): Grupo {
  const ativos: Ativo[] = [];
  for (const { i, a } of imoveis) {
    if (!naCarteira(i) || i.estado === "vendido") continue;
    const p = posicao(i, a, hoje);
    const rendas = p ? rendasRecebidas(i, a, perfil, hoje) : null;
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

export interface Total {
  custo: number;
  valorAtual: number;
  lucro: number;
  lucroPct: number | null;
}

export function totalCarteira(imobiliario: Grupo, etf: Grupo): Total {
  const custo = centimos(imobiliario.custo + etf.custo);
  const valorAtual = centimos(imobiliario.valorAtual + etf.valorAtual);
  const lucro = centimos(imobiliario.lucro + etf.lucro);
  return { custo, valorAtual, lucro, lucroPct: custo > 0 ? centimos((lucro / custo) * 100) : null };
}
