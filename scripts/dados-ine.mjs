// Vai buscar ao INE os dados de referência do imobiliário e grava-os em public/dados/ine.json,
// que é publicado com a app (ponto 3 da especificação).
//
// O INE não deixa a app pedir os dados diretamente a partir do navegador (CORS), por isso a
// publicação automática no GitHub corre este programa antes de compilar. São dados públicos:
// nada pessoal passa por aqui.
//
// Indicadores:
//   0012234  Valor mediano das vendas por m² nos últimos 12 meses, por freguesia e município (trimestral)
//   0012598  Valor mediano das rendas por m² de novos contratos nos últimos 12 meses (semestral)
//
// Uso: node scripts/dados-ine.mjs
//      node scripts/dados-ine.mjs vendas.json rendas.json   (respostas do INE já descarregadas)
// Se o INE falhar e já existir um ficheiro, mantém-no e avisa (a publicação continua).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DESTINO = new URL("../public/dados/ine.json", import.meta.url);
const API = "https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&lang=PT&Dim1=T&varcd=";

/** "2.º Trimestre de 2026" → "2026-T2"; "2.º Semestre de 2024" → "2024-S2". */
export function periodo(texto) {
  const m = texto.match(/^(\d)\.º (Trimestre|Semestre) de (\d{4})$/);
  if (!m) throw new Error(`Período inesperado: ${texto}`);
  return `${m[3]}-${m[2][0]}${m[1]}`;
}

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Pede um indicador, tentando de novo com pausas crescentes se o INE estiver ocupado (429) ou falhar. */
async function indicador(codigo, ficheiro) {
  if (ficheiro) return lerResposta(codigo, JSON.parse(readFileSync(ficheiro, "utf8")));
  let r;
  for (let tentativa = 1; ; tentativa++) {
    r = await fetch(API + codigo).catch((e) => ({ ok: false, status: e.message }));
    if (r.ok || tentativa === 5) break;
    console.warn(`INE ${codigo}: ${r.status}, nova tentativa daqui a ${tentativa * 30} s`);
    await espera(tentativa * 30_000);
  }
  if (!r.ok) throw new Error(`INE ${codigo}: HTTP ${r.status}`);
  return lerResposta(codigo, await r.json());
}

function lerResposta(codigo, [d]) {
  if (!d?.Dados) throw new Error(`INE ${codigo}: resposta sem dados`);
  const periodos = Object.keys(d.Dados)
    .map((p) => ({ texto: p, id: periodo(p) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { codigo, titulo: d.IndicadorDsg, atualizadoEm: d.DataUltimoAtualizacao, periodos, dados: d.Dados };
}

const numero = (v) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Só municípios (7 caracteres) e freguesias (9 caracteres). */
const local = (geocod) => geocod.length === 7 || geocod.length === 9;

async function principal() {
  // Um de cada vez, para não sobrecarregar o servidor do INE.
  const [ficheiroVendas, ficheiroRendas] = process.argv.slice(2);
  const vendas = await indicador("0012234", ficheiroVendas);
  const rendas = await indicador("0012598", ficheiroRendas);
  const nomes = {};
  /** vendas[geocod] = { h: histórico do total por período, n: último valor dos novos, e: último dos existentes } */
  const v = {};
  vendas.periodos.forEach(({ texto }, k) => {
    for (const x of vendas.dados[texto]) {
      if (!local(x.geocod)) continue;
      nomes[x.geocod] = x.geodsg;
      const g = (v[x.geocod] ??= { h: Array(vendas.periodos.length).fill(null), n: null, e: null });
      if (x.dim_3 === "H1") g.h[k] = numero(x.valor);
      if (k === vendas.periodos.length - 1 && x.dim_3 === "H11") g.n = numero(x.valor);
      if (k === vendas.periodos.length - 1 && x.dim_3 === "H12") g.e = numero(x.valor);
    }
  });
  const r = {};
  rendas.periodos.forEach(({ texto }, k) => {
    for (const x of rendas.dados[texto]) {
      if (!local(x.geocod)) continue;
      nomes[x.geocod] = x.geodsg;
      (r[x.geocod] ??= Array(rendas.periodos.length).fill(null))[k] = numero(x.valor);
    }
  });

  const municipios = Object.keys(nomes).filter((g) => g.length === 7).length;
  if (municipios < 300) throw new Error(`Só ${municipios} municípios: a resposta do INE parece incompleta.`);

  const fonte = (i) => ({ codigo: i.codigo, titulo: i.titulo, atualizadoEm: i.atualizadoEm, periodos: i.periodos.map((p) => p.id) });
  const saida = {
    geradoEm: new Date().toISOString(),
    fonte: "INE, Instituto Nacional de Estatística (www.ine.pt)",
    vendas: { ...fonte(vendas), valores: v },
    rendas: { ...fonte(rendas), valores: r },
    nomes,
  };
  mkdirSync(new URL(".", DESTINO), { recursive: true });
  writeFileSync(DESTINO, JSON.stringify(saida));
  console.log(`INE: ${Object.keys(v).length} zonas com vendas (até ${vendas.periodos.at(-1).id}), ${Object.keys(r).length} com rendas (até ${rendas.periodos.at(-1).id}).`);
}

principal().catch((e) => {
  if (existsSync(DESTINO)) {
    console.warn(`Aviso: não foi possível atualizar os dados do INE (${e.message}). Mantém-se o ficheiro anterior.`);
  } else {
    console.error(e);
    process.exit(1);
  }
});
