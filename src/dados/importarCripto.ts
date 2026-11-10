// Importar movimentos da carteira de criptomoedas a partir de um livro de Excel, como nos ETF:
// a pessoa descarrega o modelo, preenche uma linha por movimento e envia o ficheiro; a app mostra
// o que leu, o que tem erros e o que já estava registado, e só grava depois de confirmar.

import { criarLivro, lerLivro, type Celula, type Valor } from "./excel";
import { lerData, lerNumero } from "./importarMovimentos";
import type { MovimentoCripto, TipoCripto } from "./movimentosCripto";

export const NOME_MODELO_CRIPTO = "modelo-movimentos-cripto.xlsx";
const FOLHA = "Movimentos";
const LINHAS_MODELO = 1000;

export const COLUNAS_CRIPTO = [
  { chave: "data", titulo: "Data", largura: 13, formato: "data" },
  { chave: "tipo", titulo: "Tipo", largura: 12, formato: "texto" },
  { chave: "moeda", titulo: "Moeda", largura: 12, formato: "texto" },
  { chave: "quantidade", titulo: "Quantidade", largura: 16, formato: "numero" },
  { chave: "preco", titulo: "Preço por unidade (€)", largura: 18, formato: "numero" },
  { chave: "comissao", titulo: "Comissão (€)", largura: 14, formato: "numero" },
] as const;
type Chave = (typeof COLUNAS_CRIPTO)[number]["chave"];

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const SINONIMOS: Record<Chave, string[]> = {
  data: ["data", "date"],
  tipo: ["tipo", "movimento", "operacao"],
  moeda: ["moeda", "cripto", "criptomoeda", "codigo", "ativo", "coin", "simbolo"],
  quantidade: ["quantidade", "unidades", "qtd"],
  preco: ["preco", "precoporunidade", "precounitario"],
  comissao: ["comissao", "comissoes", "custos", "taxa"],
};

/** Livro de Excel com a folha para preencher e as instruções. */
export function criarModeloCripto(): Uint8Array {
  const instrucoes: Celula[][] = [
    ["Como preencher"],
    ["1. Na folha «Movimentos», escreva um movimento por linha, a começar na linha 2. Não mude os títulos da linha 1."],
    ["2. Data: o dia do movimento, por exemplo 15/03/2024."],
    ["3. Tipo: Compra ou Venda."],
    ["4. Moeda: o código da criptomoeda, por exemplo BTC, ETH ou SOL."],
    ["5. Quantidade: as unidades compradas ou vendidas, com todas as casas decimais (por exemplo 0,00125)."],
    ["6. Preço por unidade e comissão: em euros. Pode usar vírgula nas casas decimais."],
    ["7. Grave o ficheiro em formato .xlsx e envie-o na app, em Cripto › Importar do Excel."],
    [""],
    ["A app mostra o que leu antes de gravar. As linhas com erros não entram, e os movimentos que já estavam registados também não (pode enviar o mesmo ficheiro mais do que uma vez)."],
    [""],
    ["Exemplo"],
    COLUNAS_CRIPTO.map((c) => c.titulo),
    [{ data: "2024-03-15" }, "Compra", "BTC", 0.0125, 61500, 1.5],
    [{ data: "2024-05-02" }, "Compra", "ETH", 0.4, 2800, 1],
    [{ data: "2025-06-02" }, "Venda", "BTC", 0.005, 95200, 1],
  ];
  return criarLivro([
    {
      nome: FOLHA,
      cabecalho: true,
      colunas: COLUNAS_CRIPTO.map((c) => ({ largura: c.largura, formato: c.formato })),
      linhas: [COLUNAS_CRIPTO.map((c) => c.titulo)],
      validacoes: [{ intervalo: `B2:B${LINHAS_MODELO}`, lista: "Compra,Venda" }],
    },
    { nome: "Instruções", colunas: COLUNAS_CRIPTO.map((c) => ({ largura: c.largura })), linhas: instrucoes },
  ]);
}

export interface LinhaCripto {
  linha: number;
  movimento: MovimentoCripto | null;
  moeda: string;
  erros: string[];
  repetido: boolean;
}

export interface ResultadoImportacaoCripto {
  linhas: LinhaCripto[];
  erro: string | null;
}

function colunaDe(titulo: string): Chave | null {
  const t = normalizar(titulo);
  if (!t) return null;
  const exato = COLUNAS_CRIPTO.find((c) => normalizar(c.titulo) === t);
  if (exato) return exato.chave;
  let melhor: { chave: Chave; tamanho: number } | null = null;
  for (const [chave, palavras] of Object.entries(SINONIMOS) as [Chave, string[]][]) {
    for (const p of palavras) if (t.startsWith(p) && (!melhor || p.length > melhor.tamanho)) melhor = { chave, tamanho: p.length };
  }
  return melhor?.chave ?? null;
}

