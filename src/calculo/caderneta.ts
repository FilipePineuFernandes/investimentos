// Leitura da caderneta predial urbana (PDF descarregado do Portal das Finanças). Tira do texto
// o que serve para o imóvel: localização, concelho e freguesia (com os códigos oficiais), tipo e
// tipologia, área, VPT, ano de inscrição na matriz e as coordenadas. Os titulares (nomes e NIF)
// não são lidos.

import type { Coordenadas } from "./geo";
import type { Regiao } from "../dados/perfil";

export interface LeituraCaderneta {
  /** Código do concelho (distrito + concelho, 4 algarismos) e da freguesia (6 algarismos). */
  codigoConcelho: string | null;
  codigoFreguesia: string | null;
  concelho: string;
  freguesia: string;
  regiao: Regiao | null;
  morada: string;
  artigo: string;
  fracao: string;
  /** Fração autónoma (apartamento) ou prédio inteiro (moradia). */
  moradia: boolean | null;
  /** T0, T1, T2, T3, T4 ou T5+. */
  tipologia: string;
  afetacao: string;
  /** Área bruta privativa (da fração, se a houver), em m². */
  area: number | null;
  vpt: number | null;
  anoVpt: number | null;
  /** Ano de inscrição na matriz: quase sempre o ano da construção (ou pouco depois). */
  anoInscricao: number | null;
  coordenadas: Coordenadas | null;
}

