// Vai buscar à Deutsche Börse a lista de todos os instrumentos negociados na Xetra e grava os ETF
// ativos em euros em public/dados/xetra-etf.json, publicado com a app. É a base do «Novo ETF»:
// a pesquisa de ETF para acrescentar ao catálogo.
//
// A lista oficial traz o ISIN, o código (mnemónica), um nome abreviado e o tipo de ETF. Não traz o
// TER, o índice nem o setor: esses confirmam-se na ficha do ETF. São dados públicos.
//
// Uso: node scripts/dados-xetra.mjs
//      node scripts/dados-xetra.mjs ficheiro.csv   (lista já descarregada)
// Se a Deutsche Börse falhar e já existir um ficheiro, mantém-no e avisa (a publicação continua).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DESTINO = new URL("../public/dados/xetra-etf.json", import.meta.url);
/** Página com a ligação para a lista (o endereço do ficheiro muda de vez em quando). */
const PAGINA = "https://www.xetra.com/xetra-en/instruments/instruments";
/** Último endereço conhecido do ficheiro, se a página não o mostrar. */
const FICHEIRO = "https://www.cashmarket.deutsche-boerse.com/resource/blob/1528/e00e35f4880c0d25146c8b40711578ee/data/t7-xetr-allTradableInstruments.csv";
const CABECALHOS = { "User-Agent": "Mozilla/5.0 (publicacao da app Investimentos)" };

const GRUPOS = {
  "EXCHANGE TRADED FUNDS - PASSIV": "indice",
  "EXCHANGE TRADED FUNDS - AKTIV": "ativo",
  "EXCHANGE TRADED FUNDS - RENTEN": "obrigacoes",
  "ETF RENTEN - FOREIGN CURRENCY": "obrigacoes",
};

/** Lê o CSV da Xetra (separado por «;», cabeçalho na 3.ª linha) e devolve os ETF ativos em euros. */
export function lerLista(texto) {
  const linhas = texto.split(/\r?\n/);
  const data = linhas[1]?.split(";")[1]?.trim() ?? ""; // «Date Last Update:;10.11.2026»
  const cab = linhas[2].split(";");
  const col = (n) => {
    const i = cab.indexOf(n);
    if (i < 0) throw new Error(`Coluna em falta na lista da Xetra: ${n}`);
    return i;
  };
  const c = {
    tipo: col("Instrument Type"),
    estado: col("Instrument Status"),
    nome: col("Instrument"),
    isin: col("ISIN"),
    codigo: col("Mnemonic"),
    moeda: col("Currency"),
    grupo: col("Product Assignment Group Description"),
    desde: col("First Trading Date"),
  };
  const etf = [];
  for (const l of linhas.slice(3)) {
    if (!l.trim()) continue;
    const v = l.split(";");
    if (v[c.tipo] !== "ETF" || v[c.estado] !== "Active" || v[c.moeda] !== "EUR" || !v[c.codigo]) continue;
    etf.push([v[c.isin], v[c.codigo], v[c.nome].trim(), GRUPOS[v[c.grupo]] ?? "indice", v[c.desde] || ""]);
  }
  etf.sort((a, b) => a[1].localeCompare(b[1]));
  const [d, m, a] = data.split(".");
  return { atualizado: a ? `${a}-${m}-${d}` : "", fonte: "Deutsche Börse: All tradable instruments (Xetra)", etf };
}

async function descarregar() {
  let endereco = FICHEIRO;
  try {
    const pagina = await (await fetch(PAGINA, { headers: CABECALHOS })).text();
    const achado = pagina.match(/https?:\/\/[^"'\s<>]*t7-xetr-allTradableInstruments\.csv/);
    if (achado) endereco = achado[0];
  } catch {
    // Usa o último endereço conhecido.
  }
  const r = await fetch(endereco, { headers: CABECALHOS });
  if (!r.ok) throw new Error(`Xetra: HTTP ${r.status}`);
  return new TextDecoder("latin1").decode(await r.arrayBuffer());
}

async function principal() {
  const ficheiro = process.argv[2];
  try {
    const texto = ficheiro ? new TextDecoder("latin1").decode(readFileSync(ficheiro)) : await descarregar();
    const dados = lerLista(texto);
    if (dados.etf.length < 500) throw new Error(`Só ${dados.etf.length} ETF na lista: parece incompleta.`);
    mkdirSync(new URL("./", DESTINO), { recursive: true });
    writeFileSync(DESTINO, JSON.stringify(dados));
    console.log(`Xetra: ${dados.etf.length} ETF ativos em euros (lista de ${dados.atualizado}).`);
  } catch (e) {
    if (existsSync(DESTINO)) console.warn(`Aviso: não foi possível atualizar a lista da Xetra (${e.message}). Fica a lista guardada.`);
    else throw e;
  }
}

if (import.meta.url === new URL(process.argv[1], "file://").href || process.argv[1]?.endsWith("dados-xetra.mjs")) await principal();
