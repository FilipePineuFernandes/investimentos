// Ficheiros Excel (.xlsx) sem bibliotecas grandes: um .xlsx é um ficheiro zip com folhas em XML.
// O fflate trata do zip; aqui escreve-se e lê-se só o que a app precisa (texto, números e datas).
// Funciona sem internet e não usa workers, por isso cabe na política de segurança da app.

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

// ---------------------------------------------------------------- Escrever

/** Uma célula: texto, número, data (AAAA-MM-DD) ou vazia. */
export type Celula = string | number | { data: string } | null;

export interface Validacao {
  /** Intervalo de células, por exemplo "B2:B1000". */
  intervalo: string;
  /** Lista de valores ("Compra,Venda") ou uma referência a outra folha ("'ETF'!$A$2:$A$20"). */
  lista: string;
  /** true: aceita outros valores (a lista é só uma sugestão). */
  aceitaOutros?: boolean;
}

export interface FolhaNova {
  nome: string;
  /** Largura de cada coluna (em caracteres) e o formato do que se escrever nela. */
  colunas: { largura: number; formato?: "data" | "numero" | "texto" }[];
  linhas: Celula[][];
  /** A primeira linha é o cabeçalho: a negrito e fixa ao deslizar. */
  cabecalho?: boolean;
  validacoes?: Validacao[];
}

