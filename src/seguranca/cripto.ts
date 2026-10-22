// Cifragem dos dados da aplicação.
//
// Modelo de chaves:
// - Uma chave de dados (256 bits, aleatória) cifra todos os registos com AES-256-GCM.
// - Essa chave é guardada duas vezes, "embrulhada" (cifrada):
//   1. com uma chave derivada da palavra-passe (Argon2id);
//   2. com uma chave derivada do código de recuperação (Argon2id).
// - A palavra-passe e o código nunca são guardados. A chave de dados só existe
//   na memória enquanto a app está desbloqueada.

import { argon2id } from "hash-wasm";

export type Bytes = Uint8Array<ArrayBuffer>;

export interface Cifrado {
  iv: Bytes;
  dados: Bytes;
}

export interface ParametrosArgon2 {
  memoriaKiB: number;
  iteracoes: number;
  paralelismo: number;
}

// Valores recomendados pela OWASP para Argon2id; aceitáveis em telemóveis atuais.
export const ARGON2_PADRAO: ParametrosArgon2 = { memoriaKiB: 65536, iteracoes: 3, paralelismo: 1 };

export function bytesAleatorios(n: number): Bytes {
  const b = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(b);
  return b;
}

async function importarChaveAes(bruta: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bruta, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function derivarChave(segredo: string, sal: Bytes, p: ParametrosArgon2 = ARGON2_PADRAO): Promise<CryptoKey> {
  const bruta = await argon2id({
    password: segredo.normalize("NFC"),
    salt: sal,
    memorySize: p.memoriaKiB,
    iterations: p.iteracoes,
    parallelism: p.paralelismo,
    hashLength: 32,
    outputType: "binary",
  });
  return importarChaveAes(new Uint8Array(bruta) as Bytes);
}

export async function cifrarBytes(chave: CryptoKey, claro: Bytes): Promise<Cifrado> {
  const iv = bytesAleatorios(12);
  const dados = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, claro));
  return { iv, dados };
}

export async function decifrarBytes(chave: CryptoKey, c: Cifrado): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: c.iv }, chave, c.dados));
}

export async function cifrarObjeto(chave: CryptoKey, objeto: unknown): Promise<Cifrado> {
  const claro = new TextEncoder().encode(JSON.stringify(objeto)) as Bytes;
  return cifrarBytes(chave, claro);
}

export async function decifrarObjeto<T>(chave: CryptoKey, c: Cifrado): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await decifrarBytes(chave, c))) as T;
}

/** Cria uma chave de dados nova e devolve-a já importada e também em bruto (só para a embrulhar). */
export async function novaChaveDados(): Promise<{ chave: CryptoKey; bruta: Bytes }> {
  const bruta = bytesAleatorios(32);
  return { chave: await importarChaveAes(bruta), bruta };
}

export async function embrulharChave(chaveDadosBruta: Bytes, segredo: string, sal: Bytes, p: ParametrosArgon2): Promise<Cifrado> {
  return cifrarBytes(await derivarChave(segredo, sal, p), chaveDadosBruta);
}

/** Devolve a chave de dados em bruto, ou lança erro se o segredo estiver errado. */
export async function desembrulharChaveBruta(embrulhada: Cifrado, segredo: string, sal: Bytes, p: ParametrosArgon2): Promise<Bytes> {
  return decifrarBytes(await derivarChave(segredo, sal, p), embrulhada);
}

export async function importarChaveDados(bruta: Bytes): Promise<CryptoKey> {
  return importarChaveAes(bruta);
}

// ---- Código de recuperação ----
// 30 caracteres do alfabeto de Crockford (sem I, L, O, U para evitar confusões) = 150 bits,
// apresentados em 6 grupos de 5: ABCDE-FGHJK-...

const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function gerarCodigoRecuperacao(): string {
  const b = bytesAleatorios(30);
  const chars = Array.from(b, (x) => ALFABETO[x & 31]);
  const grupos: string[] = [];
  for (let i = 0; i < 30; i += 5) grupos.push(chars.slice(i, i + 5).join(""));
  return grupos.join("-");
}

/** Aceita o código com ou sem hífenes/espaços, em minúsculas, e com O/I/L trocados por 0/1. */
export function normalizarCodigoRecuperacao(texto: string): string {
  const limpo = texto
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  const grupos: string[] = [];
  for (let i = 0; i < limpo.length; i += 5) grupos.push(limpo.slice(i, i + 5));
  return grupos.join("-");
}

export function codigoRecuperacaoValido(texto: string): boolean {
  const n = normalizarCodigoRecuperacao(texto).replace(/-/g, "");
  return n.length === 30 && [...n].every((c) => ALFABETO.includes(c));
}

// ---- Base64 (para o ficheiro de cópia) ----

export function paraBase64(b: Bytes): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export function deBase64(t: string): Bytes {
  const s = atob(t);
  const b = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
