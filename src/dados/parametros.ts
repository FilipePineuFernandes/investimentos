// Parâmetros fiscais e regulamentares (Anexo B da especificação).
//
// Cada valor tem fonte, data de entrada em vigor e data da última verificação.
// Os cálculos da app só podem usar valores daqui. Quando um valor ainda não foi
// confirmado (por exemplo pelo contabilista), o estado é "a confirmar" e a app
// mostra-o assim ao utilizador.
//
// As tabelas por escalões (IMT, IRS, taxas de IMI por município) entram na fase 1,
// com os valores oficiais do ano em vigor.

export type EstadoParametro = "confirmado" | "a confirmar";

export interface Parametro {
  id: string;
  descricao: string;
  valor: number;
  unidade: "%" | "anos" | "€";
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
    descricao: "IRS: taxa autónoma geral sobre rendas",
    valor: 25,
    unidade: "%",
    fonte: "Código do IRS, art. 72.º",
    emVigorDesde: "2026-01-01",
    verificadoEm: "2026-10-22",
    estado: "a confirmar",
    nota: "Há taxas reduzidas para contratos de longa duração.",
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
    nota: "Menor em função da idade do mutuário.",
  },
];

export function parametro(id: string): Parametro {
  const p = PARAMETROS.find((x) => x.id === id);
  if (!p) throw new Error(`Parâmetro desconhecido: ${id}`);
  return p;
}