// Estilos (índices em cellXfs): 0 normal, 1 cabeçalho, 2 data, 3 número, 4 texto com quebra de linha.
const ESTILO = { normal: 0, cabecalho: 1, data: 2, numero: 3, texto: 4 } as const;

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Letra(s) da coluna: 0 → A, 25 → Z, 26 → AA. */
export function letraColuna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Número de série do Excel para uma data (sistema de 1900). */
export function serieExcel(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function folhaXml(f: FolhaNova): string {
  const estiloColuna = (c: FolhaNova["colunas"][number]) => (c.formato ? ESTILO[c.formato] : ESTILO.normal);
  const cols = f.colunas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"${c.formato ? ` style="${estiloColuna(c)}"` : ""}/>`)
    .join("");
  const linhas = f.linhas
    .map((linha, r) => {
      const celulas = linha
        .map((v, c) => {
          if (v === null || v === "") return "";
          const ref = `${letraColuna(c)}${r + 1}`;
          const estilo = f.cabecalho && r === 0 ? ESTILO.cabecalho : estiloColuna(f.colunas[c] ?? { largura: 10 });
          const s = estilo ? ` s="${estilo}"` : "";
          if (typeof v === "number") return `<c r="${ref}"${s}><v>${v}</v></c>`;
          if (typeof v === "object") return `<c r="${ref}" s="${ESTILO.data}"><v>${serieExcel(v.data)}</v></c>`;
          return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${celulas}</row>`;
    })
    .join("");
  const vista = f.cabecalho
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const validacoes = f.validacoes?.length
    ? `<dataValidations count="${f.validacoes.length}">${f.validacoes
        .map(
          (v) =>
            `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="${v.aceitaOutros ? 0 : 1}" sqref="${v.intervalo}"><formula1>${escapar(
              v.lista.includes("!") ? v.lista : `"${v.lista}"`,
            )}</formula1></dataValidation>`,
        )
        .join("")}</dataValidations>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${vista}<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${linhas}</sheetData>${validacoes}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00####"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F7B6C"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Cria um livro de Excel (.xlsx) com as folhas indicadas. */
export function criarLivro(folhas: FolhaNova[]): Uint8Array {
  const ficheiros: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${folhas
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("")}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${folhas
      .map((f, i) => `<sheet name="${escapar(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${folhas
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("")}<Relationship Id="rId${folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(ESTILOS),
  };
  folhas.forEach((f, i) => (ficheiros[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(folhaXml(f))));
  return zipSync(ficheiros, { level: 6 });
}

// ---------------------------------------------------------------- Ler

/** Valor lido de uma célula: texto, número, verdadeiro/falso, ou null se estiver vazia. */
export type Valor = string | number | boolean | null;

export interface FolhaLida {
  nome: string;
  /** Linhas pela ordem da folha; linhas[0] é a linha 1. Cada linha tem as colunas A, B, C… */
  linhas: Valor[][];
}

export interface LivroLido {
  folhas: FolhaLida[];
  /** O livro usa o sistema de datas de 1904 (alguns ficheiros antigos do Mac). */
  datas1904: boolean;
}

function desescapar(t: string): string {
  return t.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) => {
    const l = e.toLowerCase();
    if (l === "lt") return "<";
    if (l === "gt") return ">";
    if (l === "amp") return "&";
    if (l === "quot") return '"';
    if (l === "apos") return "'";
    return String.fromCodePoint(l.startsWith("#x") ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10));
  });
}

/** Junta o texto de todos os <t> de um bloco (texto simples ou com formatação mista). */
const textoDe = (xml: string) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => desescapar(m[1])).join("");

const atributo = (tag: string, nome: string) => tag.match(new RegExp(`\\s${nome}="([^"]*)"`))?.[1];

/** Índice da coluna a partir da referência da célula: "C12" → 2. */
export function indiceColuna(ref: string): number {
  const letras = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

/** Lê um livro de Excel (.xlsx). Lança um erro se o ficheiro não for um .xlsx. */
export function lerLivro(bytes: Uint8Array): LivroLido {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes);
  } catch {
    throw new Error("O ficheiro não é um livro de Excel (.xlsx). No Excel ou no Numbers, use «Guardar como» ou «Exportar» e escolha o formato .xlsx.");
  }
  const ler = (caminho: string) => (zip[caminho] ? strFromU8(zip[caminho]) : null);
  const livro = ler("xl/workbook.xml");
  if (!livro) throw new Error("O ficheiro não é um livro de Excel (.xlsx). No Excel ou no Numbers, use «Guardar como» ou «Exportar» e escolha o formato .xlsx.");

  const datas1904 = /<(?:\w+:)?workbookPr[^>]*\sdate1904="(1|true)"/.test(livro);
  const partilhados = [...(ler("xl/sharedStrings.xml") ?? "").matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) => textoDe(m[1]));

  // Onde está cada folha: workbook.xml dá o nome e o id, workbook.xml.rels dá o ficheiro.
  const rels = ler("xl/_rels/workbook.xml.rels") ?? "";
  const alvo = new Map<string, string>();
  for (const m of rels.matchAll(/<(?:\w+:)?Relationship\s[^>]*>/g)) {
    const id = atributo(m[0], "Id");
    const t = atributo(m[0], "Target");
    if (id && t) alvo.set(id, t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`);
  }

  const folhas: FolhaLida[] = [];
  for (const m of livro.matchAll(/<(?:\w+:)?sheet\s[^>]*>/g)) {
    const nome = desescapar(atributo(m[0], "name") ?? "");
    const id = atributo(m[0], "r:id") ?? m[0].match(/\s\w+:id="([^"]*)"/)?.[1];
    const xml = id && alvo.get(id) ? ler(alvo.get(id)!) : null;
    folhas.push({ nome, linhas: xml ? lerFolha(xml, partilhados) : [] });
  }
  return { folhas, datas1904 };
}

function lerFolha(xml: string, partilhados: string[]): Valor[][] {
  const linhas: Valor[][] = [];
  let proximaLinha = 0;
  for (const mr of xml.matchAll(/<(?:\w+:)?row(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const r = Number(atributo(mr[0], "r") ?? proximaLinha + 1) - 1;
    proximaLinha = r + 1;
    const linha: Valor[] = [];
    let proximaColuna = 0;
    for (const mc of (mr[2] ?? "").matchAll(/<(?:\w+:)?c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const abertura = mc[0].slice(0, mc[0].indexOf(">") + 1);
      const ref = atributo(abertura, "r");
      const c = ref ? indiceColuna(ref) : proximaColuna;
      proximaColuna = c + 1;
      const tipo = atributo(abertura, "t") ?? "n";
      const corpo = mc[2] ?? "";
      const v = corpo.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
      let valor: Valor = null;
      if (tipo === "s") valor = v !== undefined ? (partilhados[Number(v)] ?? null) : null;
      else if (tipo === "inlineStr") valor = textoDe(corpo);
      else if (tipo === "str" || tipo === "e") valor = v !== undefined ? desescapar(v) : null;
      else if (tipo === "b") valor = v === "1";
      else if (tipo === "d") valor = v !== undefined ? desescapar(v) : null;
      else if (v !== undefined && v.trim() !== "") valor = Number(v);
      while (linha.length < c) linha.push(null);
      linha[c] = typeof valor === "string" && valor.trim() === "" ? null : valor;
    }
    while (linhas.length < r) linhas.push([]);
    linhas[r] = linha;
  }
  return linhas;
}

/** Data (AAAA-MM-DD) a partir do número de série do Excel. */
export function dataDeSerie(serie: number, datas1904 = false): string {
  const base = datas1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(base + Math.round(serie) * 86_400_000);
  return d.toISOString().slice(0, 10);
}
