// Estratégia 3: compra para cedência de posição contratual (ponto 5.9 da especificação).
//
// O investidor assina o contrato-promessa (CPCV), paga o sinal e os reforços, e antes da
// escritura cede a posição a outra pessoa, que lhe paga o que já foi pago mais um ganho.
// O ganho é mais-valia (art. 10.º, n.º 1, al. d) do CIRS), englobada em 50% como a dos imóveis.

import type { EstrategiaCedencia } from "../dados/imoveis";
import { valorParametro } from "../dados/parametros";
import { irsAdicional } from "./irs";
import { centimos, lerData, tirDatas } from "./util";

export interface ResultadoCedencia {
  faltam: string[];
  totalPago: number;
  /** Valor recebido − valores pagos − custos − IMT. */
  ganho: number;
  tributavel: number;
  irs: number;
  ganhoLiquido: number;
  /** Ganho líquido ÷ total pago, em %. */
  roi: number;
  /** TIR anual em %, com as datas reais dos pagamentos. */
  tir: number | null;
  meses: number;
  /** Verificações do promotor por fazer. */
  riscos: string[];
  notas: string[];
}

const NOMES_VERIFICACOES: Record<keyof EstrategiaCedencia["verificacoes"], string> = {
  licenca: "licença de construção",
  garantiaSinal: "garantia bancária do sinal",
  historico: "histórico do promotor",
  semAtrasos: "obra sem atrasos",
};

export function calcularCedencia(e: EstrategiaCedencia, rendimentoColetavel: number | null): ResultadoCedencia | { faltam: string[] } {
  const faltam: string[] = [];
  const pagamentos = e.pagamentos.filter((p) => p.valor && lerData(p.data));
  const cedencia = lerData(e.dataCedencia);
  if (pagamentos.length === 0) faltam.push("pelo menos um pagamento com data e valor (sinal)");
  if (!e.valorCedencia) faltam.push("valor da cedência");
  if (!cedencia) faltam.push("data da cedência");
  if (faltam.length > 0) return { faltam };

  const notas: string[] = [];
  const incompletos = e.pagamentos.length - pagamentos.length;
  if (incompletos > 0) notas.push(`${incompletos} ${incompletos === 1 ? "pagamento não entra" : "pagamentos não entram"} por falta de data ou de valor.`);
  const escritura = lerData(e.dataEscritura);
  if (escritura && cedencia! >= escritura) notas.push("A cedência está marcada para depois da escritura: nessa altura já não há posição para ceder, há uma venda.");
  if (pagamentos.some((p) => lerData(p.data)! > cedencia!)) notas.push("Há pagamentos depois da data da cedência.");

  const totalPago = pagamentos.reduce((s, p) => s + p.valor!, 0);
  const custos = (e.custos ?? 0) + (e.imt ?? 0);
  const ganho = e.valorCedencia! - totalPago - custos;
  const tributavel = Math.max(ganho, 0) * (valorParametro("irs.mais-valias-imoveis-englobamento") / 100);
  const irs = irsAdicional(rendimentoColetavel, tributavel);
  if (rendimentoColetavel === null && tributavel > 0) notas.push("Sem rendimento coletável no perfil: o IRS foi calculado como se o ganho fosse o único rendimento, o que o subestima.");
  notas.push("A cedência pode estar sujeita a IMT, conforme o valor pago. Confirme com um contabilista e indique-o no campo próprio.");
  const ganhoLiquido = ganho - irs;

  const fluxos = [...pagamentos.map((p) => ({ data: lerData(p.data)!, valor: -p.valor! })), { data: cedencia!, valor: e.valorCedencia! - custos - irs }];
  const r = tirDatas(fluxos);
  const primeiro = Math.min(...pagamentos.map((p) => lerData(p.data)!.getTime()));

  return {
    faltam: [],
    totalPago: centimos(totalPago),
    ganho: centimos(ganho),
    tributavel: centimos(tributavel),
    irs,
    ganhoLiquido: centimos(ganhoLiquido),
    roi: centimos((ganhoLiquido / totalPago) * 100),
    tir: Number.isFinite(r) ? centimos(r * 100) : null,
    meses: Math.round(((cedencia!.getTime() - primeiro) / 86_400_000 / 365) * 12 * 10) / 10,
    riscos: (Object.keys(NOMES_VERIFICACOES) as (keyof typeof NOMES_VERIFICACOES)[]).filter((k) => !e.verificacoes[k]).map((k) => NOMES_VERIFICACOES[k]),
    notas,
  };
}
