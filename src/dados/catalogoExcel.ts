// Catálogo de ETF em Excel: descarregar todos os dados numa folha, e carregar uma folha com ETF
// novos ou corrigidos. Na carga, cada linha é um ETF (identificado pelo ISIN); a app mostra o que é
// novo, o que muda e o que tem erros, e só grava depois de a pessoa confirmar.

import { problemasETF } from "../calculo/etf";
import { criarLivro, lerLivro, type Celula, type Valor } from "./excel";
import {
  BOLSA,
  NOMES_POLITICA,
  NOMES_REGIAO,
  NOMES_REPLICACAO,
  NOMES_SETOR,
  novoETF,
  type ETF,
} from "./etf";
import { lerData, lerNumero } from "./importarMovimentos";

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const FOLHA_CATALOGO = "Catálogo de ETF";
export const nomeFicheiroCatalogo = (hoje: string) => `catalogo-etf_${hoje}.xlsx`;
const LINHAS = 500;

type Campo = keyof Omit<ETF, "bolsa" | "moedaNegociacao">;

/** Colunas pela ordem. O título serve também para as encontrar ao carregar. */
export const COLUNAS_CATALOGO: { campo: Campo; titulo: string; largura: number; formato?: "data" | "numero" | "texto"; obrigatoria?: boolean }[] = [
  { campo: "ticker", titulo: "Código Xetra", largura: 12, formato: "texto", obrigatoria: true },
  { campo: "isin", titulo: "ISIN", largura: 15, formato: "texto", obrigatoria: true },
  { campo: "nome", titulo: "Nome", largura: 44, formato: "texto", obrigatoria: true },
  { campo: "emitente", titulo: "Emitente", largura: 14, formato: "texto" },
  { campo: "indice", titulo: "Índice", largura: 30, formato: "texto" },
  { campo: "regiao", titulo: "Região", largura: 18, formato: "texto" },
  { campo: "setor", titulo: "Setor", largura: 22, formato: "texto" },
  { campo: "ter", titulo: "TER (%)", largura: 9, formato: "numero", obrigatoria: true },
  { campo: "politica", titulo: "Política de dividendos", largura: 14, formato: "texto" },
  { campo: "dividendosPct", titulo: "Dividendos (%)", largura: 12, formato: "numero" },
  { campo: "dimensao", titulo: "Dimensão (milhões €)", largura: 14, formato: "numero" },
  { campo: "domicilio", titulo: "Domicílio", largura: 10, formato: "texto" },
  { campo: "moedaFundo", titulo: "Moeda do fundo", largura: 10, formato: "texto" },
  { campo: "replicacao", titulo: "Replicação", largura: 18, formato: "texto" },
  { campo: "dataLancamento", titulo: "Data de lançamento", largura: 13, formato: "data" },
  { campo: "numeroPosicoes", titulo: "Nº de posições", largura: 11, formato: "numero" },
  { campo: "atualizadoEm", titulo: "Dados verificados em", largura: 13, formato: "data" },
];

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const colunaDe = (titulo: string) => COLUNAS_CATALOGO.find((c) => normalizar(c.titulo) === normalizar(titulo) || normalizar(c.campo) === normalizar(titulo));

/** Lê uma opção pelo nome que a app mostra («EUA») ou pela chave interna («eua»). */
function opcao<T extends string>(nomes: Record<T, string>, v: Valor): T | null {
  if (v === null || v === "") return null;
  const t = normalizar(String(v));
  return (Object.keys(nomes) as T[]).find((k) => normalizar(k) === t || normalizar(nomes[k]) === t || (t.length >= 4 && normalizar(nomes[k]).startsWith(t))) ?? null;
}

