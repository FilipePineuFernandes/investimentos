// Importar movimentos da carteira de ETF a partir de um livro de Excel (ponto 6.11: "registar
// compras feitas fora deste fluxo… importação"). A pessoa descarrega o modelo, preenche uma linha
// por movimento e envia o ficheiro; a app mostra o que leu, o que tem erros e o que já estava
// registado, e só grava depois de a pessoa confirmar.

import { criarLivro, dataDeSerie, lerLivro, type Celula, type Valor } from "./excel";
import type { ETF } from "./etf";
import type { Movimento, TipoMovimento } from "./movimentosEtf";

export const NOME_MODELO = "modelo-movimentos-etf.xlsx";
export const FOLHA_MOVIMENTOS = "Movimentos";
const FOLHA_CATALOGO = "ETF do catálogo";
const LINHAS_MODELO = 1000;

/** Colunas do modelo, pela ordem. O nome de cada uma serve para a encontrar mesmo que mude de sítio. */
export const COLUNAS = [
  { chave: "data", titulo: "Data", largura: 13, formato: "data" },
  { chave: "tipo", titulo: "Tipo", largura: 12, formato: "texto" },
  { chave: "codigo", titulo: "Código Xetra ou ISIN", largura: 22, formato: "texto" },
  { chave: "quantidade", titulo: "Unidades", largura: 12, formato: "numero" },
  { chave: "preco", titulo: "Preço por unidade (€)", largura: 16, formato: "numero" },
  { chave: "comissao", titulo: "Comissão e câmbio (€)", largura: 16, formato: "numero" },
  { chave: "valor", titulo: "Dividendo bruto (€)", largura: 16, formato: "numero" },
  { chave: "imposto", titulo: "Imposto retido (€)", largura: 16, formato: "numero" },
] as const;
type Chave = (typeof COLUNAS)[number]["chave"];

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Palavras que identificam cada coluna no cabeçalho (sem acentos, maiúsculas nem espaços). */
const SINONIMOS: Record<Chave, string[]> = {
  data: ["data", "date"],
  tipo: ["tipo", "movimento", "operacao"],
  codigo: ["codigo", "codigoxetra", "isin", "ticker", "etf"],
  quantidade: ["unidades", "quantidade"],
  preco: ["preco", "precoporunidade", "precounitario"],
  comissao: ["comissao", "comissoes", "custos"],
  valor: ["dividendo", "dividendobruto"],
  imposto: ["imposto", "impostoretido", "retencao"],
};

/** Livro de Excel com o modelo para preencher, a lista dos ETF do catálogo e as instruções. */
export function criarModelo(catalogo: ETF[]): Uint8Array {
  const etf = [...catalogo]
    .filter((e) => e.ticker?.trim())
    .sort((a, b) => a.ticker.localeCompare(b.ticker, "pt", { numeric: true }));
  const instrucoes: Celula[][] = [
    ["Como preencher"],
    ["1. Na folha «Movimentos», escreva um movimento por linha, a começar na linha 2. Não mude os títulos da linha 1."],
    ["2. Data: o dia do movimento, por exemplo 15/03/2024."],
    ["3. Tipo: Compra, Venda ou Dividendo."],
    ["4. Código Xetra ou ISIN: o código do ETF (por exemplo EUNL) ou o ISIN (por exemplo IE00B4L5Y983). O ETF tem de estar no catálogo da app (folha «ETF do catálogo»)."],
    ["5. Compras e vendas: preencha Unidades, Preço por unidade e, se houve, Comissão e câmbio. Deixe os dividendos em branco."],
    ["6. Dividendos: preencha Dividendo bruto e, se houve, Imposto retido. Deixe as unidades e o preço em branco."],
    ["7. Valores em euros. Pode usar vírgula nas casas decimais."],
    ["8. Grave o ficheiro em formato .xlsx e envie-o na app, em Carteira de ETF › Importar do Excel."],
    [""],
    ["A app mostra o que leu antes de gravar. As linhas com erros não entram, e os movimentos que já estavam registados também não (pode enviar o mesmo ficheiro mais do que uma vez)."],
    [""],
    ["Exemplo"],
    ["Data", "Tipo", "Código Xetra ou ISIN", "Unidades", "Preço por unidade (€)", "Comissão e câmbio (€)", "Dividendo bruto (€)", "Imposto retido (€)"],
    [{ data: "2024-03-15" }, "Compra", "EUNL", 10, 85.42, 1.5, null, null],
    [{ data: "2025-06-02" }, "Venda", "EUNL", 4, 101.3, 1.5, null, null],
    [{ data: "2025-07-10" }, "Dividendo", "IE00B3RBWM25", null, null, null, 12.4, 3.47],
  ];
  return criarLivro([
    {
      nome: FOLHA_MOVIMENTOS,
      cabecalho: true,
      colunas: COLUNAS.map((c) => ({ largura: c.largura, formato: c.formato })),
      linhas: [COLUNAS.map((c) => c.titulo)],
      validacoes: [
        { intervalo: `B2:B${LINHAS_MODELO}`, lista: "Compra,Venda,Dividendo" },
        ...(etf.length ? [{ intervalo: `C2:C${LINHAS_MODELO}`, lista: `'${FOLHA_CATALOGO}'!$A$2:$A$${etf.length + 1}`, aceitaOutros: true }] : []),
      ],
    },
    {
      nome: FOLHA_CATALOGO,
      cabecalho: true,
      colunas: [{ largura: 12 }, { largura: 16 }, { largura: 50 }],
      linhas: [["Código Xetra", "ISIN", "Nome"], ...etf.map((e) => [e.ticker.trim().toUpperCase(), e.isin, e.nome])],
    },
    {
      nome: "Instruções",
      colunas: [{ largura: 13 }, { largura: 12 }, { largura: 22 }, { largura: 12 }, { largura: 16 }, { largura: 16 }, { largura: 16 }, { largura: 16 }],
      linhas: instrucoes,
    },
  ]);
}

