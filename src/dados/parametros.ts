// Parâmetros fiscais e regulamentares (Anexo B da especificação).
//
// Cada valor tem fonte, data de entrada em vigor e data da última verificação.
// Os cálculos da app só podem usar valores daqui. Quando um valor ainda não foi
// confirmado (por exemplo pelo contabilista), o estado é "a confirmar" e a app
// mostra-o assim ao utilizador.
//
// As tabelas do IMT estão no fim do ficheiro. As do IRS e as taxas de IMI por
// município entram mais tarde.

export type EstadoParametro = "confirmado" | "a confirmar";

export interface Parametro {
  id: string;
  descricao: string;
  valor: number;
  unidade: "%" | "p.p." | "anos" | "€";
  fonte: string;
  emVigorDesde: string; // AAAA-MM-DD
  verificadoEm: string; // AAAA-MM-DD
  estado: EstadoParametro;
  nota?: string;
}

export const VERSAO_PARAMETROS = "2026-10-22";

export const PARAMETROS: Parametro[] = [
  {
    id: "imt.outros-urbanos",
    descricao: "IMT: outros prédios urbanos (ex.: armazéns)",
    valor: 6.5,
    unidade: "%",
    fonte: "Código do IMT, art. 17.º",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "imt.jovem-idade-maxima",
    descricao: "IMT Jovem: idade máxima do comprador",
    valor: 35,
    unidade: "anos",
    fonte: "Código do IMT, art. 9.º, n.º 2",
    emVigorDesde: "2024-08-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Só habitação própria permanente e primeira habitação. Isenção total até ao limite do 4.º escalão, parcial até ao do 5.º.",
  },
  {
    id: "imt.agravamento-regioes-autonomas",
    descricao: "IMT: aumento dos limites dos escalões nos Açores e na Madeira",
    valor: 25,
    unidade: "%",
    fonte: "Código do IMT, art. 17.º, n.º 4",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "is.aquisicao",
    descricao: "Imposto do Selo sobre a aquisição de imóveis",
    valor: 0.8,
    unidade: "%",
    fonte: "Tabela Geral do Imposto do Selo, verba 1.1",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Incide sobre o maior entre o preço e o VPT.",
  },
  {
    id: "is.credito-5-anos-ou-mais",
    descricao: "Imposto do Selo sobre crédito com prazo de 5 anos ou mais",
    valor: 0.6,
    unidade: "%",
    fonte: "Tabela Geral do Imposto do Selo, verba 17.1",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "is.credito-1-a-5-anos",
    descricao: "Imposto do Selo sobre crédito com prazo de 1 a 5 anos",
    valor: 0.5,
    unidade: "%",
    fonte: "Tabela Geral do Imposto do Selo, verba 17.1.2",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "is.juros",
    descricao: "Imposto do Selo sobre os juros do crédito",
    valor: 4,
    unidade: "%",
    fonte: "Tabela Geral do Imposto do Selo, verba 17.3",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "iva.taxa-normal",
    descricao: "IVA: taxa normal (Continente), aplicada às comissões de mediação",
    valor: 23,
    unidade: "%",
    fonte: "Código do IVA, art. 18.º",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "custos.casa-pronta",
    descricao: "Casa Pronta: compra e venda (escritura e registo), sem crédito",
    valor: 375,
    unidade: "€",
    fonte: "IRN, tabela do procedimento Casa Pronta",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Valor de referência. Pode ser substituído pelo orçamento do notário.",
  },
  {
    id: "custos.casa-pronta-com-hipoteca",
    descricao: "Casa Pronta: compra e venda com crédito e hipoteca",
    valor: 700,
    unidade: "€",
    fonte: "IRN, tabela do procedimento Casa Pronta",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Valor de referência. Pode ser substituído pelo orçamento do notário.",
  },
  {
    id: "imi.taxa-minima",
    descricao: "IMI: taxa mínima para prédios urbanos",
    valor: 0.3,
    unidade: "%",
    fonte: "Código do IMI, art. 112.º",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "imi.taxa-maxima",
    descricao: "IMI: taxa máxima para prédios urbanos",
    valor: 0.45,
    unidade: "%",
    fonte: "Código do IMI, art. 112.º",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "irs.rendas-taxa-autonoma",
    descricao: "IRS: taxa autónoma sobre rendas de habitação permanente",
    valor: 25,
    unidade: "%",
    fonte: "Código do IRS, art. 72.º, n.º 2",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Há taxas reduzidas para contratos de longa duração.",
  },
  {
    id: "irs.rendas-reducao-5-10",
    descricao: "IRS: redução da taxa das rendas, contratos de 5 a menos de 10 anos",
    valor: 10,
    unidade: "p.p.",
    fonte: "Código do IRS, art. 72.º, n.º 3",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Mais 2 pontos por renovação, até 10. Em contratos desde 2024, não se aplica se a renda passar os limites do n.º 23.",
  },
  {
    id: "irs.rendas-reducao-10-20",
    descricao: "IRS: redução da taxa das rendas, contratos de 10 a menos de 20 anos",
    valor: 15,
    unidade: "p.p.",
    fonte: "Código do IRS, art. 72.º, n.º 4",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "irs.rendas-reducao-20",
    descricao: "IRS: redução da taxa das rendas, contratos de 20 anos ou mais",
    valor: 20,
    unidade: "p.p.",
    fonte: "Código do IRS, art. 72.º, n.º 5",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "irs.rendas-outras",
    descricao: "IRS: taxa autónoma sobre outras rendas (ex.: armazéns, comércio)",
    valor: 28,
    unidade: "%",
    fonte: "Código do IRS, art. 72.º, n.º 1, al. e)",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "irs.mais-valias-imoveis-englobamento",
    descricao: "IRS: parte da mais-valia imobiliária englobada (residentes)",
    valor: 50,
    unidade: "%",
    fonte: "Código do IRS, art. 43.º",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "O englobamento é obrigatório. Não inclui a exclusão por reinvestimento na habitação própria.",
  },
  {
    id: "irs.mobiliario-taxa-liberatoria",
    descricao: "IRS: taxa especial sobre mais-valias e dividendos (ETF)",
    valor: 28,
    unidade: "%",
    fonte: "Código do IRS, arts. 71.º e 72.º",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "bdp.ltv-hpp",
    descricao: "Banco de Portugal: LTV máximo, habitação própria permanente",
    valor: 90,
    unidade: "%",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "bdp.ltv-outros",
    descricao: "Banco de Portugal: LTV máximo, outros destinos",
    valor: 80,
    unidade: "%",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "bdp.dsti-maximo",
    descricao: "Banco de Portugal: taxa de esforço (DSTI) máxima",
    valor: 50,
    unidade: "%",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Calculada com o choque de taxa de juro definido pelo Banco de Portugal.",
  },
  {
    id: "bdp.prazo-maximo",
    descricao: "Banco de Portugal: prazo máximo do crédito à habitação",
    valor: 40,
    unidade: "anos",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Mutuários até 30 anos de idade. Menor a partir dos 30 anos.",
  },
  {
    id: "bdp.prazo-maximo-30-35",
    descricao: "Banco de Portugal: prazo máximo, mutuários com mais de 30 e até 35 anos",
    valor: 37,
    unidade: "anos",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "bdp.prazo-maximo-mais-35",
    descricao: "Banco de Portugal: prazo máximo, mutuários com mais de 35 anos",
    valor: 35,
    unidade: "anos",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "bdp.choque-variavel",
    descricao: "Banco de Portugal: choque de taxa no DSTI, taxa variável ou mista com período fixo até 5 anos",
    valor: 3,
    unidade: "p.p.",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
  },
  {
    id: "bdp.choque-mista-5-10",
    descricao: "Banco de Portugal: choque de taxa no DSTI, taxa mista com período fixo de mais de 5 e menos de 10 anos",
    valor: 1.5,
    unidade: "p.p.",
    fonte: "Banco de Portugal, medida macroprudencial",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Sem choque na taxa fixa nem na mista com período fixo de 10 anos ou mais.",
  },
  {
    id: "bdp.inflacao-2026",
    descricao: "Banco de Portugal: inflação projetada (IHPC) para 2026",
    valor: 3.1,
    unidade: "%",
    fonte: "Banco de Portugal, Boletim Económico de outubro de 2026",
    emVigorDesde: "2026-10-07",
    verificadoEm: "2026-10-24",
    estado: "a confirmar",
    nota: "Só para atualizar custos (condomínio, seguros, manutenção). Rever em cada Boletim Económico (junho e dezembro).",
  },
  {
    id: "bdp.inflacao-2027",
    descricao: "Banco de Portugal: inflação projetada (IHPC) para 2027",
    valor: 2.4,
    unidade: "%",
    fonte: "Banco de Portugal, Boletim Económico de outubro de 2026",
    emVigorDesde: "2026-10-07",
    verificadoEm: "2026-10-24",
    estado: "a confirmar",
    nota: "Só para atualizar custos (condomínio, seguros, manutenção). Rever em cada Boletim Económico (junho e dezembro).",
  },
  {
    id: "bdp.inflacao-2028",
    descricao: "Banco de Portugal: inflação projetada (IHPC) para 2028",
    valor: 2,
    unidade: "%",
    fonte: "Banco de Portugal, Boletim Económico de outubro de 2026",
    emVigorDesde: "2026-10-07",
    verificadoEm: "2026-10-24",
    estado: "a confirmar",
    nota: "Só para atualizar custos (condomínio, seguros, manutenção). Rever em cada Boletim Económico (junho e dezembro).",
  },
];

