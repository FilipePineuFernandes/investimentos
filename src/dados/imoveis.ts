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

  // Armazéns (5.10). Só se usam quando o destino é comercial ou industrial.
  armazem?: DadosArmazem;

  // Estratégias (5.6 a 5.9). Null ou ausente se não estiver a ser analisada.
  revenda?: EstrategiaRevenda | null;
  arrendamento?: EstrategiaArrendamento | null;
  reconstrucao?: EstrategiaReconstrucao | null;
  cedencia?: EstrategiaCedencia | null;
}

export interface DadosArmazem {
  tipo: "logistica" | "industrial" | "comercial";
  areaLogradouro: number | null;
  peDireito: number | null;
  acessosPesados: boolean;
  licencaUtilizacao: "sim" | "nao" | "em-curso";
}

export const ARMAZEM_VAZIO: DadosArmazem = { tipo: "logistica", areaLogradouro: null, peDireito: null, acessosPesados: false, licencaUtilizacao: "sim" };

// --- Estratégia 2: reconstrução --------------------------------------------------------

export type TipoTrabalho =
  | "cozinha"
  | "cozinha-equipamento"
  | "casa-banho"
  | "quartos-salas"
  | "pintura"
  | "pavimentos"
  | "eletrica-pontos"
  | "eletrica-quadro"
  | "canalizacao-pontos"
  | "canalizacao-geral"
  | "caixilharia"
  | "cobertura-fachada"
  | "climatizacao"
  | "outro";

/** Trabalhos da obra por zonas, cada um com a sua unidade (ponto 5.8). */
export const TRABALHOS: Record<TipoTrabalho, { nome: string; unidade: string; nota?: string }> = {
  cozinha: { nome: "Cozinha", unidade: "m²" },
  "cozinha-equipamento": { nome: "Cozinha: móveis e eletrodomésticos", unidade: "vg", nota: "Valor global" },
  "casa-banho": { nome: "Casa de banho", unidade: "un.", nota: "Louças, revestimentos e canalização local" },
  "quartos-salas": { nome: "Quartos e salas", unidade: "m² pav.", nota: "Pavimento, rebocos e tetos" },
  pintura: { nome: "Pintura", unidade: "m² parede/teto" },
  pavimentos: { nome: "Pavimentos", unidade: "m²" },
  "eletrica-pontos": { nome: "Instalação elétrica: pontos", unidade: "pontos", nota: "Tomadas e interruptores" },
  "eletrica-quadro": { nome: "Instalação elétrica: quadro", unidade: "vg" },
  "canalizacao-pontos": { nome: "Canalização: pontos de água", unidade: "pontos" },
  "canalizacao-geral": { nome: "Canalização: rede geral", unidade: "vg" },
  caixilharia: { nome: "Caixilharia", unidade: "m² de vão" },
  "cobertura-fachada": { nome: "Cobertura e fachada", unidade: "m²" },
  climatizacao: { nome: "Climatização e águas quentes", unidade: "un." },
  outro: { nome: "Outro trabalho", unidade: "vg" },
};

export type Acabamento = "basico" | "medio" | "alto";
export const NOMES_ACABAMENTO: Record<Acabamento, string> = { basico: "Básico", medio: "Médio", alto: "Alto" };

export interface Trabalho {
  id: string;
  tipo: TipoTrabalho;
  descricao: string;
  quantidade: number | null;
  /** € por unidade, com IVA. */
  custoUnitario: number | null;
}

export interface EstrategiaReconstrucao {
  /** Obra integral (€/m² × área) ou por zonas (lista de trabalhos). Excluem-se para não contar a obra duas vezes. */
  modo: "integral" | "zonas";
  acabamento: Acabamento;
  /** € por m² de área bruta, com IVA, para a obra integral. */
  custoM2: number | null;
  trabalhos: Trabalho[];
  /** Ajuste dos custos à localização. Em branco, 1. */
  coeficienteRegional: number | null;
  projetoLicenciamento: number | null;
  prazoObraMeses: number | null;
  /** Margem de imprevistos em % do custo da obra. */
  imprevistosPct: number | null;
  valorDepoisObra: number | null;
}

export const RECONSTRUCAO_VAZIA: EstrategiaReconstrucao = {
  modo: "integral",
  acabamento: "medio",
  custoM2: null,
  trabalhos: [],
  coeficienteRegional: null,
  projetoLicenciamento: null,
  prazoObraMeses: null,
  imprevistosPct: 10,
  valorDepoisObra: null,
};

// --- Estratégia 3: cedência de posição --------------------------------------------------

export interface Pagamento {
  id: string;
  data: string; // AAAA-MM-DD
  valor: number | null;
  descricao: string;
}

export interface EstrategiaCedencia {
  /** Sinal e reforços pagos ao promotor (o preço do imóvel no CPCV é o valor de compra). */
  pagamentos: Pagamento[];
  dataEscritura: string;
  /** Total recebido de quem fica com a posição (reembolso do que foi pago + ganho). */
  valorCedencia: number | null;
  dataCedencia: string;
  /** Comissões, advogado e outros custos da cedência. */
  custos: number | null;
  /** IMT devido pela cedência, se houver (a confirmar com um contabilista). */
  imt: number | null;
  promotor: string;
  verificacoes: { licenca: boolean; garantiaSinal: boolean; historico: boolean; semAtrasos: boolean };
}

export const CEDENCIA_VAZIA: EstrategiaCedencia = {
  pagamentos: [],
  dataEscritura: "",
  valorCedencia: null,
  dataCedencia: "",
  custos: null,
  imt: null,
  promotor: "",
  verificacoes: { licenca: false, garantiaSinal: false, historico: false, semAtrasos: false },
};

/** Estratégia 1A: compra para revenda. */
export interface EstrategiaRevenda {
  precoVenda: number | null;
  mesesAteVenda: number | null;
  obras: number | null;
  condominioMensal: number | null;
  /** Seguros que não são exigidos pelo banco (os do banco já estão no financiamento). */
  seguroAnual: number | null;
  /** Comissão da imobiliária na venda, em %, sem IVA. */
  comissaoVendaPct: number | null;
  outrosCustosVenda: number | null;
  /** Coeficiente de desvalorização monetária (portaria anual). Só se aplica com mais de 24 meses. */
  coeficiente: number | null;
}

/** Estratégia 1B: compra para arrendamento. */
export interface EstrategiaArrendamento {
  rendaMensal: number | null;
  mesesVazioAno: number | null;
  manutencaoAnual: number | null;
  /** Gestão do arrendamento, em % da renda recebida. */
  gestaoPct: number | null;
  condominioMensal: number | null;
  /** Seguros que não são exigidos pelo banco, incluindo o seguro de renda. */
  seguroAnual: number | null;
  duracaoContratoAnos: number | null;
}

export const REVENDA_VAZIA: EstrategiaRevenda = {
  precoVenda: null,
  mesesAteVenda: null,
  obras: null,
  condominioMensal: null,
  seguroAnual: null,
  comissaoVendaPct: null,
  outrosCustosVenda: null,
  coeficiente: null,
};

export const ARRENDAMENTO_VAZIO: EstrategiaArrendamento = {
  rendaMensal: null,
  mesesVazioAno: null,
  manutencaoAnual: null,
  gestaoPct: null,
  condominioMensal: null,
  seguroAnual: null,
  duracaoContratoAnos: null,
};

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
