// Nota de liquidação de IRS: lê o texto da fotografia ou do PDF, confere as contas da própria nota e
// decide quando é preciso uma nota nova. Só se guardam números e datas, nunca nomes, NIF ou morada.

import type { NotaIrs, Perfil, Regiao } from "../dados/perfil";

/** Linhas numéricas da nota de que a app precisa (o número é o da linha na "Nota demonstrativa"). */
export type CampoNota =
  | "rendimentoGlobal" // 1
  | "deducoesEspecificas" // 2
  | "rendimentoColetavel" // 6
  | "rendimentoParaTaxa" // 9
  | "importanciaApurada" // 11
  | "parcelaAbater" // 12
  | "coletaTotal" // 18
  | "deducoesColeta" // 19
  | "beneficioMunicipal" // 20
  | "coletaLiquida" // 22
  | "pagamentosPorConta" // 23
  | "retencoes" // 24
  | "impostoApurado"; // 25 (positivo a pagar, negativo a receber)

export const CAMPOS_NOTA: { campo: CampoNota; linha: number; rotulo: string }[] = [
  { campo: "rendimentoGlobal", linha: 1, rotulo: "Rendimento global" },
  { campo: "deducoesEspecificas", linha: 2, rotulo: "Deduções específicas" },
  { campo: "rendimentoColetavel", linha: 6, rotulo: "Rendimento coletável" },
  { campo: "rendimentoParaTaxa", linha: 9, rotulo: "Total do rendimento para determinação da taxa" },
  { campo: "importanciaApurada", linha: 11, rotulo: "Importância apurada" },
  { campo: "parcelaAbater", linha: 12, rotulo: "Parcela a abater" },
  { campo: "coletaTotal", linha: 18, rotulo: "Coleta total" },
  { campo: "deducoesColeta", linha: 19, rotulo: "Deduções à coleta" },
  { campo: "beneficioMunicipal", linha: 20, rotulo: "Benefício municipal" },
  { campo: "coletaLiquida", linha: 22, rotulo: "Coleta líquida" },
  { campo: "pagamentosPorConta", linha: 23, rotulo: "Pagamentos por conta" },
  { campo: "retencoes", linha: 24, rotulo: "Retenções na fonte" },
  { campo: "impostoApurado", linha: 25, rotulo: "Imposto apurado" },
];

type Etiquetas = Record<CampoNota, RegExp>;

// Aplicadas a texto sem acentos e em minúsculas.
const ETIQUETAS: Etiquetas = {
  rendimentoGlobal: /rendimento\s+global/,
  deducoesEspecificas: /deducoes\s+especificas/,
  rendimentoColetavel: /rendimento\s+coletavel/,
  rendimentoParaTaxa: /total\s+do\s+rendimento/,
  importanciaApurada: /importancia\s+apurada/,
  parcelaAbater: /parcela\s+a\s+abater/,
  coletaTotal: /coleta\s+total/,
  deducoesColeta: /deducoes\s+a\s+coleta/,
  beneficioMunicipal: /beneficio\s+municipal/,
  coletaLiquida: /coleta\s+liquida/,
  pagamentosPorConta: /pagamentos\s+por\s+conta/,
  retencoes: /retencoes\s+na\s+fonte/,
  impostoApurado: /imposto\s+apurado/,
};

export type Origem = "lido" | "calculado";

export interface LeituraNota {
  valores: Partial<Record<CampoNota, number>>;
  origem: Partial<Record<CampoNota, Origem>>;
  anoRendimentos: number | null;
  dataLiquidacao: string | null;
  dataLimitePagamento: string | null;
  quocienteFamiliar: number | null;
  taxaMarginal: number | null;
  taxaEfetiva: number | null;
  /** A nota termina em reembolso (valor a receber). */
  aReceber: boolean;
  /** Região sugerida pelos códigos postais da nota (só se todos coincidirem). */
  regiao: Regiao | null;
  /** Campos que entram numa conta da nota que não bate certo. */
  duvidas: CampoNota[];
  /** Contas da nota que não batem certo, em português. */
  avisos: string[];
}

const semAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Valor em euros: 40.000,00 ou 35,896,00 (a vírgula a mais é erro da leitura) ou 931,40.
// Não conta percentagens (1,50%).
const DINHEIRO = /-?\d{1,3}(?:[., ]\d{3})*[.,]\d{2}(?!\d)(?!\s*%)/g;

function paraNumero(texto: string): number {
  const negativo = texto.startsWith("-");
  const limpo = texto.replace(/^-/, "").replace(/\s/g, "");
  const ultimo = Math.max(limpo.lastIndexOf(","), limpo.lastIndexOf("."));
  const inteira = limpo.slice(0, ultimo).replace(/[.,]/g, "");
  const n = Number(`${inteira}.${limpo.slice(ultimo + 1)}`);
  return negativo ? -n : n;
}

/** Valor do fim de uma linha, depois da etiqueta. Aceita "93140 €" (vírgula perdida) como último recurso. */
function valorDaLinha(resto: string): { valor: number; recuperado: boolean } | null {
  const semFormulas = resto.replace(/\[[^\]]*\]?/g, " ").replace(/[x×]\s*\d+[.,]\d{2}/g, " ");
  const todos = [...semFormulas.matchAll(DINHEIRO)];
  if (todos.length > 0) return { valor: paraNumero(todos[todos.length - 1][0]), recuperado: false };
  const sem = semFormulas.match(/(\d{3,8})\s*€/);
  if (sem) return { valor: Number(sem[1]) / 100, recuperado: true };
  return null;
}

interface Candidatos {
  valores: Record<CampoNota, number[]>;
  recuperados: Record<CampoNota, number[]>;
  quociente: number[];
  taxaMarginal: number[];
  taxaEfetiva: number[];
  anos: number[];
  liquidacoes: string[];
  prazos: string[];
  regioes: Regiao[];
  aReceber: boolean;
}

const vazios = <T>(f: () => T) => Object.fromEntries(CAMPOS_NOTA.map((c) => [c.campo, f()])) as Record<CampoNota, T>;

/** Região de um código postal: 9000-9499 Madeira, 9500-9999 Açores, o resto Continente. */
export function regiaoPorCodigoPostal(codigo: string): Regiao | null {
  const m = codigo.match(/^(\d{4})-\d{3}$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1000) return null;
  if (n >= 9500) return "acores";
  if (n >= 9000) return "madeira";
  return "continente";
}

const numeroPt = (s: string) => Number(s.replace(",", "."));

function extrairCandidatos(texto: string, acc: Candidatos): void {
  const linhas = texto.split(/\r?\n/);
  const norm = semAcentos(texto);

  for (const linha of linhas) {
    const l = semAcentos(linha);
    for (const { campo } of CAMPOS_NOTA) {
      const m = ETIQUETAS[campo].exec(l);
      if (!m) continue;
      const r = valorDaLinha(l.slice(m.index + m[0].length));
      if (r) (r.recuperado ? acc.recuperados : acc.valores)[campo].push(r.valor);
    }

    // "VALOR A PAGAR" (ou "A RECEBER") repete o imposto apurado e serve de segunda leitura.
    const pagar = l.match(/valor\s+a\s+(pagar|receber)/);
    if (pagar) {
      const r = valorDaLinha(l.slice((pagar.index ?? 0) + pagar[0].length));
      if (r) (r.recuperado ? acc.recuperados : acc.valores).impostoApurado.push(pagar[1] === "receber" ? -Math.abs(r.valor) : r.valor);
    }

    const q = l.match(/quociente\s+familiar\s*(\d[.,]\d{1,2})/);
    if (q) acc.quociente.push(numeroPt(q[1]));
    const t = l.match(/taxa\s*(\d{1,2}[.,]\d{3})\s*%/);
    if (t) acc.taxaMarginal.push(numeroPt(t[1]));
    const te = l.match(/taxa\s+efetiva[^\d]{0,40}(\d{1,2}[.,]\d{2})\s*%/);
    if (te) acc.taxaEfetiva.push(numeroPt(te[1]));

    // Período dos rendimentos, e na mesma linha o acerto e a data da liquidação (a última).
    const p = l.match(/(\d{4})-(\d{2})-(\d{2})\s*a\s*(\d{4})-(\d{2})-(\d{2})/);
    if (p) {
      acc.anos.push(Number(p[4]));
      const datas = [...l.slice((p.index ?? 0) + p[0].length).matchAll(/\d{4}-\d{2}-\d{2}/g)].map((d) => d[0]);
      if (datas.length > 0) acc.liquidacoes.push(datas[datas.length - 1]);
    }
  }

  // O prazo vem por baixo da etiqueta, por vezes noutra linha.
  for (const m of norm.matchAll(/limite\s+de\s+pagamento[\s\S]{0,120}?(\d{4}-\d{2}-\d{2})/g)) acc.prazos.push(m[1]);

  for (const m of texto.matchAll(/\b(\d{4}-\d{3})\b/g)) {
    const r = regiaoPorCodigoPostal(m[1]);
    if (r) acc.regioes.push(r);
  }

  if (/valor\s+a\s+receber|a\s+reembolsar|reembolso/.test(norm)) acc.aReceber = true;
}

