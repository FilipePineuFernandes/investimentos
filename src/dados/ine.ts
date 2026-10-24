// Dados de referência do INE, publicados com a app em dados/ine.json pelo programa
// scripts/dados-ine.mjs (o INE não deixa o navegador pedi-los diretamente).

export interface FonteIne {
  codigo: string;
  titulo: string;
  /** Data em que o INE atualizou o indicador (AAAA-MM-DD). */
  atualizadoEm: string;
  /** Períodos por ordem, por exemplo "2026-T2" (trimestre) ou "2024-S2" (semestre). */
  periodos: string[];
}

export interface DadosIne {
  geradoEm: string;
  fonte: string;
  /** Valor mediano das vendas por m² nos últimos 12 meses. h = histórico do total; n e e = último valor dos novos e dos existentes. */
  vendas: FonteIne & { valores: Record<string, { h: (number | null)[]; n: number | null; e: number | null }> };
  /** Valor mediano das rendas por m² de novos contratos nos últimos 12 meses, por período. */
  rendas: FonteIne & { valores: Record<string, (number | null)[]> };
  /** Nome de cada município (código de 7 caracteres) e freguesia (9 caracteres). */
  nomes: Record<string, string>;
}

let promessa: Promise<DadosIne | null> | null = null;

/** Lê os dados do INE uma vez por sessão. Null se não for possível (por exemplo, sem internet na primeira abertura). */
export function lerDadosIne(): Promise<DadosIne | null> {
  promessa ??= fetch(`${import.meta.env.BASE_URL}dados/ine.json`)
    .then((r) => (r.ok ? (r.json() as Promise<DadosIne>) : null))
    .catch(() => null);
  return promessa;
}

export const ehMunicipio = (geocod: string) => geocod.length === 7;

/** O município de uma freguesia: os primeiros 7 caracteres do código. */
export const municipioDe = (freguesia: string) => freguesia.slice(0, 7);

export function municipios(d: DadosIne): { geocod: string; nome: string }[] {
  return Object.entries(d.nomes)
    .filter(([g]) => ehMunicipio(g))
    .map(([geocod, nome]) => ({ geocod, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

export function freguesias(d: DadosIne, municipio: string): { geocod: string; nome: string }[] {
  return Object.entries(d.nomes)
    .filter(([g]) => g.length === 9 && municipioDe(g) === municipio)
    .map(([geocod, nome]) => ({ geocod, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

/** "2026-T2" → "2.º trim. 2026"; "2024-S2" → "2.º sem. 2024". */
export function nomePeriodo(p: string): string {
  const [ano, x] = p.split("-");
  return `${x[1]}.º ${x[0] === "T" ? "trim." : "sem."} ${ano}`;
}

/** Último dia do período, para saber se o valor está desatualizado. */
export function fimPeriodo(p: string): string {
  const [ano, x] = p.split("-");
  const n = Number(x[1]);
  const mes = x[0] === "T" ? n * 3 : n * 6;
  return `${ano}-${String(mes).padStart(2, "0")}-${mes === 3 || mes === 12 ? 31 : 30}`;
}
