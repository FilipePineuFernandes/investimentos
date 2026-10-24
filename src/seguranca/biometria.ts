// Desbloqueio com o rosto ou a impressão digital, através das chaves de acesso do navegador
// (passkeys / WebAuthn) com a extensão PRF.
//
// Como funciona:
// - Ao ativar, o aparelho cria uma chave de acesso protegida pela biometria. A extensão PRF
//   devolve um segredo de 32 bytes que só se obtém depois de o aparelho reconhecer o rosto ou o
//   dedo, e que é sempre o mesmo para o mesmo "sal".
// - Desse segredo deriva-se (HKDF) uma chave AES que embrulha a chave de dados, tal como a
//   palavra-passe e o código de recuperação já fazem. Fica guardada no cofre deste aparelho.
// - Para abrir, o aparelho pede o rosto ou o dedo, devolve o mesmo segredo e a chave de dados
//   é desembrulhada. A palavra-passe nunca é guardada; continua a servir noutros aparelhos.
// - A biometria em si (rosto, impressão digital) nunca sai do aparelho: a app só recebe o segredo.

import { bytesAleatorios, cifrarBytes, decifrarBytes, type Bytes, type Cifrado } from "./cripto";

export interface DadosBiometria {
  /** Identificador da chave de acesso criada neste aparelho. */
  credencialId: Bytes;
  /** Sal enviado à extensão PRF (fixo para esta chave de acesso). */
  salPrf: Bytes;
  /** Chave de dados embrulhada com a chave derivada do segredo PRF. */
  chaveEmbrulhada: Cifrado;
  criadaEm: string;
}

const INFO_HKDF = new TextEncoder().encode("investimentos-biometria-v1") as Bytes;

/** Chave AES-256 derivada do segredo devolvido pela extensão PRF. */
export async function chaveDoSegredo(segredo: Bytes): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", segredo, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(new ArrayBuffer(32)), info: INFO_HKDF },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function embrulharComSegredo(chaveDadosBruta: Bytes, segredo: Bytes): Promise<Cifrado> {
  return cifrarBytes(await chaveDoSegredo(segredo), chaveDadosBruta);
}

export async function desembrulharComSegredo(embrulhada: Cifrado, segredo: Bytes): Promise<Bytes> {
  return decifrarBytes(await chaveDoSegredo(segredo), embrulhada);
}

// ---------------------------------------------------------------- Navegador (WebAuthn)

type ResultadosPrf = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
const comPrf = (sal: Bytes) => ({ prf: { eval: { first: sal } } }) as AuthenticationExtensionsClientInputs;

/** O aparelho tem rosto, impressão digital ou Windows Hello disponíveis para o navegador. */
export async function biometriaDisponivel(): Promise<boolean> {
  try {
    return typeof window !== "undefined" && !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Erro com uma mensagem para mostrar ao utilizador. */
export class ErroBiometria extends Error {}

function traduzirErro(e: unknown): ErroBiometria {
  if (e instanceof ErroBiometria) return e;
  const nome = (e as DOMException)?.name;
  if (nome === "NotAllowedError") return new ErroBiometria("O reconhecimento foi cancelado ou não foi aceite. Tente de novo ou use a palavra-passe.");
  if (nome === "InvalidStateError") return new ErroBiometria("Já existe uma chave de acesso desta app neste aparelho. Desative e volte a ativar.");
  if (nome === "SecurityError") return new ErroBiometria("O navegador só permite chaves de acesso em páginas seguras (https).");
  return new ErroBiometria(`O aparelho não conseguiu usar a biometria: ${e instanceof Error ? e.message : String(e)}`);
}

async function lerSegredo(credencialId: Bytes, salPrf: Bytes): Promise<Bytes> {
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge: bytesAleatorios(32),
        allowCredentials: [{ type: "public-key", id: credencialId }],
        userVerification: "required",
        timeout: 60_000,
        extensions: comPrf(salPrf),
      },
    })) as PublicKeyCredential | null;
  } catch (e) {
    throw traduzirErro(e);
  }
  const primeiro = (cred?.getClientExtensionResults() as ResultadosPrf | undefined)?.prf?.results?.first;
  if (!primeiro) throw new ErroBiometria("Este aparelho ou navegador não suporta o desbloqueio por biometria desta app (extensão PRF).");
  return new Uint8Array(primeiro.slice(0)) as Bytes;
}

/**
 * Cria a chave de acesso neste aparelho (pede o rosto ou o dedo) e embrulha a chave de dados.
 * Alguns aparelhos só devolvem o segredo num segundo pedido, que também pede a biometria.
 */
export async function registarBiometria(chaveDadosBruta: Bytes): Promise<DadosBiometria> {
  const salPrf = bytesAleatorios(32);
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "Investimentos" },
        user: { id: bytesAleatorios(16), name: "Investimentos", displayName: "Investimentos (este aparelho)" },
        challenge: bytesAleatorios(32),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60_000,
        extensions: comPrf(salPrf),
      },
    })) as PublicKeyCredential | null;
  } catch (e) {
    throw traduzirErro(e);
  }
  if (!cred) throw new ErroBiometria("O aparelho não criou a chave de acesso.");
  const credencialId = new Uint8Array(cred.rawId.slice(0)) as Bytes;
  const prf = (cred.getClientExtensionResults() as ResultadosPrf).prf;
  if (prf?.enabled === false) throw new ErroBiometria("Este aparelho ou navegador não suporta o desbloqueio por biometria desta app (extensão PRF).");
  const segredo = prf?.results?.first ? (new Uint8Array(prf.results.first.slice(0)) as Bytes) : await lerSegredo(credencialId, salPrf);
  return { credencialId, salPrf, chaveEmbrulhada: await embrulharComSegredo(chaveDadosBruta, segredo), criadaEm: new Date().toISOString() };
}

/** Pede o rosto ou o dedo e devolve a chave de dados em bruto. */
export async function chaveComBiometria(d: DadosBiometria): Promise<Bytes> {
  const segredo = await lerSegredo(d.credencialId, d.salPrf);
  try {
    return await desembrulharComSegredo(d.chaveEmbrulhada, segredo);
  } catch {
    throw new ErroBiometria("A chave de acesso não corresponde a esta app. Desative e volte a ativar o desbloqueio por biometria.");
  }
}