/** Livro com uma linha por ETF (por ordem do código) e as instruções. */
export function livroCatalogo(lista: ETF[]): Uint8Array {
  const ordenada = [...lista].sort((a, b) => (a.ticker || "~").localeCompare(b.ticker || "~", "pt", { numeric: true }));
  const valor = (e: ETF, c: (typeof COLUNAS_CATALOGO)[number]): Celula => {
    const v = e[c.campo];
    if (c.campo === "regiao") return NOMES_REGIAO[e.regiao];
    if (c.campo === "setor") return NOMES_SETOR[e.setor];
    if (c.campo === "politica") return NOMES_POLITICA[e.politica];
    if (c.campo === "replicacao") return NOMES_REPLICACAO[e.replicacao];
    if (c.formato === "data") return v ? { data: String(v) } : null;
    return v === "" || v === undefined ? null : (v as string | number | null);
  };
  const letra = (campo: Campo) => String.fromCharCode(65 + COLUNAS_CATALOGO.findIndex((c) => c.campo === campo));
  const lista_ = (nomes: Record<string, string>) => Object.values(nomes).join(",");
  return criarLivro([
    {
      nome: FOLHA_CATALOGO,
      cabecalho: true,
      colunas: COLUNAS_CATALOGO.map((c) => ({ largura: c.largura, formato: c.formato })),
      linhas: [COLUNAS_CATALOGO.map((c) => c.titulo), ...ordenada.map((e) => COLUNAS_CATALOGO.map((c) => valor(e, c)))],
      validacoes: [
        { intervalo: `${letra("regiao")}2:${letra("regiao")}${LINHAS}`, lista: lista_(NOMES_REGIAO) },
        { intervalo: `${letra("politica")}2:${letra("politica")}${LINHAS}`, lista: lista_(NOMES_POLITICA) },
        { intervalo: `${letra("replicacao")}2:${letra("replicacao")}${LINHAS}`, lista: lista_(NOMES_REPLICACAO) },
      ],
    },
    {
      nome: "Instruções",
      colunas: [{ largura: 110 }],
      linhas: [
        ["Catálogo de ETF"],
        ["1. Uma linha por ETF. Não mude os títulos da linha 1."],
        ["2. Obrigatórios: Código Xetra (por exemplo EUNL), ISIN (12 caracteres), Nome e TER (%)."],
        ["3. Região, Política de dividendos e Replicação: escolha da lista. Setor: um destes — " + Object.values(NOMES_SETOR).join("; ") + "."],
        ["4. Percentagens em %, por exemplo 0,2 para um TER de 0,2%. A dimensão é em milhões de euros."],
        ["5. Para carregar: na app, Catálogo de ETF › Carregar do Excel. Os ETF com um ISIN que já está no catálogo são atualizados; os outros são acrescentados."],
        ["6. A app mostra o que leu antes de gravar. As linhas com erros não entram. Nenhum ETF é apagado do catálogo."],
      ],
    },
  ]);
}

export interface LinhaCatalogo {
  linha: number;
  etf: ETF | null;
  estado: "novo" | "alterado" | "igual" | "erro";
  /** Nomes dos campos que mudam (só nos alterados). */
  mudancas: string[];
  erros: string[];
}

export interface ResultadoCatalogo {
  linhas: LinhaCatalogo[];
  erro: string | null;
}