export function parametro(id: string): Parametro {
  const p = PARAMETROS.find((x) => x.id === id);
  if (!p) throw new Error(`Parâmetro desconhecido: ${id}`);
  return p;
}

/** Valor de um parâmetro. Atalho para os cálculos. */
export const valorParametro = (id: string) => parametro(id).valor;

// Tabelas do IMT por escalões (art. 17.º do CIMT), Continente.
// Nos Açores e na Madeira os limites sobem segundo "imt.agravamento-regioes-autonomas".
// A parcela a abater não é guardada: resulta dos limites e das taxas (ver calculo/imt.ts).

export interface EscalaoIMT {
  /** Limite superior do escalão em €. Null no último escalão. */
  ate: number | null;
  /** Taxa em %. */
  taxa: number;
  /** Taxa única: aplica-se a todo o valor, e não só à parte dentro do escalão. */
  unica?: boolean;
}

export interface TabelaIMT {
  id: "imt.hpp" | "imt.secundaria";
  descricao: string;
  escaloes: EscalaoIMT[];
  fonte: string;
  emVigorDesde: string;
  verificadoEm: string;
  estado: EstadoParametro;
  nota?: string;
}

const NOTA_IMT = "Limites do Orçamento do Estado para 2026 (atualização de 2%). Confirmar no Portal das Finanças.";

