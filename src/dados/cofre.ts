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
  cifrarObjeto,
  decifrarObjeto,
  type Bytes,
} from "../seguranca/cripto";
import { chaveComBiometria, ErroBiometria, registarBiometria, type DadosBiometria } from "../seguranca/biometria";

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
    atualizadoEm: new Date().toISOString(),
  });
  const chave = await importarChaveDados(bruta);
  bruta.fill(0);
  return chave;
}

// ---- Desbloqueio com o rosto ou a impressão digital (só neste aparelho) ----

export async function temBiometria(base: BaseDados = bd): Promise<boolean> {
  return !!(await base.cofre.get("principal"))?.biometria;
}

export async function dataBiometria(base: BaseDados = bd): Promise<string | null> {
  return (await base.cofre.get("principal"))?.biometria?.criadaEm ?? null;
}

/**
 * Ativa o desbloqueio por biometria. Pede a palavra-passe (para obter a chave de dados) e depois
 * o rosto ou o dedo. Devolve false se a palavra-passe estiver errada; lança ErroBiometria se o
 * aparelho não conseguir.
 */
export async function ativarBiometria(palavraPasse: string, registar: (bruta: Bytes) => Promise<DadosBiometria> = registarBiometria, base: BaseDados = bd): Promise<boolean> {
  const cofre = await lerCofre(base);
  let bruta: Bytes;
  try {
    bruta = await desembrulharChaveBruta(cofre.chaveViaPalavraPasse, palavraPasse, cofre.salPalavraPasse, cofre.argon2);
  } catch {
    return false;
  }
  try {
    await base.cofre.update("principal", { biometria: await registar(bruta) });
  } finally {
    bruta.fill(0);
  }
  return true;
}

export async function desativarBiometria(base: BaseDados = bd): Promise<void> {
  await base.cofre.update("principal", { biometria: undefined });
}

/** Abre com o rosto ou o dedo. Lança ErroBiometria se não for possível. */
export async function abrirComBiometria(obter: (d: DadosBiometria) => Promise<Bytes> = chaveComBiometria, base: BaseDados = bd): Promise<CryptoKey> {
  const d = (await lerCofre(base)).biometria;
  if (!d) throw new ErroBiometria("O desbloqueio por biometria não está ativo neste aparelho.");
  const bruta = await obter(d);
  const chave = await importarChaveDados(bruta);
  bruta.fill(0);
  return chave;
}

// ---- Abertura automática neste aparelho ----

const TEXTO_VERIFICACAO = "investimentos-aparelho";

/** Guarda a chave de dados neste aparelho (não exportável) para a app abrir sem palavra-passe. */
export async function lembrarAparelho(chave: CryptoKey, base: BaseDados = bd): Promise<void> {
  await base.locais.put({ id: "aparelho", chave, verificacao: await cifrarObjeto(chave, TEXTO_VERIFICACAO), desde: new Date().toISOString() });
}

export async function esquecerAparelho(base: BaseDados = bd): Promise<void> {
  await base.locais.delete("aparelho");
}

export async function aparelhoLembrado(base: BaseDados = bd): Promise<string | null> {
  const l = await base.locais.get("aparelho");
  return l && "verificacao" in l ? l.desde : null;
}

/** A chave guardada neste aparelho, se a abertura automática estiver ligada e a chave ainda servir. */
export async function chaveDoAparelho(base: BaseDados = bd): Promise<CryptoKey | null> {
  const l = await base.locais.get("aparelho");
  if (!l || !("verificacao" in l)) return null;
  try {
    if ((await decifrarObjeto<string>(l.chave, l.verificacao)) === TEXTO_VERIFICACAO) return l.chave;
  } catch {
    // A chave já não corresponde aos dados (por exemplo depois de um restauro): esquece-a.
  }
  await esquecerAparelho(base);
  return null;
}

// ---- Regresso da página da Google (iPhone com a app instalada) ----

/** Tempo máximo fora da app, na página da Google, para não pedir de novo a palavra-passe. */
export const VALIDADE_REGRESSO_MS = 10 * 60_000;

/** Guarda a chave por pouco tempo antes de sair para a Google, para a app abrir sozinha ao voltar. */
export async function guardarChaveDeRegresso(chave: CryptoKey, base: BaseDados = bd, agora = Date.now()): Promise<void> {
  await base.locais.put({ id: "regresso", chave, ate: new Date(agora + VALIDADE_REGRESSO_MS).toISOString() });
}

/** A chave guardada à saída para a Google, se ainda estiver dentro do prazo. Apaga-a sempre (só serve uma vez). */
export async function chaveDeRegresso(base: BaseDados = bd, agora = Date.now()): Promise<CryptoKey | null> {
  const l = await base.locais.get("regresso");
  await base.locais.delete("regresso");
  if (!l || !("ate" in l) || new Date(l.ate).getTime() < agora) return null;
  return l.chave;
}
