// Leitura e escrita de registos cifrados. Todo o resto da app usa só estas funções.

import { bd, type BaseDados } from "./bd";
import { cifrarObjeto, decifrarObjeto } from "../seguranca/cripto";

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

/** Chama `f` sempre que algo é guardado ou apagado (a sincronização usa-o). Devolve a função que cancela. */
export function aoAlterar(f: Ouvinte): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Definições que só fazem sentido neste aparelho (destino das cópias, pasta, última cópia): não vão na sincronização nem a disparam. */
export const soDesteAparelho = (tipo: string, id: string): boolean => tipo === "definicoes" && id === "copias";

const avisar = (tipo: string, id: string) => {
  if (!soDesteAparelho(tipo, id)) ouvintes.forEach((f) => f());
};

export async function guardar<T>(chave: CryptoKey, tipo: string, id: string, objeto: T, base: BaseDados = bd): Promise<void> {
  const conteudo = await cifrarObjeto(chave, objeto);
  await base.transaction("rw", base.registos, base.apagados, async () => {
    await base.registos.put({ tipo, id, atualizadoEm: new Date().toISOString(), conteudo });
    await base.apagados.delete([tipo, id]);
  });
  avisar(tipo, id);
}

export async function ler<T>(chave: CryptoKey, tipo: string, id: string, base: BaseDados = bd): Promise<T | undefined> {
  const r = await base.registos.get([tipo, id]);
  return r ? decifrarObjeto<T>(chave, r.conteudo) : undefined;
}

export async function listar<T>(chave: CryptoKey, tipo: string, base: BaseDados = bd): Promise<T[]> {
  const rs = await base.registos.where("tipo").equals(tipo).toArray();
  return Promise.all(rs.map((r) => decifrarObjeto<T>(chave, r.conteudo)));
}

export async function apagar(tipo: string, id: string, base: BaseDados = bd): Promise<void> {
  await base.transaction("rw", base.registos, base.apagados, async () => {
    await base.registos.delete([tipo, id]);
    await base.apagados.put({ tipo, id, em: new Date().toISOString() });
  });
  avisar(tipo, id);
}
