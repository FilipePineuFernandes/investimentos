// IRS: escalões, englobamento e taxas autónomas das rendas.

import { TABELA_IRS, valorParametro } from "../dados/parametros";
import type { Destino } from "./imt";
import { centimos } from "./util";

/** IRS sobre um rendimento coletável, pelos escalões do art. 68.º (sem deduções à coleta). */
export function irsPorEscaloes(rendimento: number): number {
  let imposto = 0;
  let anterior = 0;
  for (const e of TABELA_IRS.escaloes) {
    const topo = e.ate === null ? rendimento : Math.min(rendimento, e.ate);
    if (topo <= anterior) break;
    imposto += ((topo - anterior) * e.taxa) / 100;
    anterior = topo;
  }
  return centimos(imposto);
}

/**
 * IRS a mais por englobar um rendimento: imposto sobre (rendimento atual + extra)
 * menos o imposto sobre o rendimento atual. Sem rendimento conhecido, conta como 0.
 */
export function irsAdicional(rendimentoAtual: number | null, extra: number): number {
  if (extra <= 0) return 0;
  const base = rendimentoAtual ?? 0;
  return centimos(irsPorEscaloes(base + extra) - irsPorEscaloes(base));
}

/** Taxa autónoma das rendas em %, conforme o destino e a duração do contrato. */
export function taxaAutonomaRendas(destino: Destino, duracaoContratoAnos: number | null): number {
  if (destino === "comercial") return valorParametro("irs.rendas-outras");
  const geral = valorParametro("irs.rendas-taxa-autonoma");
  const anos = duracaoContratoAnos ?? 0;
  if (anos >= 20) return geral - valorParametro("irs.rendas-reducao-20");
  if (anos >= 10) return geral - valorParametro("irs.rendas-reducao-10-20");
  if (anos >= 5) return geral - valorParametro("irs.rendas-reducao-5-10");
  return geral;
}
