// Portais imobiliários onde o utilizador procura comparáveis (ponto 5.3, nível 2).
//
// A app não lê os anúncios (os portais não têm acesso aberto e proíbem a recolha automática):
// só cria o endereço da pesquisa, que o utilizador abre no navegador, como um favorito.
// Os endereços diretos foram confirmados em 24/10/2026. Para os portais em que não foi possível
// confirmar o formato, usa-se uma pesquisa no Google limitada a esse portal, que funciona sempre.

/** Segmento do anúncio. Só "mercado" entra nas medianas principais. */
export type Segmento = "mercado" | "leilao" | "temporario" | "quarto";
export type Operacao = "venda" | "arrendamento";

export const NOMES_SEGMENTO: Record<Segmento, string> = {
  mercado: "Mercado",
  leilao: "Leilão",
  temporario: "Arrendamento temporário",
  quarto: "Quarto",
};

export interface Pesquisa {
  operacao: Operacao;
  /** "T0" … "T5+", ou null (armazéns). */
  tipologia: string | null;
  moradia: boolean;
  distrito: string | null;
  municipio: string | null;
  freguesia: string | null;
  precoMin: number | null;
  precoMax: number | null;
  areaMin: number | null;
}

export interface Portal {
  id: string;
  nome: string;
  dominios: string[];
  operacoes: Operacao[];
  segmento: Segmento;
  nota?: string;
  /** Endereço direto da pesquisa, ou null para usar a pesquisa no Google. */
  direto?: (p: Pesquisa) => string | null;
}

/** "Vila Nova de Gaia" → "vila-nova-de-gaia". */
export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Caminho da zona nos portais: distrito/concelho/freguesia. As uniões de freguesias do INE
 * têm outros nomes nos portais, por isso nesses casos a pesquisa fica no concelho.
 */
const zona = (p: Pesquisa) =>
  [p.distrito, p.municipio, p.freguesia && !/^união das freguesias/i.test(p.freguesia) ? p.freguesia : null]
    .filter(Boolean)
    .map((x) => slug(x!))
    .join("/");

const tipo = (p: Pesquisa) => (p.tipologia ? p.tipologia.replace("+", "").toLowerCase() : null);

export const PORTAIS: Portal[] = [
  {
    id: "idealista",
    nome: "Idealista",
    dominios: ["idealista.pt"],
    operacoes: ["venda", "arrendamento"],
    segmento: "mercado",
  },
  {
    id: "imovirtual",
    nome: "Imovirtual",
    dominios: ["imovirtual.com"],
    operacoes: ["venda", "arrendamento"],
    segmento: "mercado",
    direto: (p) => {
      if (!p.distrito || !p.municipio) return null;
      const categoria = [p.moradia ? "moradia" : "apartamento", tipo(p)].filter(Boolean).join(",");
      const q = new URLSearchParams();
      if (p.precoMin) q.set("priceMin", String(Math.round(p.precoMin)));
      if (p.precoMax) q.set("priceMax", String(Math.round(p.precoMax)));
      if (p.areaMin) q.set("areaMin", String(Math.round(p.areaMin)));
      const s = q.toString();
      return `https://www.imovirtual.com/pt/resultados/${p.operacao === "venda" ? "comprar" : "arrendar"}/${categoria}/${zona(p)}${s ? `?${s}` : ""}`;
    },
  },
  { id: "supercasa", nome: "SUPERCASA", dominios: ["supercasa.pt"], operacoes: ["venda", "arrendamento"], segmento: "mercado" },
  { id: "casasapo", nome: "Casa Sapo", dominios: ["casa.sapo.pt"], operacoes: ["venda", "arrendamento"], segmento: "mercado" },
  {
    id: "remax",
    nome: "RE/MAX",
    dominios: ["remax.pt"],
    operacoes: ["venda", "arrendamento"],
    segmento: "mercado",
    direto: (p) => {
      if (!p.distrito || !p.municipio) return null;
      const t = tipo(p);
      return `https://www.remax.pt/pt/${p.operacao === "venda" ? "comprar" : "arrendar"}/imoveis/${p.moradia ? "moradia" : "apartamento"}/${zona(p)}${t ? `/r/${t}` : ""}`;
    },
  },
  { id: "century21", nome: "Century 21", dominios: ["century21.pt"], operacoes: ["venda", "arrendamento"], segmento: "mercado" },
  { id: "era", nome: "ERA", dominios: ["era.pt"], operacoes: ["venda", "arrendamento"], segmento: "mercado" },
  {
    id: "eleiloes",
    nome: "e-Leilões",
    dominios: ["e-leiloes.pt"],
    operacoes: ["venda"],
    segmento: "leilao",
    nota: "Vendas judiciais: os valores ficam à parte e não entram na mediana do mercado.",
  },
  { id: "olx", nome: "OLX", dominios: ["olx.pt"], operacoes: ["arrendamento"], segmento: "mercado", nota: "Muitos senhorios particulares, sem comissão." },
  { id: "custojusto", nome: "CustoJusto", dominios: ["custojusto.pt"], operacoes: ["arrendamento"], segmento: "mercado", nota: "Muitos senhorios particulares, sem comissão." },
  { id: "uniplaces", nome: "Uniplaces", dominios: ["uniplaces.com"], operacoes: ["arrendamento"], segmento: "temporario", nota: "Estudantes e estadias de média duração." },
  {
    id: "housinganywhere",
    nome: "HousingAnywhere",
    dominios: ["housinganywhere.com"],
    operacoes: ["arrendamento"],
    segmento: "temporario",
    nota: "Profissionais e estudantes deslocados.",
  },
  { id: "bquarto", nome: "BQuarto", dominios: ["bquarto.pt"], operacoes: ["arrendamento"], segmento: "quarto", nota: "Só quartos." },
  { id: "roomgo", nome: "Roomgo", dominios: ["roomgo.pt", "roomgo.com"], operacoes: ["arrendamento"], segmento: "quarto", nota: "Só quartos e casas partilhadas." },
];

