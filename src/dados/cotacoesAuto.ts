// Chave do serviço de cotações (Alpha Vantage), guardada cifrada como os outros dados.
// É a chave gratuita do próprio utilizador: a app não tem servidor nem chave sua.

import { apagar, guardar, ler } from "./repositorio";

interface ChaveCotacoes {
  fonte: "alphavantage";
  chave: string;
}

export const lerChaveCotacoes = async (chave: CryptoKey) => (await ler<ChaveCotacoes>(chave, "definicoes", "cotacoes"))?.chave ?? "";
export const guardarChaveCotacoes = (chave: CryptoKey, chaveApi: string) =>
  guardar<ChaveCotacoes>(chave, "definicoes", "cotacoes", { fonte: "alphavantage", chave: chaveApi.trim() });
export const apagarChaveCotacoes = () => apagar("definicoes", "cotacoes");
