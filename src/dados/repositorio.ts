// Leitura e escrita de registos cifrados. Todo o resto da app usa só estas funções.

import { bd, type BaseDados } from "./bd";
import { cifrarObjeto, decifrarObjeto } from "../seguranca/cripto";

export async function guardar<T>(chave: CryptoKey, tipo: string, id: string, objeto: T, base: BaseDados = bd): Promise<void> {
  await base.registos.put({ tipo, id, atualizadoEm: new Date().toISOString(), conteudo: await cifrarObjeto(chave, objeto) });
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
  await base.registos.delete([tipo, id]);
}
