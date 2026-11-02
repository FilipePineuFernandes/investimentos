// Perfil do investidor (ponto 4 da especificação). Guardado só no aparelho, cifrado.

import { guardar, ler } from "./repositorio";

export type Regiao = "continente" | "acores" | "madeira";
export type Tolerancia = "baixa" | "media" | "alta";
export type ModeloAlocacao = "global-capitalizacao" | "global-mais-europa" | "personalizada";

/** Dados úteis da nota de liquidação de IRS (só números e datas: nada de nomes, NIF ou morada). */
export interface NotaIrs {
  anoRendimentos: number;
  dataLiquidacao: string | null; // AAAA-MM-DD
  dataLimitePagamento: string | null; // AAAA-MM-DD
  rendimentoGlobal: number | null; // linha 1
  deducoesEspecificas: number | null; // linha 2
  rendimentoColetavel: number | null; // linha 6
  rendimentoParaTaxa: number | null; // linha 9
  quocienteFamiliar: number; // linha 10 (2 = tributação conjunta de casal)
  taxaMarginal: number | null; // % do escalão (linha 10)
  coletaTotal: number | null; // linha 18
  deducoesColeta: number | null; // linha 19
  coletaLiquida: number | null; // linha 22
  impostoApurado: number | null; // linha 25: positivo a pagar, negativo a receber
  taxaEfetiva: number | null; // %
  importadaEm: string; // AAAA-MM-DD
}

export interface Perfil {
  dataNascimento: string; // AAAA-MM-DD
  residenciaFiscal: Regiao;
  rendimentoMensalLiquido: number | null; // € do agregado
  outrasPrestacoes: number | null; // € por mês
  rendimentoColetavelAnual: number | null; // € estimado (agregado)
  /** 1 = tributação individual; 2 = tributação conjunta de um casal (quociente familiar). */
  quocienteFamiliar: number;
  /** Última nota de liquidação de IRS lida. */
  nota: NotaIrs | null;
  englobamentoRendas: boolean;
  englobamentoMaisValias: boolean;
  toleranciaRisco: Tolerancia;
  corretora: {
    nome: string;
    comissaoFixa: number | null; // € por ordem
    comissaoPercentagem: number | null; // % do valor
    cambioPercentagem: number | null; // % sobre operações noutra moeda
    comissaoMinima?: number | null; // € mínimos por ordem
    comissaoMaxima?: number | null; // € máximos por ordem
    custodiaAnualPercentagem?: number | null; // % ao ano sobre o valor em carteira
  };
  moeda: "EUR";
  modeloAlocacao: ModeloAlocacao;
}

export const PERFIL_VAZIO: Perfil = {
  dataNascimento: "",
  residenciaFiscal: "continente",
  rendimentoMensalLiquido: null,
  outrasPrestacoes: null,
  rendimentoColetavelAnual: null,
  quocienteFamiliar: 1,
  nota: null,
  englobamentoRendas: false,
  englobamentoMaisValias: false,
  toleranciaRisco: "media",
  corretora: { nome: "", comissaoFixa: null, comissaoPercentagem: null, cambioPercentagem: null, comissaoMinima: null, comissaoMaxima: null, custodiaAnualPercentagem: null },
  moeda: "EUR",
  modeloAlocacao: "global-capitalizacao",
};

export const lerPerfil = (chave: CryptoKey) => ler<Perfil>(chave, "perfil", "principal");
export const guardarPerfil = (chave: CryptoKey, p: Perfil) => guardar(chave, "perfil", "principal", p);

/** Idade completa numa data (por defeito, hoje). Null se a data de nascimento não estiver preenchida. */
export function idade(dataNascimento: string, em = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) return null;
  const [a, m, d] = dataNascimento.split("-").map(Number);
  let anos = em.getFullYear() - a;
  if (em.getMonth() + 1 < m || (em.getMonth() + 1 === m && em.getDate() < d)) anos--;
  return anos;
}

/** Quociente familiar a usar nas contas de IRS (perfis antigos não o têm: contam como individual). */
export const quocienteDe = (p: Perfil | undefined | null): number => (p && p.quocienteFamiliar >= 1 ? p.quocienteFamiliar : 1);

/** Corretora preenchida: pelo menos o nome. */
export const temCorretora = (c: Perfil["corretora"] | undefined) => !!c && c.nome.trim() !== "";

/**
 * Data de nascimento aceitável: existe no calendário, não é futura e dá uma idade entre 16 e 110 anos.
 * Devolve a mensagem do problema, ou null se estiver bem.
 */
export function problemaDataNascimento(dataNascimento: string, hoje = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) return "Indique a data de nascimento.";
  const [a, m, d] = dataNascimento.split("-").map(Number);
  const data = new Date(a, m - 1, d);
  if (data.getFullYear() !== a || data.getMonth() !== m - 1 || data.getDate() !== d) return "Essa data não existe.";
  if (data > hoje) return "A data de nascimento não pode ser no futuro.";
  const anos = idade(dataNascimento, hoje);
  if (anos === null || anos < 16 || anos > 110) return "Confirme a data: a idade fica fora do normal.";
  return null;
}

const pt = (n: number, casas = 2) => n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: casas });

/** Comissão da corretora em palavras: "2 € + 0,1 % do valor (mínimo 5 €, máximo 10 €)". */
export function descricaoComissao(c: Perfil["corretora"]): string {
  const partes: string[] = [];
  if (c.comissaoFixa) partes.push(`${pt(c.comissaoFixa)} €`);
  if (c.comissaoPercentagem) partes.push(`${pt(c.comissaoPercentagem, 3)} % do valor`);
  if (partes.length === 0) return "Sem comissão indicada";
  const limites: string[] = [];
  if (c.comissaoMinima) limites.push(`mínimo ${pt(c.comissaoMinima)} €`);
  if (c.comissaoMaxima) limites.push(`máximo ${pt(c.comissaoMaxima)} €`);
  return partes.join(" + ") + (limites.length ? ` (${limites.join(", ")})` : "");
}
