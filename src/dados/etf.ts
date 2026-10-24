// Catálogo pessoal de ETF (ponto 6.2 da especificação). Os dados vêm dos documentos dos
// emitentes (ficha e KID), introduzidos pelo utilizador: não há fonte pública gratuita.

import { apagar, guardar, listar } from "./repositorio";

export type Politica = "acumulacao" | "distribuicao";
export type Replicacao = "fisica-total" | "fisica-amostragem" | "sintetica";
export type RegiaoETF = "global" | "eua" | "europa" | "asia-pacifico" | "emergentes" | "outra";
export type SetorETF =
  | "diversificado"
  | "tecnologia"
  | "saude"
  | "financeiro"
  | "energia"
  | "utilities"
  | "industria"
  | "consumo"
  | "materiais"
  | "imobiliario"
  | "telecomunicacoes"
  | "obrigacoes"
  | "outro";

export const NOMES_REGIAO: Record<RegiaoETF, string> = {
  global: "Global",
  eua: "EUA",
  europa: "Europa",
  "asia-pacifico": "Ásia-Pacífico",
  emergentes: "Mercados emergentes",
  outra: "Outra",
};

export const NOMES_SETOR: Record<SetorETF, string> = {
  diversificado: "Diversificado (vários setores)",
  tecnologia: "Tecnologia",
  saude: "Saúde",
  financeiro: "Financeiro",
  energia: "Energia",
  utilities: "Utilities (eletricidade, água, gás)",
  industria: "Indústria",
  consumo: "Consumo",
  materiais: "Materiais",
  imobiliario: "Imobiliário",
  telecomunicacoes: "Telecomunicações",
  obrigacoes: "Obrigações",
  outro: "Outro",
};

export const NOMES_POLITICA: Record<Politica, string> = { acumulacao: "Acumulação", distribuicao: "Distribuição" };
export const NOMES_REPLICACAO: Record<Replicacao, string> = {
  "fisica-total": "Física (total)",
  "fisica-amostragem": "Física (amostragem)",
  sintetica: "Sintética",
};

/** A app só usa ETF negociados na Xetra (Alemanha), em euros: carteira toda na mesma moeda e sem câmbio. */
export const BOLSA = "XETRA";
export const NOME_BOLSA = "Xetra (Alemanha)";

export interface ETF {
  isin: string;
  /** Código do ETF na Xetra, o que aparece na corretora (por exemplo EUNL). */
  ticker: string;
  nome: string;
  emitente: string;
  indice: string;
  regiao: RegiaoETF;
  setor: SetorETF;
  /** Custo anual (TER), em %. */
  ter: number | null;
  /** Diferença anual entre o ETF e o índice, em %, e o período a que se refere. */
  trackingDifference: number | null;
  trackingPeriodo: string;
  domicilio: string; // código do país (IE, LU…)
  politica: Politica;
  /** Rendimento anual em dividendos, em % (só nos de distribuição). */
  dividendosPct: number | null;
  /** Dimensão do fundo, em milhões de euros. */
  dimensao: number | null;
  moedaFundo: string;
  moedaNegociacao: string;
  replicacao: Replicacao;
  /** Data de lançamento do fundo (AAAA-MM-DD), ou vazio se não for conhecida. */
  dataLancamento: string;
  /** Número de posições (empresas ou títulos) que o fundo detém. */
  numeroPosicoes: number | null;
  bolsa: string;
  /** O utilizador confirmou que há KID para investidores de retalho na UE (UCITS/PRIIPs). */
  kid: boolean;
  fonte: string;
  /** Data da última verificação dos dados (AAAA-MM-DD). */
  atualizadoEm: string;
}

export function novoETF(hoje: string): ETF {
  return {
    isin: "",
    ticker: "",
    nome: "",
    emitente: "",
    indice: "",
    regiao: "global",
    setor: "diversificado",
    ter: null,
    trackingDifference: null,
    trackingPeriodo: "",
    domicilio: "IE",
    politica: "acumulacao",
    dividendosPct: null,
    dimensao: null,
    moedaFundo: "USD",
    moedaNegociacao: "EUR",
    replicacao: "fisica-total",
    dataLancamento: "",
    numeroPosicoes: null,
    bolsa: BOLSA,
    kid: false,
    fonte: "",
    atualizadoEm: hoje,
  };
}

/** Meses ao fim dos quais a app lembra de rever os dados de um ETF. */
export const MESES_REVISAO = 6;

const TIPO = "etf";

/** Campos acrescentados depois dos primeiros ETF guardados: os antigos ficam com estes valores. */
const CAMPOS_NOVOS: Pick<ETF, "ticker" | "dataLancamento" | "numeroPosicoes"> = { ticker: "", dataLancamento: "", numeroPosicoes: null };

export const listarETF = async (chave: CryptoKey) =>
  (await listar<ETF>(chave, TIPO)).map((e) => ({ ...CAMPOS_NOVOS, ...e })).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
export const guardarETF = (chave: CryptoKey, e: ETF) =>
  guardar(chave, TIPO, e.isin, { ...e, ticker: e.ticker.trim().toUpperCase(), bolsa: BOLSA, moedaNegociacao: "EUR" });
export const apagarETF = (isin: string) => apagar(TIPO, isin);
