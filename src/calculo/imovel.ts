// Análise do núcleo comum de um imóvel: custos de aquisição, financiamento e limites
// do Banco de Portugal. Junta os cálculos de aquisicao.ts e credito.ts a partir dos
// dados guardados do imóvel e do perfil do investidor.

import type { Financiamento, Imovel } from "../dados/imoveis";
import { idade, type Perfil } from "../dados/perfil";
import { custosAquisicao, imiAnual, type ResultadoAquisicao } from "./aquisicao";
import { calcularCredito, validarLimites, type ResultadoCredito, type Validacao } from "./credito";
import { centimos } from "./util";

export interface AnaliseImovel {
  /** Campos obrigatórios que faltam para calcular. Se não estiver vazia, não há resultados. */
  faltam: string[];
  aquisicao: ResultadoAquisicao | null;
  /** TAN usada no crédito, em %. */
  taxaCredito: number | null;
  credito: ResultadoCredito | null;
  validacoes: Validacao[];
  imi: number | null;
  precoM2: number | null;
  /** Capital próprio necessário: preço + custos de aquisição − crédito. */
  capitalProprio: number | null;
}

/** TAN inicial: Euribor + spread na taxa variável, taxa fixa na fixa e na mista. */
export function taxaInicial(f: Financiamento): number | null {
  // Arredonda para evitar restos da soma em vírgula flutuante (2,1 + 0,9 = 3,0000000000000004).
  if (f.tipoTaxa === "variavel") return f.euribor === null || f.spread === null ? null : Math.round((f.euribor + f.spread) * 1e6) / 1e6;
  return f.taxaFixa;
}

export function faltamFinanciamento(f: Financiamento): string[] {
  const faltam: string[] = [];
  if (!f.montante) faltam.push("montante a financiar");
  if (!f.prazoAnos) faltam.push("prazo do crédito");
  if (f.tipoTaxa === "variavel") {
    if (f.euribor === null) faltam.push("valor da Euribor");
    if (f.spread === null) faltam.push("spread");
  } else {
    if (f.taxaFixa === null) faltam.push("taxa fixa");
    if (f.tipoTaxa === "mista" && !f.periodoFixoAnos) faltam.push("anos de taxa fixa");
  }
  return faltam;
}

export function analisarImovel(i: Imovel, perfil: Perfil | undefined, hoje = new Date()): AnaliseImovel {
  const vazio: AnaliseImovel = { faltam: [], aquisicao: null, taxaCredito: null, credito: null, validacoes: [], imi: null, precoM2: null, capitalProprio: null };
  if (!i.preco) return { ...vazio, faltam: ["valor de compra"] };

  const f = i.financiamento;
  const faltam = f ? faltamFinanciamento(f) : [];
  const anos = perfil ? idade(perfil.dataNascimento, hoje) : null;
  const imi = i.vpt && i.taxaImi ? imiAnual(i.vpt, i.taxaImi) : null;
  const precoM2 = i.area ? centimos(i.preco / i.area) : null;

  const aquisicao = custosAquisicao({
    preco: i.preco,
    vpt: i.vpt,
    destino: i.destino,
    regiao: i.regiao,
    idade: anos,
    primeiraHabitacao: i.primeiraHabitacao,
    credito: f && f.montante && f.prazoAnos ? { montante: f.montante, prazoAnos: f.prazoAnos } : null,
    escrituraRegisto: i.escrituraRegisto,
    avaliacaoComissoes: i.avaliacaoComissoes ?? 0,
    mediacaoPct: i.mediacaoPct ?? 0,
  });

  if (!f) return { ...vazio, aquisicao, imi, precoM2, capitalProprio: aquisicao.custoTotal };
  if (faltam.length > 0) return { ...vazio, faltam, aquisicao, imi, precoM2 };

  const taxa = taxaInicial(f)!;
  const credito = calcularCredito({
    montante: f.montante!,
    prazoAnos: f.prazoAnos!,
    taxaAnual: taxa,
    tipoTaxa: f.tipoTaxa,
    seguroMensal: f.seguroMensal ?? 0,
    comissaoMensal: f.comissaoMensal ?? 0,
    custosIniciais: i.avaliacaoComissoes ?? 0,
  });
  const validacoes = validarLimites({
    destino: i.destino,
    montante: f.montante!,
    preco: i.preco,
    avaliacao: f.valorAvaliacao,
    prazoAnos: f.prazoAnos!,
    idade: anos,
    taxaAnual: taxa,
    tipoTaxa: f.tipoTaxa,
    periodoFixoAnos: f.periodoFixoAnos,
    rendimentoMensal: perfil?.rendimentoMensalLiquido ?? null,
    outrasPrestacoes: perfil?.outrasPrestacoes ?? null,
  });

  return {
    faltam: [],
    aquisicao,
    taxaCredito: taxa,
    credito,
    validacoes,
    imi,
    precoM2,
    capitalProprio: centimos(aquisicao.custoTotal - f.montante!),
  };
}