/** Texto seguido do valor até ao próximo rótulo («Xxx:») ou ao fim da linha. */
function campo(texto: string, rotulo: string, ate = "\\s{2,}[A-ZÁÉÍÓÚÂÊÔÃÕÇa-zº/ .*()]+:|\\n|$"): string {
  const m = new RegExp(`${rotulo}\\s*:?\\s*([\\s\\S]*?)(?:${ate})`).exec(texto);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/** «82.733,99», «€82.733,99» ou «72,4500» → número. */
function numero(t: string): number | null {
  const m = /-?[\d.]+(,\d+)?/.exec(t.replace(/€/g, ""));
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** «UNIÃO DAS FREGUESIAS DE SÃO MARTINHO» → «União das Freguesias de São Martinho». */
export function nomeProprio(t: string): string {
  const pequenas = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);
  return t
    .toLocaleLowerCase("pt-PT")
    .split(/\s+/)
    .filter(Boolean)
    .map((p, k) => (k > 0 && pequenas.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-PT") + p.slice(1)))
    .join(" ");
}

/** Região do IMT pelo distrito: 31–32 Madeira, 41–49 Açores. */
function regiaoDoDistrito(d: number): Regiao {
  if (d === 31 || d === 32) return "madeira";
  if (d >= 41 && d <= 49) return "acores";
  return "continente";
}

/** Tipologia nas opções da app: T0…T4 ou T5+. */
function tipologiaApp(t: string): string {
  const m = /T\s*(\d+)/i.exec(t);
  if (!m) return "";
  const n = Number(m[1]);
  return n >= 5 ? "T5+" : `T${n}`;
}

/**
 * Coordenadas da caderneta (Hayford-Gauss, Datum Lisboa, «militares») → latitude e longitude (WGS84).
 * Projeção inversa de Gauss sobre o elipsoide internacional de 1924 e mudança de datum com três parâmetros
 * (erro de poucos metros, chega para o mapa).
 */
export function hayfordGaussParaWgs84(x: number, y: number): Coordenadas {
  const rad = Math.PI / 180;
  // Elipsoide internacional (Hayford 1924)
  const a = 6378388;
  const f = 1 / 297;
  const e2 = f * (2 - f);
  const lat0 = 39 + 40 / 60;
  const lon0 = -(8 + 7 / 60 + 54.862 / 3600);
  const fe = 200000;
  const fn = 300000;
  const arco = (phi: number) =>
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const m = arco(lat0 * rad) + (y - fn);
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const ep2 = e2 / (1 - e2);
  const c1 = ep2 * Math.cos(phi1) ** 2;
  const t1 = Math.tan(phi1) ** 2;
  const n1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2);
  const r1 = (a * (1 - e2)) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5;
  const d = (x - fe) / n1;
  const phi =
    phi1 -
    ((n1 * Math.tan(phi1)) / r1) *
      (d ** 2 / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 + ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lam = lon0 * rad + (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) / 120) / Math.cos(phi1);

  // Datum Lisboa → WGS84 (translação geocêntrica)
  const nn = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const gx = nn * Math.cos(phi) * Math.cos(lam) - 304.046;
  const gy = nn * Math.cos(phi) * Math.sin(lam) - 60.576;
  const gz = nn * (1 - e2) * Math.sin(phi) + 103.64;
  const aw = 6378137;
  const fw = 1 / 298.257223563;
  const e2w = fw * (2 - fw);
  const p = Math.hypot(gx, gy);
  let lat = Math.atan2(gz, p * (1 - e2w));
  for (let k = 0; k < 6; k++) {
    const nw = aw / Math.sqrt(1 - e2w * Math.sin(lat) ** 2);
    lat = Math.atan2(gz + e2w * nw * Math.sin(lat), p);
  }
  const arred = (v: number) => Math.round(v * 1e6) / 1e6;
  return { lat: arred(lat / rad), lng: arred(Math.atan2(gy, gx) / rad) };
}

/** Lê o texto do PDF da caderneta. Null se não parecer uma caderneta predial urbana. */
export function lerCaderneta(texto: string): LeituraCaderneta | null {
  if (!/CADERNETA\s+PREDIAL/i.test(texto)) return null;
  // Só a primeira página tem o prédio; a segunda tem os titulares (não lidos).
  const t = texto.split(/TITULARES/i)[0];

  const distrito = /DISTRITO:\s*(\d{2})\s*-/.exec(t);
  const concelho = /CONCELHO:\s*(\d{2})\s*-\s*([^\n]+?)\s{2,}FREGUESIA/.exec(t);
  const freguesia = /FREGUESIA:\s*(\d{2})\s*-\s*([\s\S]+?)\n(?:ARTIGO|\s*\(|.*Tipo:)/.exec(t);
  const codigoConcelho = distrito && concelho ? distrito[1] + concelho[1] : null;

  // A localização da fração, se a houver; senão a do prédio.
  const blocoFracao = t.split(/FRAC?ÇÃO\s+AUTÓNOMA/i)[1] ?? "";
  const fonteLocal = blocoFracao || t;
  const rua = campo(fonteLocal, "Av\\./Rua/Praça", "\\s{2,}(?:Lugar|N[º°o] de [Pp]olícia):|\\n|$");
  const numeroPorta = campo(fonteLocal, "Nº de [Pp]olícia", "\\s{2,}|\\n|$");
  const codigoPostal = campo(fonteLocal, "Código Postal", "\\n|$");
  const andar = blocoFracao ? campo(blocoFracao, "Andar/Divisão", "\\s{2,}|\\n|$") : "";
  const cp = /(\d{4}-\d{3})\s*(.*)/.exec(codigoPostal);
  const morada = [
    [rua, numeroPorta].filter(Boolean).join(" "),
    andar,
    cp ? `${cp[1]} ${nomeProprio(cp[2])}`.trim() : "",
  ]
    .filter(Boolean)
    .join(", ");

  const fracao = /FRAC?ÇÃO\s+AUTÓNOMA:\s*([A-Z]{1,3})\b/i.exec(t)?.[1] ?? "";
  const tipoPredio = campo(t, "Tipo de Prédio");
  const elementos = blocoFracao || t;
  const tipologia = tipologiaApp(campo(elementos, "Tipologia/Divisões", "\\s{2,}|\\n|$"));
  const afetacao = campo(elementos, "Afec?tação", "\\s{2,}|\\n|$");

  // Área bruta privativa: a da fração; num prédio sem frações, a do prédio.
  const areaFracao = blocoFracao ? /Área\s+bruta\s+privativa:\s*([\d.,]+)/i.exec(blocoFracao) : null;
  const areaPredio = /Área\s+bruta\s+privativa(?:\s+total)?:\s*\n?\s*([\d.,]+)/i.exec(t);
  const area = numero((areaFracao ?? areaPredio)?.[1] ?? "");

  const vpt = numero(/Valor\s+patrimonial\s+actual[^:]*:\s*€?\s*([\d.,]+)/i.exec(t)?.[1] ?? "");
  const anoVpt = numero(/Determinado\s+no\s+ano:\s*(\d{4})/i.exec(t)?.[1] ?? "");
  const anoInscricao = numero(/Ano\s+de\s+inscrição\s+na\s+matriz:\s*(\d{4})/i.exec(t)?.[1] ?? "");

  const cx = numero(/Coordenada\s+X:\s*([\d.,-]+)/i.exec(t)?.[1] ?? "");
  const cy = numero(/Coordenada\s+Y:\s*([\d.,-]+)/i.exec(t)?.[1] ?? "");
  // Só as coordenadas «militares» (dentro do continente) se convertem com segurança.
  const coordenadas = cx && cy && cx > 0 && cx < 400000 && cy > 0 && cy < 600000 ? hayfordGaussParaWgs84(cx, cy) : null;

  return {
    codigoConcelho,
    codigoFreguesia: codigoConcelho && freguesia ? codigoConcelho + freguesia[1] : null,
    concelho: concelho ? nomeProprio(concelho[2]) : "",
    freguesia: freguesia ? nomeProprio(freguesia[2].replace(/\s+/g, " ").trim()) : "",
    regiao: distrito ? regiaoDoDistrito(Number(distrito[1])) : null,
    morada,
    artigo: /ARTIGO\s+MATRICIAL:\s*(\d+)/i.exec(t)?.[1] ?? "",
    fracao,
    moradia: fracao || /Prop\.?\s*Horiz/i.test(tipoPredio) ? false : tipoPredio || tipologia ? true : null,
    tipologia,
    afetacao,
    area,
    vpt,
    anoVpt: anoVpt ? Math.round(anoVpt) : null,
    anoInscricao: anoInscricao ? Math.round(anoInscricao) : null,
    coordenadas: distrito && regiaoDoDistrito(Number(distrito[1])) === "continente" ? coordenadas : null,
  };
}
