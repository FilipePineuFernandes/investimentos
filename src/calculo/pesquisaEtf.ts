// Pesquisa de ETF da Xetra para acrescentar ao catálogo («Novo ETF»). A lista oficial da Deutsche
// Börse só traz o ISIN, o código, um nome abreviado (por exemplo «ISHSVII-CORE S+P500 DLACC») e o
// tipo de ETF. A região, o setor, o emitente e a política são deduzidos do nome: são sugestões que
// a pessoa confirma na ficha do ETF antes de o guardar no catálogo.

import type { ETF, Politica, RegiaoETF, SetorETF } from "../dados/etf";

export type TipoXetra = "indice" | "ativo" | "obrigacoes";

export const NOMES_TIPO_XETRA: Record<TipoXetra, string> = { indice: "Índice (gestão passiva)", ativo: "Gestão ativa", obrigacoes: "Obrigações" };

/** Uma linha da lista publicada com a app: [ISIN, código, nome, tipo, na Xetra desde]. */
export type LinhaXetra = [string, string, string, TipoXetra, string];

export interface ListaXetra {
  atualizado: string;
  fonte: string;
  etf: LinhaXetra[];
}

export interface EtfXetra {
  isin: string;
  codigo: string;
  /** Nome abreviado, como aparece na Xetra. */
  nomeXetra: string;
  tipo: TipoXetra;
  desde: string;
  /** Sugestões deduzidas do nome (a confirmar na ficha do ETF). */
  regiao: RegiaoETF;
  setor: SetorETF;
  emitente: string;
  politica: Politica | null;
  domicilio: string;
}

/** Maiúsculas, «&» como «+», sem acentos, espaços nem pontuação. */
const compacto = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/&/g, "+")
    .replace(/[^A-Z0-9+]/g, "");

/** Palavras do nome, com «+» e «&» unidos (S+P500). */
const palavras = (t: string) =>
  t
    .toUpperCase()
    .replace(/&/g, "+")
    .split(/[^A-Z0-9+]+/)
    .filter(Boolean);

const tem = (nome: string, ...termos: RegExp[]) => termos.some((r) => r.test(nome));

const REGIOES: [RegiaoETF, RegExp[]][] = [
  ["emergentes", [/\bEM\b/, /\bEMI/, /EMIMI/, /EMERG/, /\bEM\.?MKT/, /CHINA/, /INDIA/, /BRAZIL|BRASIL/, /\bEM\.?ASIA/]],
  ["global", [/\bWLD\b/, /WORLD/, /\bWO\b/, /\bA\.W\b/, /FTSE A\.?W/, /M\.W\./, /ACWI/, /ALL[- ]?W/, /GLOBAL|GLOB\b|\bGL\b|\bGLB\b/, /\bW\.?\b(?=.*MSCI)/]],
  ["eua", [/S\+P/, /S\+\d/, /\bSP ?500\b/, /\bUSA?\b/, /NASDAQ|\bNDX\b|\bNQ\b/, /\bDOW\b|\bDJ\b/, /RUSSELL/, /N\.?AMER/, /AMERICA/]],
  ["asia-pacifico", [/JAPAN|\bJPN?\b|NIKKEI|TOPIX/, /ASIA|PACIF|\bPAC\b|PXJ/, /AUSTRAL|KOREA|TAIWAN|HONG/]],
  ["europa", [/EUROP|\bEUR\b|\bEU\b|\bE\.?U\.?\b/, /STOXX|\bSTX\b|E\.?STX/, /\bEMU\b/, /\bDAX\b|MDAX|SDAX|TECDAX|GERMAN|\bDE\b/, /FRANCE|CAC|\bUK\b|FTSE 100|SWISS|SMI|ITALY|SPAIN|NORDIC/]],
];

const SETORES: [SetorETF, RegExp[]][] = [
  ["saude", [/HEALTH|HLTH|\bHC\b|H\.?CARE|HE\.?CA|PHARMA|BIOTE|MEDIC/]],
  ["tecnologia", [/TECH|\bIT\b|INF\.?TECH|INF\.?T\b|INF\.T\.|SEMI|\bAI\b|A\.?I\.?\+|ROBOT|CYBER|CLOUD|DIGIT|NASDAQ|\bNDX\b|SOFTW|BLOCKCH|INTERNET|\bDATA\b/]],
  ["financeiro", [/FINANC|\bFIN\b|BANK|INSUR/]],
  ["energia", [/ENERG|\bOIL\b|CLEAN|SOLAR|URANIUM|HYDROG|\bGAS\b/]],
  ["utilities", [/UTIL/]],
  ["industria", [/INDUST|DEFEN|DEFENC|AEROSP|INFRASTR|INFRA\b/]],
  ["consumo", [/CONS|STAPL|DISCR|LUXUR|FOOD/]],
  ["materiais", [/MATER|MINING|MINER|METAL|LITHIUM/]],
  ["imobiliario", [/REAL ?EST|\bPROP|REIT|\bRE\b/]],
  ["telecomunicacoes", [/TELEC|COMMUNIC|\bCOMM\b/]],
];

