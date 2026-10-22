// Criação e abertura do cofre (palavra-passe e código de recuperação).

import { bd, type BaseDados, type Cofre } from "./bd";
import {
  ARGON2_PADRAO,
  bytesAleatorios,
  desembrulharChaveBruta,
  embrulharChave,
  gerarCodigoRecuperacao,
  importarChaveDados,
  normalizarCodigoRecuperacao,
  novaChaveDados,
} from "../seguranca/cripto";

export const MIN_PALAVRA_PASSE = 10;

export async function existeCofre(base: BaseDados = bd): Promise<boolean> {
  return (await base.cofre.get("principal")) !== undefined;
}

/** Cria o cofre. Devolve a chave de dados (para a sessão) e o código de recuperação a mostrar uma única vez. */
export async function criarCofre(palavraPasse: string, base: BaseDados = bd): Promise<{ chave: CryptoKey; codigoRecuperacao: string }> {
  if (palavraPasse.length < MIN_PALAVRA_PASSE) throw new Error(`A palavra-passe tem de ter pelo menos ${MIN_PALAVRA_PASSE} caracteres.`);
  const { chave, bruta } = await novaChaveDados();
  const codigoRecuperacao = gerarCodigoRecuperacao();
  const salPalavraPasse = bytesAleatorios(16);
  const salRecuperacao = bytesAleatorios(16);
  const cofre: Cofre = {
    id: "principal",
    versao: 1,
    criadoEm: new Date().toISOString(),
    argon2: ARGON2_PADRAO,
    salPalavraPasse,
    chaveViaPalavraPasse: await embrulharChave(bruta, palavraPasse, salPalavraPasse, ARGON2_PADRAO),
    salRecuperacao,
    chaveViaRecuperacao: await embrulharChave(bruta, codigoRecuperacao, salRecuperacao, ARGON2_PADRAO),
  };
  bruta.fill(0);
  await base.cofre.put(cofre);
  return { chave, codigoRecuperacao };
}

async function lerCofre(base: BaseDados): Promise<Cofre> {
  const cofre = await base.cofre.get("principal");
  if (!cofre) throw new Error("Não existe nenhum cofre neste aparelho.");
  return cofre;
}

/** Abre com a palavra-passe. Devolve null se estiver errada. */
export async function abrirComPalavraPasse(palavraPasse: string, base: BaseDados = bd): Promise<CryptoKey | null> {
  const cofre = await lerCofre(base);
  try {
    const bruta = await desembrulharChaveBruta(cofre.chaveViaPalavraPasse, palavraPasse, cofre.salPalavraPasse, cofre.argon2);
    const chave = await importarChaveDados(bruta);
    bruta.fill(0);
    return chave;
  } catch {
    return null;
  }
}

/**
 * Abre com o código de recuperação e define logo uma palavra-passe nova.
 * Devolve null se o código estiver errado.
 */
export async function recuperarComCodigo(codigo: string, novaPalavraPasse: string, base: BaseDados = bd): Promise<CryptoKey | null> {
  if (novaPalavraPasse.length < MIN_PALAVRA_PASSE) throw new Error(`A palavra-passe tem de ter pelo menos ${MIN_PALAVRA_PASSE} caracteres.`);
  const cofre = await lerCofre(base);
  let bruta;
  try {
    bruta = await desembrulharChaveBruta(cofre.chaveViaRecuperacao, normalizarCodigoRecuperacao(codigo), cofre.salRecuperacao, cofre.argon2);
  } catch {
    return null;
  }
  const salPalavraPasse = bytesAleatorios(16);
  await base.cofre.update("principal", {
    salPalavraPasse,
    chaveViaPalavraPasse: await embrulharChave(bruta, novaPalavraPasse, salPalavraPasse, cofre.argon2),
  });
  const chave = await importarChaveDados(bruta);
  bruta.fill(0);
  return chave;
}
