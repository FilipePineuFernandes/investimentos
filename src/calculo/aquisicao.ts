// Custos de aquisição de um imóvel (ponto 5.2 da especificação): impostos, escritura e
// registo, Imposto do Selo do crédito, avaliação, comissões e mediação.

import { valorParametro } from "../dados/parametros";
import { impostoSeloCapital } from "./credito";
import { impostosTransmissao, type DadosTransmissao, type ResultadoTransmissao } from "./imt";
import { centimos } from "./util";

export interface DadosAquisicao extends DadosTransmissao {
  /** Montante e prazo do crédito, se houver. */
  credito: { montante: number; prazoAnos: number } | null;
  /** Escritura e registo. Null usa o valor de referência da Casa Pronta. */
  escrituraRegisto: number | null;
  /** Avaliação bancária e comissões de processo (da FINE do banco). */
  avaliacaoComissoes: number;
  /** Comissão de mediação paga pelo comprador, em % do preço, sem IVA. */
  mediacaoPct: number;
}

export interface LinhaCusto {
  id: "imt" | "is-aquisicao" | "escritura" | "is-credito" | "avaliacao" | "mediacao";
  descricao: string;
  valor: number;
  origem: "calculado" | "referência" | "utilizador";
  nota?: string;
}

export interface ResultadoAquisicao {
  impostos: ResultadoTransmissao;
  linhas: LinhaCusto[];
  total: number;
  /** Preço + custos de aquisição. */
  custoTotal: number;
}

export function custosAquisicao(d: DadosAquisicao): ResultadoAquisicao {
  const impostos = impostosTransmissao(d);
  const notaBase = d.vpt === null ? "Sem VPT: calculado sobre o preço." : d.vpt > d.preco ? "Calculado sobre o VPT, que é maior do que o preço." : undefined;

  const linhas: LinhaCusto[] = [
    { id: "imt", descricao: "IMT", valor: impostos.imt, origem: "calculado", nota: [impostos.regra, notaBase].filter(Boolean).join(" ") },
    { id: "is-aquisicao", descricao: "Imposto do Selo na compra", valor: impostos.impostoSelo, origem: "calculado", nota: notaBase },
  ];

  const referenciaEscritura = valorParametro(d.credito ? "custos.casa-pronta-com-hipoteca" : "custos.casa-pronta");
  linhas.push(
    d.escrituraRegisto === null
      ? { id: "escritura", descricao: "Escritura e registo", valor: referenciaEscritura, origem: "referência", nota: "Valor de referência da Casa Pronta (IRN)." }
      : { id: "escritura", descricao: "Escritura e registo", valor: d.escrituraRegisto, origem: "utilizador" },
  );

  if (d.credito) {
    linhas.push({
      id: "is-credito",
      descricao: "Imposto do Selo sobre o crédito",
      valor: impostoSeloCapital(d.credito.montante, d.credito.prazoAnos),
      origem: "calculado",
      nota: "Sobre o capital. O Imposto do Selo sobre os juros é pago com cada prestação.",
    });
  }
  if (d.avaliacaoComissoes > 0) {
    linhas.push({ id: "avaliacao", descricao: "Avaliação bancária e comissões de processo", valor: d.avaliacaoComissoes, origem: "utilizador" });
  }
  if (d.mediacaoPct > 0) {
    const iva = valorParametro("iva.taxa-normal");
    linhas.push({
      id: "mediacao",
      descricao: "Comissão de mediação",
      valor: centimos(((d.preco * d.mediacaoPct) / 100) * (1 + iva / 100)),
      origem: "utilizador",
      nota: `${d.mediacaoPct.toLocaleString("pt-PT")}% do preço + IVA a ${iva}%.`,
    });
  }

  const total = centimos(linhas.reduce((s, l) => s + l.valor, 0));
  return { impostos, linhas, total, custoTotal: centimos(d.preco + total) };
}

/** IMI anual: VPT × taxa do município (em %). */
export const imiAnual = (vpt: number, taxaMunicipio: number) => centimos((vpt * taxaMunicipio) / 100);