export const TABELAS_IMT: TabelaIMT[] = [
  {
    id: "imt.hpp",
    descricao: "IMT: habitação própria permanente",
    escaloes: [
      { ate: 106_346, taxa: 0 },
      { ate: 145_470, taxa: 2 },
      { ate: 198_347, taxa: 5 },
      { ate: 330_539, taxa: 7 },
      { ate: 660_982, taxa: 8 },
      { ate: 1_150_853, taxa: 6, unica: true },
      { ate: null, taxa: 7.5, unica: true },
    ],
    fonte: "Código do IMT, art. 17.º, n.º 1, al. a)",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: NOTA_IMT,
  },
  {
    id: "imt.secundaria",
    descricao: "IMT: outra habitação (secundária ou para arrendamento)",
    escaloes: [
      { ate: 106_346, taxa: 1 },
      { ate: 145_470, taxa: 2 },
      { ate: 198_347, taxa: 5 },
      { ate: 330_539, taxa: 7 },
      { ate: 633_931, taxa: 8 },
      { ate: 1_150_853, taxa: 6, unica: true },
      { ate: null, taxa: 7.5, unica: true },
    ],
    fonte: "Código do IMT, art. 17.º, n.º 1, al. b)",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: NOTA_IMT,
  },
];

export function tabelaIMT(id: TabelaIMT["id"]): TabelaIMT {
  const t = TABELAS_IMT.find((x) => x.id === id);
  if (!t) throw new Error(`Tabela desconhecida: ${id}`);
  return t;
}

// Escalões do IRS (art. 68.º do CIRS). Taxa marginal: cada parte do rendimento
// coletável paga a taxa do seu escalão.

export interface EscalaoIRS {
  /** Limite superior do rendimento coletável em €. Null no último escalão. */
  ate: number | null;
  /** Taxa normal em %. */
  taxa: number;
}

export const TABELA_IRS = {
  id: "irs.escaloes",
  descricao: "IRS: escalões do rendimento coletável",
  escaloes: [
    { ate: 8_342, taxa: 12.5 },
    { ate: 12_587, taxa: 15.7 },
    { ate: 17_838, taxa: 21.2 },
    { ate: 23_089, taxa: 24.1 },
    { ate: 29_397, taxa: 31.1 },
    { ate: 43_091, taxa: 34.9 },
    { ate: 46_567, taxa: 43.1 },
    { ate: 86_634, taxa: 44.6 },
    { ate: null, taxa: 48 },
  ] as EscalaoIRS[],
  fonte: "Código do IRS, art. 68.º (Lei n.º 55-A/2025 e Portaria n.º 322/2025)",
  emVigorDesde: "2026-01-01",
  verificadoEm: "2026-10-22",
  estado: "a confirmar" as EstadoParametro,
  nota: "Não inclui a taxa adicional de solidariedade (rendimentos acima de 80 000 €).",
};

/** Primeiro e último ano com projeção de inflação do Banco de Portugal. */
const INFLACAO_ANOS = [2026, 2027, 2028];

/**
 * Inflação projetada pelo Banco de Portugal para um ano, em %. Antes do primeiro ano usa o
 * primeiro valor; depois do último, mantém o último (próximo do objetivo de 2% do BCE).
 */
export function inflacaoProjetada(ano: number): number {
  const a = Math.min(Math.max(ano, INFLACAO_ANOS[0]), INFLACAO_ANOS[INFLACAO_ANOS.length - 1]);
  return valorParametro(`bdp.inflacao-${a}`);
}