/** Pesquisa no Google limitada ao portal, com a tipologia, a operação e a zona. */
export function pesquisaGoogle(portal: Portal, p: Pesquisa): string {
  const termos = [
    `site:${portal.dominios[0]}`,
    portal.segmento === "quarto" ? "quarto" : (p.tipologia ?? (p.moradia ? "moradia" : "")),
    portal.segmento === "leilao" ? "imóvel" : p.operacao === "venda" ? "comprar" : "arrendar",
    p.freguesia,
    p.municipio,
  ].filter(Boolean);
  return `https://www.google.com/search?q=${encodeURIComponent(termos.join(" "))}`;
}

export function linkPesquisa(portal: Portal, p: Pesquisa): { url: string; direto: boolean } {
  const direto = portal.direto?.(p) ?? null;
  return direto ? { url: direto, direto: true } : { url: pesquisaGoogle(portal, p), direto: false };
}

/** O portal de um anúncio, pelo endereço colado. Null se não for um dos portais conhecidos. */
export function portalDoLink(link: string): Portal | null {
  let host: string;
  try {
    host = new URL(link.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PORTAIS.find((p) => p.dominios.some((d) => host === d || host.endsWith(`.${d}`))) ?? null;
}

// --- Distritos -------------------------------------------------------------------------------

/** Distrito pelo código DICO do município (os 2 primeiros dígitos). */
const DISTRITOS: Record<string, string> = {
  "01": "Aveiro",
  "02": "Beja",
  "03": "Braga",
  "04": "Bragança",
  "05": "Castelo Branco",
  "06": "Coimbra",
  "07": "Évora",
  "08": "Faro",
  "09": "Guarda",
  "10": "Leiria",
  "11": "Lisboa",
  "12": "Portalegre",
  "13": "Porto",
  "14": "Santarém",
  "15": "Setúbal",
  "16": "Viana do Castelo",
  "17": "Vila Real",
  "18": "Viseu",
};

/**
 * Distrito de um município pelo código do INE (7 caracteres: NUTS III + DICO).
 * Null nas regiões autónomas, que os portais organizam de outra forma.
 */
export function distritoDe(geoMunicipio: string): string | null {
  return DISTRITOS[geoMunicipio.slice(3, 5)] ?? null;
}