const moda = <T>(lista: T[]): T | null => {
  if (lista.length === 0) return null;
  const contagem = new Map<T, number>();
  for (const x of lista) contagem.set(x, (contagem.get(x) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

const PERTO = 0.06;
const igual = (a: number, b: number, tol = PERTO) => Math.abs(a - b) <= tol;

export type Valores = Partial<Record<CampoNota, number>>;

interface Conta {
  descricao: string;
  campos: CampoNota[];
  /** Verifica a conta; undefined se faltam valores. */
  verifica: (v: Valores, q: number | null, taxa: number | null) => boolean | undefined;
  /** Se só falta um campo, calcula-o. */
  resolve?: (v: Valores) => Partial<Valores>;
}

const tem = (v: Valores, ...c: CampoNota[]) => c.every((k) => v[k] !== undefined);

// As linhas que quase sempre são 0,00 (3, 4, 5, 7, 8, 13 a 17 e 21) contam como zero.
const CONTAS: Conta[] = [
  {
    descricao: "Rendimento global − deduções específicas = rendimento coletável (linhas 1, 2 e 6)",
    campos: ["rendimentoGlobal", "deducoesEspecificas", "rendimentoColetavel"],
    verifica: (v) => (tem(v, "rendimentoGlobal", "deducoesEspecificas", "rendimentoColetavel") ? igual(v.rendimentoGlobal! - v.deducoesEspecificas!, v.rendimentoColetavel!) : undefined),
    resolve: (v) => {
      if (tem(v, "rendimentoGlobal", "deducoesEspecificas") && v.rendimentoColetavel === undefined) return { rendimentoColetavel: round2(v.rendimentoGlobal! - v.deducoesEspecificas!) };
      if (tem(v, "rendimentoGlobal", "rendimentoColetavel") && v.deducoesEspecificas === undefined) return { deducoesEspecificas: round2(v.rendimentoGlobal! - v.rendimentoColetavel!) };
      if (tem(v, "deducoesEspecificas", "rendimentoColetavel") && v.rendimentoGlobal === undefined) return { rendimentoGlobal: round2(v.deducoesEspecificas! + v.rendimentoColetavel!) };
      return {};
    },
  },
  {
    descricao: "O rendimento da taxa é o rendimento coletável (linhas 6 e 9)",
    campos: ["rendimentoColetavel", "rendimentoParaTaxa"],
    verifica: (v) => (tem(v, "rendimentoColetavel", "rendimentoParaTaxa") ? igual(v.rendimentoColetavel!, v.rendimentoParaTaxa!) : undefined),
    resolve: (v) => {
      if (v.rendimentoColetavel !== undefined && v.rendimentoParaTaxa === undefined) return { rendimentoParaTaxa: v.rendimentoColetavel };
      if (v.rendimentoParaTaxa !== undefined && v.rendimentoColetavel === undefined) return { rendimentoColetavel: v.rendimentoParaTaxa };
      return {};
    },
  },
  {
    descricao: "Rendimento ÷ quociente × taxa = importância apurada (linhas 9, 10 e 11)",
    campos: ["rendimentoParaTaxa", "importanciaApurada"],
    verifica: (v, q, taxa) => (tem(v, "rendimentoParaTaxa", "importanciaApurada") && q && taxa ? igual((v.rendimentoParaTaxa! / q) * (taxa / 100), v.importanciaApurada!, 0.1) : undefined),
  },
  {
    descricao: "(Importância apurada − parcela a abater) × quociente = coleta total (linhas 11, 12 e 18)",
    campos: ["importanciaApurada", "parcelaAbater", "coletaTotal"],
    verifica: (v, q) => (tem(v, "importanciaApurada", "parcelaAbater", "coletaTotal") && q ? igual((v.importanciaApurada! - v.parcelaAbater!) * q, v.coletaTotal!, 0.1) : undefined),
  },
  {
    descricao: "Coleta total − deduções − benefício municipal = coleta líquida (linhas 18, 19, 20 e 22)",
    campos: ["coletaTotal", "deducoesColeta", "beneficioMunicipal", "coletaLiquida"],
    verifica: (v) => (tem(v, "coletaTotal", "deducoesColeta", "beneficioMunicipal", "coletaLiquida") ? igual(v.coletaTotal! - v.deducoesColeta! - v.beneficioMunicipal!, v.coletaLiquida!) : undefined),
    resolve: (v) => {
      const { coletaTotal: t, deducoesColeta: d, beneficioMunicipal: b, coletaLiquida: l } = v;
      if (t !== undefined && d !== undefined && b !== undefined && l === undefined) return { coletaLiquida: round2(t - d - b) };
      if (t !== undefined && d !== undefined && l !== undefined && b === undefined) return { beneficioMunicipal: round2(t - d - l) };
      if (t !== undefined && b !== undefined && l !== undefined && d === undefined) return { deducoesColeta: round2(t - b - l) };
      if (d !== undefined && b !== undefined && l !== undefined && t === undefined) return { coletaTotal: round2(d + b + l) };
      return {};
    },
  },
  {
    descricao: "Coleta líquida − pagamentos por conta − retenções = imposto apurado (linhas 22, 23, 24 e 25)",
    campos: ["coletaLiquida", "pagamentosPorConta", "retencoes", "impostoApurado"],
    verifica: (v) => (tem(v, "coletaLiquida", "pagamentosPorConta", "retencoes", "impostoApurado") ? igual(v.coletaLiquida! - v.pagamentosPorConta! - v.retencoes!, v.impostoApurado!) : undefined),
    resolve: (v) => {
      const { coletaLiquida: l, pagamentosPorConta: p, retencoes: r, impostoApurado: i } = v;
      if (l !== undefined && p !== undefined && r !== undefined && i === undefined) return { impostoApurado: round2(l - p - r) };
      if (l !== undefined && p !== undefined && i !== undefined && r === undefined) return { retencoes: round2(l - p - i) };
      if (l !== undefined && r !== undefined && i !== undefined && p === undefined) return { pagamentosPorConta: round2(l - r - i) };
      if (p !== undefined && r !== undefined && i !== undefined && l === undefined) return { coletaLiquida: round2(p + r + i) };
      return {};
    },
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

const certas = (v: Valores, q: number | null, taxa: number | null) => CONTAS.filter((c) => c.verifica(v, q, taxa) === true).length;
const erradas = (v: Valores, q: number | null, taxa: number | null) => CONTAS.filter((c) => c.verifica(v, q, taxa) === false).length;

/**
 * Valores que as contas da nota dão para um campo a partir de todos os outros, mas só os que duas contas
 * diferentes confirmam: com uma só conta não se sabe qual das linhas está errada.
 */
function derivados(campo: CampoNota, valores: Valores): number[] {
  const sem: Valores = { ...valores };
  delete sem[campo];
  const dadas: number[] = [];
  for (const conta of CONTAS) {
    const v = conta.resolve?.(sem)[campo];
    if (v !== undefined) dadas.push(v);
  }
  const distintos = dadas.filter((v, i) => dadas.findIndex((x) => igual(x, v)) === i);
  return distintos.filter((v) => dadas.filter((x) => igual(x, v)).length >= 2);
}

/** Junta as leituras de várias passagens (ou de um PDF) numa só, usando as contas da nota para escolher e completar. */
export function lerNota(textos: string[]): LeituraNota {
  const acc: Candidatos = {
    valores: vazios<number[]>(() => []),
    recuperados: vazios<number[]>(() => []),
    quociente: [],
    taxaMarginal: [],
    taxaEfetiva: [],
    anos: [],
    liquidacoes: [],
    prazos: [],
    regioes: [],
    aReceber: false,
  };
  textos.forEach((t) => extrairCandidatos(t, acc));

  const quociente = moda(acc.quociente);
  let taxaMarginal = moda(acc.taxaMarginal);

  // Candidatos por campo, do mais repetido para o menos; os de "vírgula perdida" só entram no fim.
  const opcoes = {} as Record<CampoNota, number[]>;
  for (const { campo } of CAMPOS_NOTA) {
    const contagem = new Map<number, number>();
    for (const x of acc.valores[campo]) contagem.set(x, (contagem.get(x) ?? 0) + 1);
    const ordenados = [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
    for (const x of acc.recuperados[campo]) if (!ordenados.includes(x)) ordenados.push(x);
    opcoes[campo] = ordenados;
  }

  const origem: Partial<Record<CampoNota, Origem>> = {};
  const valores: Valores = {};
  for (const { campo } of CAMPOS_NOTA) {
    if (opcoes[campo].length > 0) {
      valores[campo] = opcoes[campo][0];
      origem[campo] = "lido";
    }
  }

  // Trocas: a cada volta faz-se a troca que mais melhora as contas da nota (outra leitura do mesmo campo ou um
  // valor confirmado por duas contas). A igualdade desempata a favor do que foi lido, não do calculado.
  for (let volta = 0; volta < 12; volta++) {
    const base = { e: erradas(valores, quociente, taxaMarginal), c: certas(valores, quociente, taxaMarginal) };
    let melhor: { campo: CampoNota; valor: number; e: number; c: number; calculado: boolean } | null = null;
    for (const { campo } of CAMPOS_NOTA) {
      const atual = valores[campo];
      if (atual === undefined) continue;
      const lidas = opcoes[campo];
      for (const alt of [...lidas, ...derivados(campo, valores).filter((d) => !lidas.includes(d))]) {
        if (alt === atual) continue;
        const tentativa = { ...valores, [campo]: alt };
        const e = erradas(tentativa, quociente, taxaMarginal);
        const c = certas(tentativa, quociente, taxaMarginal);
        if (!(e < base.e || (e === base.e && c > base.c))) continue;
        const calculado = !lidas.includes(alt);
        if (!melhor || e < melhor.e || (e === melhor.e && (c > melhor.c || (c === melhor.c && melhor.calculado && !calculado)))) melhor = { campo, valor: alt, e, c, calculado };
      }
    }
    if (!melhor) break;
    valores[melhor.campo] = melhor.valor;
  }

  // O que ficou com um valor que ninguém leu foi calculado pelas contas da nota.
  for (const { campo } of CAMPOS_NOTA) {
    if (valores[campo] !== undefined && !opcoes[campo].includes(valores[campo]!)) origem[campo] = "calculado";
  }

  // Completa o que falta quando as contas da nota o permitem.
  for (let volta = 0; volta < 5; volta++) {
    let mudou = false;
    for (const conta of CONTAS) {
      for (const [k, v] of Object.entries(conta.resolve?.(valores) ?? {}) as [CampoNota, number][]) {
        if (valores[k] === undefined) {
          valores[k] = v;
          origem[k] = "calculado";
          mudou = true;
        }
      }
    }
    if (!mudou) break;
  }

  // A taxa do escalão também se calcula: importância apurada × quociente ÷ rendimento.
  if (taxaMarginal === null && valores.importanciaApurada !== undefined && valores.rendimentoParaTaxa && quociente) {
    taxaMarginal = Math.round(((valores.importanciaApurada * quociente) / valores.rendimentoParaTaxa) * 100000) / 1000;
  }

  // Sinal do imposto: numa nota que acaba em reembolso o imposto é negativo (só se inverte se a conta da nota o pedir).
  const contaFinal = CONTAS[CONTAS.length - 1];
  if (acc.aReceber && valores.impostoApurado !== undefined && valores.impostoApurado > 0 && contaFinal.verifica(valores, quociente, taxaMarginal) !== true) {
    valores.impostoApurado = -valores.impostoApurado;
  }

  const { duvidas, avisos } = conferirNota(valores, quociente, taxaMarginal);

  const regioes = new Set(acc.regioes);
  const dataLiquidacao = moda(acc.liquidacoes);
  const anoRendimentos = moda(acc.anos) ?? (dataLiquidacao ? Number(dataLiquidacao.slice(0, 4)) - 1 : null);

  return {
    valores,
    origem,
    anoRendimentos,
    dataLiquidacao,
    dataLimitePagamento: moda(acc.prazos),
    quocienteFamiliar: quociente,
    taxaMarginal,
    taxaEfetiva: moda(acc.taxaEfetiva),
    aReceber: acc.aReceber,
    regiao: regioes.size === 1 ? [...regioes][0] : null,
    duvidas,
    avisos,
  };
}

/** Confere as contas da nota com os valores atuais: que campos estão em dúvida e porquê. */
export function conferirNota(valores: Valores, quociente: number | null, taxaMarginal: number | null): { duvidas: CampoNota[]; avisos: string[] } {
  const duvidas = new Set<CampoNota>();
  const avisos: string[] = [];
  for (const conta of CONTAS) {
    if (conta.verifica(valores, quociente, taxaMarginal) === false) {
      conta.campos.forEach((c) => duvidas.add(c));
      avisos.push(conta.descricao);
    }
  }
  return { duvidas: [...duvidas], avisos };
}

// --- Regra de validade -----------------------------------------------------------------------

/**
 * Ano de rendimentos da nota que a app deve ter hoje. A nota de um ano sai no verão seguinte e paga-se até
 * 31 de agosto: só depois dessa data é que a nota do ano anterior passa a ser a que conta. Até lá usa-se
 * a última válida (a do ano anterior a esse).
 */
export function anoDaNotaNecessaria(hoje: string): number {
  const ano = Number(hoje.slice(0, 4));
  return hoje > `${ano}-08-31` ? ano - 1 : ano - 2;
}

export function notaDesatualizada(nota: NotaIrs | null | undefined, hoje: string): boolean {
  return !!nota && nota.anoRendimentos < anoDaNotaNecessaria(hoje);
}

/** Data a partir da qual a app volta a pedir uma nota nova (1 de setembro, dois anos depois dos rendimentos). */
export const pedirNovaNotaEm = (anoRendimentos: number) => `${anoRendimentos + 2}-09-01`;

// --- Aplicar ao perfil -----------------------------------------------------------------------

export interface NotaConfirmada {
  valores: Valores;
  anoRendimentos: number;
  dataLiquidacao: string | null;
  dataLimitePagamento: string | null;
  quocienteFamiliar: number;
  taxaMarginal: number | null;
  taxaEfetiva: number | null;
  regiao: Regiao | null;
}

export function criarNota(c: NotaConfirmada, hoje: string): NotaIrs {
  const v = c.valores;
  return {
    anoRendimentos: c.anoRendimentos,
    dataLiquidacao: c.dataLiquidacao,
    dataLimitePagamento: c.dataLimitePagamento,
    rendimentoGlobal: v.rendimentoGlobal ?? null,
    deducoesEspecificas: v.deducoesEspecificas ?? null,
    rendimentoColetavel: v.rendimentoColetavel ?? null,
    rendimentoParaTaxa: v.rendimentoParaTaxa ?? null,
    quocienteFamiliar: c.quocienteFamiliar,
    taxaMarginal: c.taxaMarginal,
    coletaTotal: v.coletaTotal ?? null,
    deducoesColeta: v.deducoesColeta ?? null,
    coletaLiquida: v.coletaLiquida ?? null,
    impostoApurado: v.impostoApurado ?? null,
    taxaEfetiva: c.taxaEfetiva,
    importadaEm: hoje,
  };
}

/** Aplica a nota ao perfil: rendimento da taxa e quociente alimentam as contas de IRS; a região só se confirmada. */
export function aplicarNotaAoPerfil(p: Perfil, nota: NotaIrs, regiao: Regiao | null): Perfil {
  return {
    ...p,
    nota,
    quocienteFamiliar: nota.quocienteFamiliar,
    rendimentoColetavelAnual: nota.rendimentoParaTaxa ?? nota.rendimentoColetavel ?? p.rendimentoColetavelAnual,
    residenciaFiscal: regiao ?? p.residenciaFiscal,
  };
}