const EMITENTES: [string, RegExp][] = [
  ["iShares", /^(ISHS|ISH\b|IS\b|ISHARES|ISHR)/],
  ["Vanguard", /^(V\.|VANG)/],
  ["Xtrackers", /^(X\(|XTR|XT\b|DBXT|DB X)/],
  ["Amundi", /^(AMUN|AM\.|AIS|LYX|MUL|MULTI|LYXOR|AMUNDI)/],
  ["SPDR", /^(SPDR|SSGA)/],
  ["Invesco", /^(INVESCO|INVS|INV\.|INVM)/],
  ["HSBC", /^HSBC/],
  ["UBS", /^(UBS|UIE)/],
  ["WisdomTree", /^(WISDOMT|WT\b|WISDOM)/],
  ["VanEck", /^(VANECK|VANEC|VE\b|VAN ECK)/],
  ["Global X", /^(GLOBAL X|GLX|GX\b)/],
  ["First Trust", /^(FT\b|FIRST T)/],
  ["J.P. Morgan", /^(JPM|JPMORGAN)/],
  ["Franklin Templeton", /^(FRANKL|FRK|FT\.)/],
  ["L&G", /^(L\+G|L&G|LG\b|LEGAL)/],
  ["Deka", /^(DK\b|DEKA)/],
  ["BNP Paribas", /^(BNP|BNPP)/],
  ["Ossiam", /^(OSS)/],
  ["Fidelity", /^(FID|FIDELITY)/],
  ["Expat", /^EXPAT/],
  ["Robeco", /^ROB/],
  ["Goldman Sachs", /^(GS|GOLDMAN)/],
  ["BlackRock", /^(BLACKR|BGF)/],
  ["Franklin", /^FRANK/],
  ["Rize", /^RIZE/],
  ["Tabula", /^TABULA/],
];

/** Classifica um ETF da lista da Xetra a partir do nome abreviado. */
export function classificar(l: LinhaXetra): EtfXetra {
  const [isin, codigo, nomeXetra, tipo, desde] = l;
  const n = nomeXetra.toUpperCase().replace(/&/g, "+");
  const regiao = REGIOES.find(([, r]) => tem(n, ...r))?.[0] ?? "outra";
  const setor: SetorETF = tipo === "obrigacoes" ? "obrigacoes" : (SETORES.find(([, r]) => tem(n, ...r))?.[0] ?? "diversificado");
  const emitente = EMITENTES.find(([, r]) => r.test(n))?.[0] ?? "";
  const politica: Politica | null = /\b(ACC|A|DLA|EOA|ACCU|C|1C|CA|CDL|CEOA)\b|ACC\b|DLACC|EOACC|\dC\b/.test(n)
    ? "acumulacao"
    : /\b(DIS|DIST|DLD|EOD|D|1D|DY|INC)\b|DIS\b|DLDIS/.test(n)
      ? "distribuicao"
      : null;
  return { isin, codigo, nomeXetra, tipo, desde, regiao, setor, emitente, politica, domicilio: isin.slice(0, 2) };
}

export interface FiltrosPesquisa {
  texto: string;
  regiao: RegiaoETF | "todas";
  setor: SetorETF | "todos";
  tipo: TipoXetra | "todos";
}

/** Abreviaturas que a Xetra usa nos nomes: quem escreve a palavra completa também as encontra. */
const ABREVIATURAS: Record<string, string[]> = {
  WORLD: ["WLD", "WRLD", "WO", "W", "AW"],
  EUROPE: ["EUR", "EU", "EUROP", "E"],
  EMERGING: ["EM", "EMERG"],
  MARKETS: ["MKT", "MKTS", "M"],
  JAPAN: ["JPN", "JP"],
  HEALTHCARE: ["HC", "HLTH", "HEALTH"],
  HEALTH: ["HC", "HLTH"],
  TECHNOLOGY: ["TECH", "IT"],
  DIVIDEND: ["DIV", "DV"],
  ACCUMULATING: ["ACC", "A"],
  DISTRIBUTING: ["DIS", "DIST", "D"],
  NASDAQ: ["NDX", "NASDAQ100"],
  ENERGY: ["ENERG", "EN"],
  FINANCIALS: ["FIN", "FINANC"],
  SMALL: ["SC", "SM", "SMALL"],
  CAP: ["C", "CAP"],
};

/** Uma palavra pesquisada aparece no ETF (no nome, no código ou no ISIN, ou como abreviatura). */
function contem(e: EtfXetra, palavra: string): boolean {
  const p = compacto(palavra);
  if (!p) return true;
  const nome = compacto(e.nomeXetra);
  if (nome.includes(p) || e.codigo.toUpperCase().includes(p) || e.isin.toUpperCase().includes(p)) return true;
  const termos = palavras(e.nomeXetra).map(compacto);
  return (ABREVIATURAS[p] ?? []).some((a) => (a.length <= 2 ? termos.includes(a) : nome.includes(a)));
}

/** ETF que cumprem todos os filtros, por ordem do código. Sem nenhum filtro, não devolve nada. */
export function pesquisar(etf: EtfXetra[], f: FiltrosPesquisa): EtfXetra[] {
  const texto = f.texto
    .replace(/S\s*&\s*P/gi, "S+P")
    .split(/\s+/)
    .filter(Boolean);
  if (!texto.length && f.regiao === "todas" && f.setor === "todos" && f.tipo === "todos") return [];
  return etf.filter(
    (e) =>
      (f.regiao === "todas" || e.regiao === f.regiao) &&
      (f.setor === "todos" || e.setor === f.setor) &&
      (f.tipo === "todos" || e.tipo === f.tipo) &&
      texto.every((p) => contem(e, p)),
  );
}

/** Dados com que o ETF entra no formulário do catálogo; o resto preenche-se a partir da ficha do ETF. */
export function paraCatalogo(e: EtfXetra): Partial<ETF> {
  return {
    isin: e.isin,
    ticker: e.codigo,
    nome: e.nomeXetra,
    emitente: e.emitente,
    regiao: e.regiao,
    setor: e.setor,
    domicilio: e.domicilio,
    ...(e.politica ? { politica: e.politica } : {}),
  };
}

/** Endereço da ficha do ETF no justETF, que mostra o TER, o índice, a dimensão e a política. */
export const fichaJustEtf = (isin: string) => `https://www.justetf.com/pt/etf-profile.html?isin=${encodeURIComponent(isin)}`;
