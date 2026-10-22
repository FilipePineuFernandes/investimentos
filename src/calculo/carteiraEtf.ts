// Carteira de ETF calculada a partir dos movimentos (pontos 6.9 e 6.11).
// As vendas usam o método FIFO: as primeiras unidades compradas são as primeiras vendidas,
// como manda a lei fiscal portuguesa. O preço médio aparece só como informação.

import type { Movimento } from "../dados/movimentosEtf";
import { valorParametro } from "../dados/parametros";
import { centimos } from "./util";

export interface Lote {
  data: string;
  quantidade: number;
  /** Custo por unidade, com a comissão da compra. */
  custoUnitario: number;
}

export interface VendaRealizada {
  data: string;
  quantidade: number;
  /** Valor recebido, já sem a comissão da venda. */
  receita: number;
  /** Custo FIFO das unidades vendidas. */
  custo: number;
  ganho: number;
  /** Unidades vendidas há menos de 365 dias (podem ter de ser englobadas). */
  quantidadeCurtoPrazo: number;
}

export interface PosicaoEtf {
  isin: string;
  quantidade: number;
  /** Custo das unidades que ainda tem (FIFO). */
  custo: number;
  precoMedio: number;
  /** Quantidade × cotação. Null sem cotação. */
  valorAtual: number | null;
  latente: number | null;
  latentePct: number | null;
  vendas: VendaRealizada[];
  realizado: number;
  dividendosBrutos: number;
  dividendosLiquidos: number;
  /** Vendas de mais unidades do que as que tinha, para corrigir. */
  erros: string[];
}

const DIA = 86_400_000;
const dias = (a: string, b: string) => (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DIA;
/** Arredonda quantidades a 6 casas, para os restos das frações não deixarem unidades fantasma. */
const q6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Posição num ETF a partir dos seus movimentos (por ordem de data) e da cotação atual. */
export function posicaoEtf(isin: string, movimentos: Movimento[], cotacao: number | null): PosicaoEtf {
  const lotes: Lote[] = [];
  const vendas: VendaRealizada[] = [];
  const erros: string[] = [];
  let dividendosBrutos = 0;
  let dividendosLiquidos = 0;

  for (const m of movimentos.filter((x) => x.isin === isin)) {
    if (m.tipo === "compra") {
      lotes.push({ data: m.data, quantidade: m.quantidade, custoUnitario: (m.quantidade * m.preco + m.comissao) / m.quantidade });
    } else if (m.tipo === "venda") {
      let falta = m.quantidade;
      let custo = 0;
      let curto = 0;
      while (q6(falta) > 0 && lotes.length > 0) {
        const lote = lotes[0];
        const usa = Math.min(lote.quantidade, falta);
        custo += usa * lote.custoUnitario;
        if (dias(lote.data, m.data) < 365) curto += usa;
        lote.quantidade = q6(lote.quantidade - usa);
        falta = q6(falta - usa);
        if (lote.quantidade <= 0) lotes.shift();
      }
      if (falta > 0) erros.push(`Venda de ${m.data}: vendeu mais ${falta.toLocaleString("pt-PT")} unidades do que as que tinha.`);
      const vendidas = m.quantidade - falta;
      const receita = vendidas * m.preco - m.comissao;
      vendas.push({ data: m.data, quantidade: vendidas, receita: centimos(receita), custo: centimos(custo), ganho: centimos(receita - custo), quantidadeCurtoPrazo: q6(curto) });
    } else {
      dividendosBrutos += m.valor;
      dividendosLiquidos += m.valor - m.imposto;
    }
  }

  const quantidade = q6(lotes.reduce((s, l) => s + l.quantidade, 0));
  const custo = lotes.reduce((s, l) => s + l.quantidade * l.custoUnitario, 0);
  const valorAtual = cotacao === null ? null : quantidade * cotacao;
  return {
    isin,
    quantidade,
    custo: centimos(custo),
    precoMedio: quantidade > 0 ? Math.round((custo / quantidade) * 10000) / 10000 : 0,
    valorAtual: valorAtual === null ? null : centimos(valorAtual),
    latente: valorAtual === null ? null : centimos(valorAtual - custo),
    latentePct: valorAtual === null || custo === 0 ? null : centimos(((valorAtual - custo) / custo) * 100),
    vendas,
    realizado: centimos(vendas.reduce((s, v) => s + v.ganho, 0)),
    dividendosBrutos: centimos(dividendosBrutos),
    dividendosLiquidos: centimos(dividendosLiquidos),
    erros,
  };
}

export interface ImpostoAno {
  ano: number;
  /** Mais-valias menos menos-valias das vendas do ano. */
  saldo: number;
  /** IRS à taxa especial sobre o saldo positivo. */
  imposto: number;
  /** Há vendas de unidades detidas há menos de 365 dias. */
  curtoPrazo: boolean;
}

/** Saldo das vendas de cada ano e o IRS estimado à taxa especial (28%). */
export function impostoPorAno(posicoes: PosicaoEtf[]): ImpostoAno[] {
  const anos = new Map<number, ImpostoAno>();
  const taxa = valorParametro("irs.mobiliario-taxa-liberatoria");
  for (const v of posicoes.flatMap((p) => p.vendas)) {
    const ano = Number(v.data.slice(0, 4));
    const a = anos.get(ano) ?? { ano, saldo: 0, imposto: 0, curtoPrazo: false };
    a.saldo += v.ganho;
    a.curtoPrazo ||= v.quantidadeCurtoPrazo > 0;
    anos.set(ano, a);
  }
  return [...anos.values()]
    .sort((a, b) => b.ano - a.ano)
    .map((a) => ({ ...a, saldo: centimos(a.saldo), imposto: centimos((Math.max(a.saldo, 0) * taxa) / 100) }));
}