/** Lê o livro preenchido e compara com o catálogo. */
export function lerLivroCatalogo(bytes: Uint8Array, catalogo: ETF[], hoje: string): ResultadoCatalogo {
  let livro;
  try {
    livro = lerLivro(bytes);
  } catch (e) {
    return { linhas: [], erro: (e as Error).message };
  }
  const folha = livro.folhas.find((f) => normalizar(f.nome) === normalizar(FOLHA_CATALOGO)) ?? livro.folhas[0];
  if (!folha) return { linhas: [], erro: "O ficheiro não tem folhas." };
  const iCab = folha.linhas.findIndex((l) => l.filter((v) => typeof v === "string" && colunaDe(v)).length >= 3);
  if (iCab < 0) return { linhas: [], erro: "Não encontrei os títulos das colunas (Código Xetra, ISIN, Nome…). Use o ficheiro descarregado da app." };
  const pos = new Map<Campo, number>();
  folha.linhas[iCab].forEach((v, i) => {
    const c = typeof v === "string" ? colunaDe(v) : undefined;
    if (c && !pos.has(c.campo)) pos.set(c.campo, i);
  });
  const emFalta = COLUNAS_CATALOGO.filter((c) => c.obrigatoria && !pos.has(c.campo)).map((c) => `«${c.titulo}»`);
  if (emFalta.length) return { linhas: [], erro: `Faltam as colunas ${emFalta.join(", ")}. Use o ficheiro descarregado da app.` };

  const porIsin = new Map(catalogo.map((e) => [e.isin.toUpperCase(), e]));
  const vistos = new Set<string>();
  const linhas: LinhaCatalogo[] = [];
  folha.linhas.slice(iCab + 1).forEach((l, k) => {
    const cel = (c: Campo): Valor => (pos.has(c) ? (l[pos.get(c)!] ?? null) : null);
    if (COLUNAS_CATALOGO.every((c) => cel(c.campo) === null || cel(c.campo) === "")) return;
    const linha = iCab + k + 2;
    const erros: string[] = [];
    const texto = (c: Campo) => (cel(c) === null ? "" : String(cel(c)).trim());
    const isin = texto("isin").toUpperCase().replace(/\s/g, "");
    const antes = porIsin.get(isin);
    const base = antes ? { ...antes } : novoETF(hoje);
    const e: ETF = { ...base, isin, ticker: texto("ticker").toUpperCase(), nome: texto("nome") };
    // Os campos de texto em branco ficam como estavam (ou vazios num ETF novo).
    for (const c of ["emitente", "indice", "domicilio", "moedaFundo"] as const) if (pos.has(c) && texto(c)) e[c] = c === "domicilio" || c === "moedaFundo" ? texto(c).toUpperCase() : texto(c);
    const escolhas: [Campo, Record<string, string>, string][] = [
      ["regiao", NOMES_REGIAO, "Região"],
      ["setor", NOMES_SETOR, "Setor"],
      ["politica", NOMES_POLITICA, "Política de dividendos"],
      ["replicacao", NOMES_REPLICACAO, "Replicação"],
    ];
    for (const [c, nomes, titulo] of escolhas) {
      if (!pos.has(c) || !texto(c)) continue;
      const v = opcao(nomes, cel(c));
      if (v) (e as unknown as Record<string, string>)[c] = v;
      else erros.push(`${titulo} «${texto(c)}» não é uma das opções.`);
    }
    for (const c of ["ter", "dividendosPct", "dimensao", "numeroPosicoes"] as const) {
      if (!pos.has(c)) continue;
      const n = lerNumero(cel(c));
      if (Number.isNaN(n)) erros.push(`${COLUNAS_CATALOGO.find((x) => x.campo === c)!.titulo}: «${texto(c)}» não é um número.`);
      else e[c] = n;
    }
    for (const c of ["dataLancamento", "atualizadoEm"] as const) {
      if (!pos.has(c) || cel(c) === null || cel(c) === "") continue;
      const d = lerData(cel(c), livro.datas1904);
      if (d) e[c] = d;
      else erros.push(`${COLUNAS_CATALOGO.find((x) => x.campo === c)!.titulo}: «${texto(c)}» não é uma data.`);
    }
    e.bolsa = BOLSA;
    e.moedaNegociacao = "EUR";
    if (e.politica === "acumulacao") e.dividendosPct = null;
    if (vistos.has(isin)) erros.push("Este ISIN já apareceu mais acima no ficheiro.");
    vistos.add(isin);
    erros.push(...problemasETF(e));

    if (erros.length) {
      linhas.push({ linha, etf: null, estado: "erro", mudancas: [], erros });
      return;
    }
    if (!antes) {
      linhas.push({ linha, etf: e, estado: "novo", mudancas: [], erros: [] });
      return;
    }
    const mudancas = COLUNAS_CATALOGO.filter((c) => c.campo !== "atualizadoEm" && (antes[c.campo] ?? null) !== (e[c.campo] ?? null)).map((c) => c.titulo);
    // Se o ficheiro não indica a data de verificação, uma alteração conta como verificada hoje.
    if (mudancas.length && (!pos.has("atualizadoEm") || !texto("atualizadoEm"))) e.atualizadoEm = hoje;
    linhas.push({ linha, etf: e, estado: mudancas.length ? "alterado" : "igual", mudancas, erros: [] });
  });
  return { linhas, erro: linhas.length ? null : "O ficheiro não tem nenhum ETF (a partir da linha 2)." };
}

