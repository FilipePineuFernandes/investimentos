// Lê uma fotografia ou um PDF da nota de liquidação e devolve o texto lido (uma ou mais leituras).
// Tudo acontece no aparelho. Os leitores só são descarregados quando se usam.

import type { Progresso } from "./imagem";

export type { Progresso };

export const eFicheiroPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

export async function lerFicheiroDaNota(ficheiro: File, progresso: Progresso): Promise<string[]> {
  if (eFicheiroPdf(ficheiro)) {
    progresso("A ler o PDF…", 0.3);
    const [{ extrairTextoPdf }, trabalhador] = await Promise.all([import("./pdf"), import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")]);
    const texto = await extrairTextoPdf(new Uint8Array(await ficheiro.arrayBuffer()), trabalhador.default);
    progresso("Leitura concluída.", 1);
    return [texto];
  }
  const { lerFotografia } = await import("./imagem");
  return lerFotografia(ficheiro, progresso);
}
