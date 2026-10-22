// Perfil do investidor (ponto 4 da especificação). Guardado só no aparelho, cifrado.

import { guardar, ler } from "./repositorio";

export type Regiao = "continente" | "acores" | "madeira";
export type Tolerancia = "baixa" | "media" | "alta";
export type ModeloAlocacao = "global-capitalizacao" | "global-mais-europa" | "personalizada";

export interface Perfil {
  dataNascimento: string; // AAAA-MM-DD
  residenciaFiscal: Regiao;
  rendimentoMensalLiquido: number | null; // € do agregado
  outrasPrestacoes: number | null; // € por mês
  rendimentoColetavelAnual: number | null; // € estimado
  englobamentoRendas: boolean;
  englobamentoMaisValias: boolean;
  toleranciaRisco: Tolerancia;
  corretora: {
    nome: string;
    comissaoFixa: number | null; // € por ordem
    comissaoPercentagem: number | null; // % do valor
    cambioPercentagem: number | null; // % sobre operações noutra moeda
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
  englobamentoRendas: false,
  englobamentoMaisValias: false,
  toleranciaRisco: "media",
  corretora: { nome: "", comissaoFixa: null, comissaoPercentagem: null, cambioPercentagem: null },
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