// ---------------------------------------------------------------- Ler o ficheiro preenchido

export interface LinhaImportada {
  /** Número da linha no Excel (2 = primeira linha de dados). */
  linha: number;
  /** O movimento, se a linha estiver correta. */
  movimento: Movimento | null;
  /** Código do ETF como aparece na app (EUNL…), para mostrar. */
  codigo: string;
  erros: string[];
  /** Já existe um movimento igual na carteira (ou mais acima no ficheiro). */
  repetido: boolean;
}

export interface ResultadoImportacao {
  linhas: LinhaImportada[];
  /** Erro que impede ler o ficheiro (formato errado, sem cabeçalho…). */
  erro: string | null;
}

/** Número a partir de uma célula: aceita 1234.5, "1234,5", "1 234,50 €" e "1.234,50". */
export function lerNumero(v: Valor): number | null {
  if (v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "boolean") return NaN;
  let t = v.replace(/[€\s ]/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** Data (AAAA-MM-DD) a partir de uma célula: número de série do Excel, 15/03/2024, 15-03-2024 ou 2024-03-15. */
export function lerData(v: Valor, datas1904 = false): string | null {
  if (v === null) return null;
  if (typeof v === "number") return v > 0 && v < 2_958_466 ? dataDeSerie(v, datas1904) : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  let a: number, m: number, d: number;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
  return data.toISOString().slice(0, 10);
}

function lerTipo(v: Valor): TipoMovimento | null {
  if (typeof v !== "string") return null;
  const t = normalizar(v);
  if (t.startsWith("compra") || t === "buy") return "compra";
  if (t.startsWith("venda") || t === "sell") return "venda";
  if (t.startsWith("dividendo") || t === "dividend") return "dividendo";
  return null;
}

/** Identifica o mesmo movimento (para não o registar duas vezes). */
const assinatura = (m: Movimento) =>
  [m.isin, m.tipo, m.data, m.quantidade.toFixed(6), m.preco.toFixed(4), m.comissao.toFixed(2), m.valor.toFixed(2), m.imposto.toFixed(2)].join("|");

/** Lê o ficheiro preenchido e verifica cada linha, sem gravar nada. */
export function interpretarFicheiro(
  bytes: Uint8Array,
  catalogo: ETF[],
  existentes: Movimento[],
  opcoes: { corretora: string; novoId?: () => string },
): ResultadoImportacao {
  let livro;
  try {
    livro = lerLivro(bytes);
  } catch (e) {
    return { linhas: [], erro: (e as Error).message };
  }
  const folha = livro.folhas.find((f) => normalizar(f.nome) === normalizar(FOLHA_MOVIMENTOS)) ?? livro.folhas[0];
  if (!folha) return { linhas: [], erro: "O ficheiro não tem folhas." };

  // Cabeçalho: a primeira linha com pelo menos três títulos conhecidos.
  const indiceCabecalho = folha.linhas.findIndex((l) => l.filter((v) => typeof v === "string" && colunaDe(v)).length >= 3);
  if (indiceCabecalho < 0) {
    return { linhas: [], erro: `Não encontrei os títulos das colunas (Data, Tipo, Código Xetra ou ISIN…). Use o modelo da app e não mude a linha 1 da folha «${FOLHA_MOVIMENTOS}».` };
  }
  const posicao = new Map<Chave, number>();
  folha.linhas[indiceCabecalho].forEach((v, i) => {
    const c = typeof v === "string" ? colunaDe(v) : null;
    if (c && !posicao.has(c)) posicao.set(c, i);
  });
  const emFalta = (["data", "tipo", "codigo"] as Chave[]).filter((c) => !posicao.has(c));
  if (emFalta.length) {
    return { linhas: [], erro: `Faltam as colunas ${emFalta.map((c) => `«${COLUNAS.find((x) => x.chave === c)!.titulo}»`).join(", ")}. Use o modelo da app.` };
  }

  const porCodigo = new Map<string, ETF>();
  for (const e of catalogo) {
    porCodigo.set(e.isin.toUpperCase(), e);
    if (e.ticker?.trim()) porCodigo.set(e.ticker.trim().toUpperCase(), e);
  }
  const vistos = new Set(existentes.map(assinatura));
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID());

  const linhas: LinhaImportada[] = [];
  folha.linhas.slice(indiceCabecalho + 1).forEach((l, i) => {
    const celula = (c: Chave): Valor => (posicao.has(c) ? (l[posicao.get(c)!] ?? null) : null);
    if (COLUNAS.every((c) => celula(c.chave) === null)) return; // linha vazia

    const numeroLinha = indiceCabecalho + i + 2;
    const erros: string[] = [];
    const data = lerData(celula("data"), livro.datas1904);
    if (!data) erros.push(celula("data") === null ? "Falta a data." : "A data não é válida (use, por exemplo, 15/03/2024).");
    else if (data > new Date().toISOString().slice(0, 10)) erros.push("A data é no futuro.");

    const tipo = lerTipo(celula("tipo"));
    if (!tipo) erros.push(celula("tipo") === null ? "Falta o tipo (Compra, Venda ou Dividendo)." : "O tipo tem de ser Compra, Venda ou Dividendo.");

    const textoCodigo = String(celula("codigo") ?? "")
      .trim()
      .toUpperCase()
      .replace(/\.(DE|DEX|F|XETRA)$/, "");
    const etf = textoCodigo ? porCodigo.get(textoCodigo) : undefined;
    if (!textoCodigo) erros.push("Falta o código Xetra ou o ISIN.");
    else if (!etf) erros.push(`O ETF «${textoCodigo}» não está no catálogo. Acrescente-o primeiro ao catálogo.`);

    const num = (c: Chave, nome: string, obrigatorio: boolean) => {
      const n = lerNumero(celula(c));
      if (Number.isNaN(n)) erros.push(`${nome}: não é um número.`);
      else if (n === null && obrigatorio) erros.push(`Falta: ${nome.toLowerCase()}.`);
      else if (n !== null && n < 0) erros.push(`${nome}: não pode ser negativo.`);
      else if (n === 0 && obrigatorio) erros.push(`${nome}: tem de ser maior que zero.`);
      return Number.isNaN(n) || n === null ? 0 : n;
    };
    const dividendo = tipo === "dividendo";
    const quantidade = num("quantidade", "Unidades", !!tipo && !dividendo);
    const preco = num("preco", "Preço por unidade", !!tipo && !dividendo);
    const comissao = num("comissao", "Comissão e câmbio", false);
    const valor = num("valor", "Dividendo bruto", dividendo);
    const imposto = num("imposto", "Imposto retido", false);
    if (dividendo && imposto > valor) erros.push("O imposto retido é maior do que o dividendo.");

    const codigo = etf ? etf.ticker?.trim().toUpperCase() || etf.isin : textoCodigo;
    if (erros.length || !etf || !tipo || !data) {
      linhas.push({ linha: numeroLinha, movimento: null, codigo, erros, repetido: false });
      return;
    }
    const movimento: Movimento = {
      id: novoId(),
      isin: etf.isin,
      tipo,
      data,
      quantidade: dividendo ? 0 : quantidade,
      preco: dividendo ? 0 : preco,
      comissao: dividendo ? 0 : comissao,
      valor: dividendo ? valor : 0,
      imposto: dividendo ? imposto : 0,
      corretora: opcoes.corretora,
      origem: tipo === "compra" ? "propria" : null,
    };
    const a = assinatura(movimento);
    const repetido = vistos.has(a);
    vistos.add(a);
    linhas.push({ linha: numeroLinha, movimento, codigo, erros: [], repetido });
  });

  if (linhas.length === 0) return { linhas, erro: `A folha «${folha.nome}» não tem movimentos. Escreva um por linha, a partir da linha 2.` };
  return { linhas, erro: null };
}

function colunaDe(titulo: string): Chave | null {
  const t = normalizar(titulo);
  if (!t) return null;
  // Primeiro o título exato do modelo, depois os sinónimos (o mais comprido primeiro, para
  // «dividendobruto» não ser confundido com outra coluna).
  const exato = COLUNAS.find((c) => normalizar(c.titulo) === t);
  if (exato) return exato.chave;
  let melhor: { chave: Chave; tamanho: number } | null = null;
  for (const [chave, palavras] of Object.entries(SINONIMOS) as [Chave, string[]][]) {
    for (const p of palavras) if (t.startsWith(p) && (!melhor || p.length > melhor.tamanho)) melhor = { chave, tamanho: p.length };
  }
  return melhor?.chave ?? null;
}
