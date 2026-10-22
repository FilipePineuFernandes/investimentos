// Cópias de segurança: formato do ficheiro, destinos e restauro.
//
// O ficheiro de cópia leva o cofre (chaves embrulhadas) e os registos tal como estão,
// já cifrados. Por isso não é preciso cifrar outra vez: sem a palavra-passe ou o
// código de recuperação, o ficheiro é ilegível.

import { bd, type BaseDados, type Cofre, type Registo } from "./bd";
import { ler, guardar } from "./repositorio";
import { deBase64, paraBase64 } from "../seguranca/cripto";

export const FORMATO = "investimentos-copia";
export const EXTENSAO = ".backup";

export type TipoDestino = "pasta" | "aparelho" | "googleDrive" | "dropbox";

export interface DefinicoesCopias {
  destino: TipoDestino;
  nomePasta?: string;
  versoesAGuardar: number;
  /** Última tentativa, com ou sem sucesso. */
  ultimaCopia?: { em: string; bytes: number; ok: boolean; erro?: string; nomeFicheiro?: string };
  /** Data da última cópia que correu bem. */
  ultimaCopiaComSucesso?: string;
}

export const DEFINICOES_PADRAO: DefinicoesCopias = { destino: "aparelho", versoesAGuardar: 10 };

export async function lerDefinicoesCopias(chave: CryptoKey, base: BaseDados = bd): Promise<DefinicoesCopias | undefined> {
  return ler<DefinicoesCopias>(chave, "definicoes", "copias", base);
}

export async function guardarDefinicoesCopias(chave: CryptoKey, d: DefinicoesCopias, base: BaseDados = bd): Promise<void> {
  await guardar(chave, "definicoes", "copias", d, base);
}

// ---------------------------------------------------------------- Ficheiro

interface CifradoJson { iv: string; dados: string }

interface FicheiroCopia {
  formato: typeof FORMATO;
  versao: 1;
  criadoEm: string;
  cofre: Omit<Cofre, "salPalavraPasse" | "chaveViaPalavraPasse" | "salRecuperacao" | "chaveViaRecuperacao"> & {
    salPalavraPasse: string;
    chaveViaPalavraPasse: CifradoJson;
    salRecuperacao: string;
    chaveViaRecuperacao: CifradoJson;
  };
  registos: { tipo: string; id: string; atualizadoEm: string; conteudo: CifradoJson }[];
}

const cjson = (c: { iv: Uint8Array<ArrayBuffer>; dados: Uint8Array<ArrayBuffer> }): CifradoJson => ({ iv: paraBase64(c.iv), dados: paraBase64(c.dados) });
const dejson = (c: CifradoJson) => ({ iv: deBase64(c.iv), dados: deBase64(c.dados) });

export function nomeFicheiroCopia(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `investimentos-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${EXTENSAO}`;
}

export async function gerarFicheiroCopia(base: BaseDados = bd): Promise<string> {
  const cofre = await base.cofre.get("principal");
  if (!cofre) throw new Error("Não existe cofre para copiar.");
  const registos = await base.registos.toArray();
  const f: FicheiroCopia = {
    formato: FORMATO,
    versao: 1,
    criadoEm: new Date().toISOString(),
    cofre: {
      id: cofre.id,
      versao: cofre.versao,
      criadoEm: cofre.criadoEm,
      argon2: cofre.argon2,
      salPalavraPasse: paraBase64(cofre.salPalavraPasse),
      chaveViaPalavraPasse: cjson(cofre.chaveViaPalavraPasse),
      salRecuperacao: paraBase64(cofre.salRecuperacao),
      chaveViaRecuperacao: cjson(cofre.chaveViaRecuperacao),
    },
    registos: registos.map((r) => ({ tipo: r.tipo, id: r.id, atualizadoEm: r.atualizadoEm, conteudo: cjson(r.conteudo) })),
  };
  return JSON.stringify(f);
}

/** Substitui todos os dados deste aparelho pelos do ficheiro. Lança erro se o ficheiro não for válido. */
export async function restaurarCopia(texto: string, base: BaseDados = bd): Promise<{ criadoEm: string; registos: number }> {
  let f: FicheiroCopia;
  try {
    f = JSON.parse(texto);
  } catch {
    throw new Error("O ficheiro não é uma cópia desta aplicação.");
  }
  if (f?.formato !== FORMATO || f.versao !== 1 || !f.cofre || !Array.isArray(f.registos)) {
    throw new Error("O ficheiro não é uma cópia desta aplicação, ou é de uma versão que esta app não conhece.");
  }
  const cofre: Cofre = {
    id: "principal",
    versao: 1,
    criadoEm: f.cofre.criadoEm,
    argon2: f.cofre.argon2,
    salPalavraPasse: deBase64(f.cofre.salPalavraPasse),
    chaveViaPalavraPasse: dejson(f.cofre.chaveViaPalavraPasse),
    salRecuperacao: deBase64(f.cofre.salRecuperacao),
    chaveViaRecuperacao: dejson(f.cofre.chaveViaRecuperacao),
  };
  const registos: Registo[] = f.registos.map((r) => ({ tipo: r.tipo, id: r.id, atualizadoEm: r.atualizadoEm, conteudo: dejson(r.conteudo) }));
  await base.transaction("rw", base.cofre, base.registos, base.locais, async () => {
    await base.cofre.clear();
    await base.registos.clear();
    await base.locais.clear();
    await base.cofre.put(cofre);
    await base.registos.bulkPut(registos);
  });
  return { criadoEm: f.criadoEm, registos: registos.length };
}