function lerTipo(v: Valor): TipoCripto | null {
  if (typeof v !== "string") return null;
  const t = normalizar(v);
  if (t.startsWith("compra") || t === "buy") return "compra";
  if (t.startsWith("venda") || t === "sell") return "venda";
  return null;
}

/** Código da moeda: maiúsculas, sem «-EUR», «/EUR» nem espaços. */
export function lerMoeda(v: Valor): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s]/g, "")
    .replace(/[-/](EUR|USD|USDT|USDC)$/, "");
}

const assinatura = (m: MovimentoCripto) => [m.moeda, m.tipo, m.data, m.quantidade.toFixed(8), m.preco.toFixed(8), m.comissao.toFixed(2)].join("|");

/** Lê o ficheiro preenchido e verifica cada linha, sem gravar nada. */
export function interpretarFicheiroCripto(bytes: Uint8Array, existentes: MovimentoCripto[], novoId: () => string = () => crypto.randomUUID()): ResultadoImportacaoCripto {
  let livro;
  try {
    livro = lerLivro(bytes);
  } catch (e) {
    return { linhas: [], erro: (e as Error).message };
  }
  const folha = livro.folhas.find((f) => normalizar(f.nome) === normalizar(FOLHA)) ?? livro.folhas[0];
  if (!folha) return { linhas: [], erro: "O ficheiro não tem folhas." };

  const indiceCabecalho = folha.linhas.findIndex((l) => l.filter((v) => typeof v === "string" && colunaDe(v)).length >= 3);
  if (indiceCabecalho < 0) return { linhas: [], erro: `Não encontrei os títulos das colunas (Data, Tipo, Moeda…). Use o modelo da app e não mude a linha 1 da folha «${FOLHA}».` };
  const posicao = new Map<Chave, number>();
  folha.linhas[indiceCabecalho].forEach((v, i) => {
    const c = typeof v === "string" ? colunaDe(v) : null;
    if (c && !posicao.has(c)) posicao.set(c, i);
  });
  const emFalta = (["data", "tipo", "moeda", "quantidade", "preco"] as Chave[]).filter((c) => !posicao.has(c));
  if (emFalta.length) return { linhas: [], erro: `Faltam as colunas ${emFalta.map((c) => `«${COLUNAS_CRIPTO.find((x) => x.chave === c)!.titulo}»`).join(", ")}. Use o modelo da app.` };

  const vistos = new Set(existentes.map(assinatura));
  const hoje = new Date().toISOString().slice(0, 10);
  const linhas: LinhaCripto[] = [];
  folha.linhas.slice(indiceCabecalho + 1).forEach((l, i) => {
    const celula = (c: Chave): Valor => (posicao.has(c) ? (l[posicao.get(c)!] ?? null) : null);
    if (COLUNAS_CRIPTO.every((c) => celula(c.chave) === null)) return;

    const numeroLinha = indiceCabecalho + i + 2;
    const erros: string[] = [];
    const data = lerData(celula("data"), livro.datas1904);
    if (!data) erros.push(celula("data") === null ? "Falta a data." : "A data não é válida (use, por exemplo, 15/03/2024).");
    else if (data > hoje) erros.push("A data é no futuro.");
    const tipo = lerTipo(celula("tipo"));
    if (!tipo) erros.push(celula("tipo") === null ? "Falta o tipo (Compra ou Venda)." : "O tipo tem de ser Compra ou Venda.");
    const moeda = lerMoeda(celula("moeda"));
    if (!moeda) erros.push("Falta a moeda (por exemplo BTC).");
    else if (!/^[A-Z0-9]{2,12}$/.test(moeda)) erros.push(`«${moeda}» não parece um código de moeda (por exemplo BTC, ETH).`);

    const num = (c: Chave, nome: string, obrigatorio: boolean) => {
      const n = lerNumero(celula(c));
      if (Number.isNaN(n)) erros.push(`${nome}: não é um número.`);
      else if (n === null && obrigatorio) erros.push(`Falta: ${nome.toLowerCase()}.`);
      else if (n !== null && n < 0) erros.push(`${nome}: não pode ser negativo.`);
      else if (n === 0 && obrigatorio) erros.push(`${nome}: tem de ser maior que zero.`);
      return Number.isNaN(n) || n === null ? 0 : n;
    };
    const quantidade = num("quantidade", "Quantidade", true);
    const preco = num("preco", "Preço por unidade", true);
    const comissao = num("comissao", "Comissão", false);

    if (erros.length || !tipo || !data) {
      linhas.push({ linha: numeroLinha, movimento: null, moeda, erros, repetido: false });
      return;
    }
    const movimento: MovimentoCripto = { id: novoId(), moeda, tipo, data, quantidade, preco, comissao };
    const a = assinatura(movimento);
    const repetido = vistos.has(a);
    vistos.add(a);
    linhas.push({ linha: numeroLinha, movimento, moeda, erros: [], repetido });
  });

  if (linhas.length === 0) return { linhas, erro: `A folha «${folha.nome}» não tem movimentos. Escreva um por linha, a partir da linha 2.` };
  return { linhas, erro: null };
}
