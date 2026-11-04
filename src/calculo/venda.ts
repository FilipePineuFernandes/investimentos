// Venda de um imóvel: as despesas da venda (mediação com IVA, declaração de condomínio, certificado
// energético e outras) e as rendas recebidas até à data da venda. O lucro realizado é calculado em
// carteira.ts (resultadoVenda) e entra no resultado da carteira global.

import type { Imovel, VendaRealizada } from "../dados/imoveis";
import { valorParametro } from "../dados/parametros";
import { pagamentosDeRenda } from "./patrimonio";
import { centimos } from "./util";

export interface DespesasVenda {
  /** Comissão de mediação sem IVA. */
  mediacao: number;
  /** IVA da comissão, à taxa em vigor. */
  iva: number;
  taxaIva: number;
  declaracaoCondominio: number;
  certificadoEnergetico: number;
  outras: number;
  total: number;
}

/** As despesas da venda: mediação (% do valor de venda) + IVA, e as restantes despesas indicadas. */
export function despesasVenda(v: VendaRealizada): DespesasVenda {
  const taxaIva = valorParametro("iva.taxa-normal");
  const mediacao = v.mediacao && v.valor && v.mediacaoPct ? centimos((v.valor * v.mediacaoPct) / 100) : 0;
  const iva = centimos((mediacao * taxaIva) / 100);
  const declaracaoCondominio = v.declaracaoCondominio ?? 0;
  const certificadoEnergetico = v.certificadoEnergetico ?? 0;
  const outras = v.outrasDespesas ?? 0;
  return { mediacao, iva, taxaIva, declaracaoCondominio, certificadoEnergetico, outras, total: centimos(mediacao + iva + declaracaoCondominio + certificadoEnergetico + outras) };
}

/** Rendas recebidas até uma data: o valor indicado pelo utilizador, ou a renda do contrato em cada dia 8. Null se não esteve arrendado. */
export function rendasAteData(i: Imovel, data: string): number | null {
  const c = i.carteira;
  if (c?.rendasRecebidas !== null && c?.rendasRecebidas !== undefined) return centimos(c.rendasRecebidas);
  if (!c?.arrendadoDesde || !c.rendaContrato) return null;
  return centimos(c.rendaContrato * pagamentosDeRenda(c.arrendadoDesde, data));
}
