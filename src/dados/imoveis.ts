// Imóveis (ponto 5 da especificação): núcleo comum a todas as estratégias.
// Guardados só no aparelho, cifrados, um registo por imóvel.

import type { TipoTaxa } from "../calculo/credito";
import type { Destino } from "../calculo/imt";
import type { Regiao } from "./perfil";
import { apagar, guardar, listar } from "./repositorio";

export type EstadoImovel = "analise" | "comprado" | "obra" | "arrendado" | "venda" | "vendido";
export type Conservacao = "novo" | "bom" | "recuperar" | "ruina";
export type Indexante = "euribor3" | "euribor6" | "euribor12";

export const NOMES_ESTADO: Record<EstadoImovel, string> = {
  analise: "Em análise",
  comprado: "Comprado",
  obra: "Em obra",
  arrendado: "Arrendado",
  venda: "À venda",
  vendido: "Vendido",
};

export const NOMES_DESTINO: Record<Destino, string> = {
  hpp: "Habitação própria permanente",
  secundaria: "Habitação secundária",
  arrendamento: "Habitação para arrendamento",
  comercial: "Comercial ou industrial (ex.: armazém)",
};

export interface Financiamento {
  montante: number | null;
  prazoAnos: number | null;
  tipoTaxa: TipoTaxa;
  indexante: Indexante;
  /** Valor atual do indexante, em %. Introduzido à mão até existir o conector do BCE (fase 2). */
  euribor: number | null;
  spread: number | null;
  /** TAN fixa (taxa fixa, ou período fixo da taxa mista). */
  taxaFixa: number | null;
  periodoFixoAnos: number | null;
  seguroMensal: number | null;
  comissaoMensal: number | null;
  /** Valor da avaliação bancária do imóvel, para o LTV. */
  valorAvaliacao: number | null;
}

export interface Imovel {
  id: string;
  nome: string;
  estado: EstadoImovel;
  criadoEm: string;
  atualizadoEm: string;

  // Identificação (5.1)
  morada: string;
  municipio: string;
  freguesia: string;
  regiao: Regiao;
  destino: Destino;
  tipologia: string;
  area: number | null;
  anoConstrucao: number | null;
  conservacao: Conservacao;
  vpt: number | null;
  aru: "sim" | "nao" | "nao-sei";
  certificadoEnergetico: string;
  preco: number | null;

  // Custos de aquisição (5.2)
  primeiraHabitacao: boolean;
  escrituraRegisto: number | null;
  avaliacaoComissoes: number | null;
  mediacaoPct: number | null;
  taxaImi: number | null;

  // Financiamento (5.4). Null se a compra não for financiada.
  financiamento: Financiamento | null;
}

export const FINANCIAMENTO_VAZIO: Financiamento = {
  montante: null,
  prazoAnos: null,
  tipoTaxa: "variavel",
  indexante: "euribor6",
  euribor: null,
  spread: null,
  taxaFixa: null,
  periodoFixoAnos: null,
  seguroMensal: null,
  comissaoMensal: null,
  valorAvaliacao: null,
};

export function novoImovel(regiao: Regiao): Imovel {
  const agora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nome: "",
    estado: "analise",
    criadoEm: agora,
    atualizadoEm: agora,
    morada: "",
    municipio: "",
    freguesia: "",
    regiao,
    destino: "hpp",
    tipologia: "T2",
    area: null,
    anoConstrucao: null,
    conservacao: "bom",
    vpt: null,
    aru: "nao-sei",
    certificadoEnergetico: "",
    preco: null,
    primeiraHabitacao: false,
    escrituraRegisto: null,
    avaliacaoComissoes: null,
    mediacaoPct: null,
    taxaImi: null,
    financiamento: null,
  };
}

const TIPO = "imovel";

export const listarImoveis = async (chave: CryptoKey) =>
  (await listar<Imovel>(chave, TIPO)).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
export const guardarImovel = (chave: CryptoKey, i: Imovel) => guardar(chave, TIPO, i.id, { ...i, atualizadoEm: new Date().toISOString() });
export const apagarImovel = (id: string) => apagar(TIPO, id);
