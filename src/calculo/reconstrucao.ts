// Estratégia 2: compra para reconstrução (ponto 5.8 da especificação).
// Os custos unitários vêm do utilizador (orçamentos ou tabela própria): a app não inventa preços de obra.

import { NOMES_ACABAMENTO, TRABALHOS, type EstrategiaReconstrucao, type Imovel } from "../dados/imoveis";
import type { AnaliseImovel } from "./imovel";
import { centimos } from "./util";

export interface LinhaObra {
  descricao: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
  total: number;
}

export interface ResultadoReconstrucao {
  faltam: string[];
  linhas: LinhaObra[];
  subtotal: number;
  coeficiente: number;
  imprevistos: number;
  /** Obra com coeficiente regional e imprevistos. */
  totalObra: number;
  licenciamento: number;
  /** Juros, encargos do crédito e IMI durante a obra. */
  detencao: number;
  /** Imóvel + aquisição + obra + licenciamento + detenção. */
  custoGlobal: number;
  /** Valor depois da obra − custo global. Null sem valor depois da obra. */
  margem: number | null;
  /** Margem ÷ custo global, em %. */
  roi: number | null;
  notas: string[];
}

export function calcularReconstrucao(i: Imovel, a: AnaliseImovel, e: EstrategiaReconstrucao): ResultadoReconstrucao | { faltam: string[] } {
  const faltam = [...a.faltam];
  const notas: string[] = [];
  let linhas: LinhaObra[] = [];

  if (e.modo === "integral") {
    if (!i.area) faltam.push("área bruta do imóvel");
    if (!e.custoM2) faltam.push("custo por m² da obra");
    if (i.area && e.custoM2) {
      linhas = [{ descricao: `Obra integral, acabamento ${NOMES_ACABAMENTO[e.acabamento].toLowerCase()}`, quantidade: i.area, unidade: "m²", custoUnitario: e.custoM2, total: i.area * e.custoM2 }];
    }
  } else {
    const completos = e.trabalhos.filter((t) => t.quantidade && t.custoUnitario);
    const incompletos = e.trabalhos.length - completos.length;
    if (completos.length === 0) faltam.push("pelo menos um trabalho com quantidade e custo");
    if (incompletos > 0) notas.push(`${incompletos} ${incompletos === 1 ? "trabalho não entra" : "trabalhos não entram"} no total por falta de quantidade ou de custo.`);
    linhas = completos.map((t) => ({
      descricao: t.descricao || TRABALHOS[t.tipo].nome,
      quantidade: t.quantidade!,
      unidade: TRABALHOS[t.tipo].unidade,
      custoUnitario: t.custoUnitario!,
      total: t.quantidade! * t.custoUnitario!,
    }));
  }
  if (!e.prazoObraMeses) faltam.push("prazo da obra");
  if (faltam.length > 0 || !a.aquisicao) return { faltam };

  const subtotal = linhas.reduce((s, l) => s + l.total, 0);
  const coeficiente = e.coeficienteRegional ?? 1;
  const imprevistos = (subtotal * coeficiente * (e.imprevistosPct ?? 0)) / 100;
  const totalObra = subtotal * coeficiente + imprevistos;
  const licenciamento = e.projetoLicenciamento ?? 0;

  // Detenção durante a obra: juros e encargos do crédito (não o capital) e IMI.
  const meses = Math.round(e.prazoObraMeses!);
  const f = i.financiamento;
  const encargosCredito = (a.credito?.plano ?? []).slice(0, meses).reduce((s, l) => s + l.juros + l.impostoSeloJuros + (f?.seguroMensal ?? 0) + (f?.comissaoMensal ?? 0), 0);
  const detencao = encargosCredito + ((a.imi ?? 0) * meses) / 12;
  if (a.imi === null) notas.push("Sem IMI: falta o VPT ou a taxa do município.");
  if (i.aru === "sim") {
    notas.push("Em ARU: a empreitada de reabilitação pode ter IVA a 6%, e o imóvel isenções de IMI e IMT. Dependem de requisitos e de certificação municipal: a confirmar com a câmara.");
  }

  const custoGlobal = i.preco! + a.aquisicao.total + totalObra + licenciamento + detencao;
  const margem = e.valorDepoisObra ? e.valorDepoisObra - custoGlobal : null;

  return {
    faltam: [],
    linhas: linhas.map((l) => ({ ...l, total: centimos(l.total) })),
    subtotal: centimos(subtotal),
    coeficiente,
    imprevistos: centimos(imprevistos),
    totalObra: centimos(totalObra),
    licenciamento,
    detencao: centimos(detencao),
    custoGlobal: centimos(custoGlobal),
    margem: margem === null ? null : centimos(margem),
    roi: margem === null ? null : centimos((margem / custoGlobal) * 100),
    notas,
  };
}

/** Custo da obra e do licenciamento, a somar às estratégias de revenda e de arrendamento. */
export function custoObra(i: Imovel, a: AnaliseImovel): number {
  if (!i.reconstrucao) return 0;
  const r = calcularReconstrucao(i, a, i.reconstrucao);
  return "totalObra" in r ? r.totalObra + r.licenciamento : 0;
}