// ---------------------------------------------------------------- Pasta no computador

export const suportaPasta = (): boolean => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

export async function escolherPasta(base: BaseDados = bd): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error("Este navegador não permite escolher pastas. Use o Chrome ou o Edge no computador.");
  const pasta = await window.showDirectoryPicker({ id: "copias-investimentos", mode: "readwrite", startIn: "documents" });
  await base.locais.put({ id: "pasta-copias", pasta });
  return pasta;
}

export async function pastaGuardada(base: BaseDados = bd): Promise<FileSystemDirectoryHandle | undefined> {
  return (await base.locais.get("pasta-copias"))?.pasta;
}

/** O navegador pode pedir de novo autorização para escrever na pasta (só com um clique do utilizador). */
export async function autorizacaoPasta(pasta: FileSystemDirectoryHandle, pedir: boolean): Promise<boolean> {
  const modo = { mode: "readwrite" as const };
  if ((await pasta.queryPermission?.(modo)) === "granted") return true;
  if (!pedir) return false;
  return (await pasta.requestPermission?.(modo)) === "granted";
}

async function escreverNaPasta(pasta: FileSystemDirectoryHandle, nome: string, conteudo: string, manter: number): Promise<void> {
  const ficheiro = await pasta.getFileHandle(nome, { create: true });
  const escrita = await ficheiro.createWritable();
  await escrita.write(conteudo);
  await escrita.close();
  // Manter só as N cópias mais recentes (os nomes têm data, por isso a ordem alfabética é a cronológica).
  const nossos: string[] = [];
  for await (const h of pasta.values()) {
    if (h.kind === "file" && h.name.startsWith("investimentos-") && h.name.endsWith(EXTENSAO)) nossos.push(h.name);
  }
  nossos.sort();
  for (const antigo of nossos.slice(0, Math.max(0, nossos.length - manter))) await pasta.removeEntry(antigo);
}

// ---------------------------------------------------------------- Descarregar / partilhar

export async function descarregar(nome: string, conteudo: string): Promise<void> {
  const ficheiro = new File([conteudo], nome, { type: "application/octet-stream" });
  // No telemóvel, o menu Partilhar permite gravar no Drive, Ficheiros, e-mail, etc.
  const ecraTatil = window.matchMedia("(pointer: coarse)").matches;
  if (ecraTatil && navigator.canShare?.({ files: [ficheiro] })) {
    try {
      await navigator.share({ files: [ficheiro], title: "Cópia dos dados de investimentos" });
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") throw new Error("Partilha cancelada.");
    }
  }
  const url = URL.createObjectURL(ficheiro);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------------------------------------------------------- Fazer cópia

export type ResultadoCopia = { ok: true; nomeFicheiro: string } | { ok: false; erro: string; precisaAutorizacao?: boolean };

/**
 * Faz uma cópia para o destino configurado e regista o resultado nas definições.
 * `interativo` indica que vem de um clique (pode abrir janelas de autorização ou de partilha).
 */
export async function fazerCopia(chave: CryptoKey, interativo: boolean, base: BaseDados = bd): Promise<ResultadoCopia> {
  const def = (await lerDefinicoesCopias(chave, base)) ?? DEFINICOES_PADRAO;
  const nomeFicheiro = nomeFicheiroCopia();
  let resultado: ResultadoCopia;
  let bytes = 0;
  try {
    const conteudo = await gerarFicheiroCopia(base);
    bytes = new Blob([conteudo]).size;
    if (def.destino === "pasta") {
      const pasta = await pastaGuardada(base);
      if (!pasta) {
        resultado = { ok: false, erro: "A pasta de cópias não está ligada neste aparelho. Escolha-a de novo." };
      } else if (!(await autorizacaoPasta(pasta, interativo))) {
        resultado = { ok: false, erro: "O navegador precisa de nova autorização para escrever na pasta.", precisaAutorizacao: true };
      } else {
        await escreverNaPasta(pasta, nomeFicheiro, conteudo, def.versoesAGuardar);
        resultado = { ok: true, nomeFicheiro };
      }
    } else if (def.destino === "aparelho") {
      if (!interativo) return { ok: false, erro: "As cópias descarregadas só são feitas com um clique." };
      await descarregar(nomeFicheiro, conteudo);
      resultado = { ok: true, nomeFicheiro };
    } else {
      resultado = { ok: false, erro: "Este destino ainda não está disponível nesta versão da app." };
    }
  } catch (e) {
    resultado = { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
  // A partilha cancelada não conta como cópia falhada.
  if (!resultado.ok && resultado.erro === "Partilha cancelada.") return resultado;
  await guardarDefinicoesCopias(
    chave,
    {
      ...def,
      ultimaCopiaComSucesso: resultado.ok ? new Date().toISOString() : def.ultimaCopiaComSucesso,
      ultimaCopia: resultado.ok
        ? { em: new Date().toISOString(), bytes, ok: true, nomeFicheiro: resultado.nomeFicheiro }
        : { em: new Date().toISOString(), bytes: 0, ok: false, erro: resultado.erro },
    },
    base,
  );
  return resultado;
}

/** Dias desde a última cópia bem-sucedida (Infinity se nunca houve). */
export function diasDesdeUltimaCopia(def: DefinicoesCopias | undefined): number {
  if (!def?.ultimaCopiaComSucesso) return Infinity;
  return (Date.now() - new Date(def.ultimaCopiaComSucesso).getTime()) / 86_400_000;
}
