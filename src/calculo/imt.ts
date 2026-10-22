// IMT e Imposto do Selo na compra de um imóvel (ponto 5.2 da especificação).
// Só usa valores de dados/parametros.ts. Nenhum valor fiscal é escrito aqui.

import { tabelaIMT, valorParametro, type EscalaoIMT } from "../dados/parametros";
import type { Regiao } from "../dados/perfil";
import { centimos } from "./util";

/** Destino do imóvel (ponto 5.1). "arrendamento" usa a tabela da habitação secundária. */
export type Destino = "hpp" | "secundaria" | "arrendamento" | "comercial";

export interface DadosTransmissao {
  preco: number;
  /** Valor patrimonial tributário. Se faltar, usa-se o preço. */
  vpt: number | null;
  destino: Destino;
  regiao: Regiao;
  /** Idade do comprador na data da escritura. Null se o perfil não tiver a data de nascimento. */
  idade: number | null;
  /** O comprador nunca foi proprietário de uma habitação (condição do IMT Jovem). */
  primeiraHabitacao: boolean;
}

export interface ResultadoTransmissao {
  /** Valor sobre o qual incidem os impostos: o maior entre o preço e o VPT. */
  base: number;
  imt: number;
  impostoSelo: number;
  isencaoJovem: "total" | "parcial" | null;
  /** Explicação curta de como o IMT foi calculado. */
  regra: string;
}

/** Escalões da tabela, com os limites aumentados nas regiões autónomas. */
export function escaloesRegiao(id: "imt.hpp" | "imt.secundaria", regiao: Regiao): EscalaoIMT[] {
  const fator = regiao === "continente" ? 1 : 1 + valorParametro("imt.agravamento-regioes-autonomas") / 100;
  return tabelaIMT(id).escaloes.map((e) => ({ ...e, ate: e.ate === null ? null : e.ate * fator }));
}

/**
 * IMT por escalões. Nos escalões normais, cada parte do valor paga a taxa do seu escalão
 * (é o mesmo que "valor × taxa − parcela a abater"). Nos escalões de taxa única, a taxa
 * aplica-se a todo o valor.
 */
export function imtPorEscaloes(valor: number, escaloes: EscalaoIMT[]): number {
  const i = escaloes.findIndex((e) => e.ate === null || valor <= e.ate);
  const escalao = escaloes[i];
  if (escalao.unica) return centimos((valor * escalao.taxa) / 100);
  let imposto = 0;
  let anterior = 0;
  for (const e of escaloes.slice(0, i + 1)) {
    const topo = Math.min(valor, e.ate ?? valor);
    imposto += ((topo - anterior) * e.taxa) / 100;
    anterior = topo;
  }
  return centimos(imposto);
}

export function jovemElegivel(d: Pick<DadosTransmissao, "destino" | "idade" | "primeiraHabitacao">): boolean {
  return d.destino === "hpp" && d.primeiraHabitacao && d.idade !== null && d.idade <= valorParametro("imt.jovem-idade-maxima");
}

export function impostosTransmissao(d: DadosTransmissao): ResultadoTransmissao {
  const base = Math.max(d.preco, d.vpt ?? 0);
  const taxaIS = valorParametro("is.aquisicao");
  const isNormal = centimos((base * taxaIS) / 100);

  if (d.destino === "comercial") {
    const taxa = valorParametro("imt.outros-urbanos");
    return { base, imt: centimos((base * taxa) / 100), impostoSelo: isNormal, isencaoJovem: null, regra: `Outros prédios urbanos: taxa única de ${taxa}%.` };
  }

  const tabela = d.destino === "hpp" ? "imt.hpp" : "imt.secundaria";
  const escaloes = escaloesRegiao(tabela, d.regiao);
  const imtNormal = imtPorEscaloes(base, escaloes);
  const nomeTabela = tabelaIMT(tabela).descricao.replace("IMT: ", "");

  if (jovemElegivel(d)) {
    // Isenção total até ao limite do 4.º escalão. Entre esse limite e o do 5.º, paga-se
    // só sobre a parte que excede, à taxa do 5.º escalão. Acima do 5.º não há isenção.
    const limiteTotal = escaloes[3].ate!;
    const limiteParcial = escaloes[4].ate!;
    if (base <= limiteTotal) {
      return { base, imt: 0, impostoSelo: 0, isencaoJovem: "total", regra: "IMT Jovem: isenção total de IMT e Imposto do Selo." };
    }
    if (base <= limiteParcial) {
      const excesso = base - limiteTotal;
      return {
        base,
        imt: centimos((excesso * escaloes[4].taxa) / 100),
        impostoSelo: centimos((excesso * taxaIS) / 100),
        isencaoJovem: "parcial",
        regra: `IMT Jovem: isenção parcial. Paga ${escaloes[4].taxa}% de IMT e ${taxaIS}% de Imposto do Selo só sobre a parte acima do limite da isenção total.`,
      };
    }
  }

  return { base, imt: imtNormal, impostoSelo: isNormal, isencaoJovem: null, regra: `Tabela de ${nomeTabela}.` };
}
