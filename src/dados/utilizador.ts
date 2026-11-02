// Nome do utilizador, para a saudação no ecrã inicial. Guardado cifrado, como os outros dados,
// à parte do perfil (o perfil é preenchido no último passo do assistente inicial).

import { guardar, ler } from "./repositorio";

interface Utilizador {
  nome: string;
}

export const lerNome = async (chave: CryptoKey) => (await ler<Utilizador>(chave, "definicoes", "utilizador"))?.nome ?? "";
export const guardarNome = (chave: CryptoKey, nome: string) => guardar<Utilizador>(chave, "definicoes", "utilizador", { nome: nome.trim() });
