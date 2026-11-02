// Texto de uma fotografia da nota de liquidação. O leitor (Tesseract) corre no aparelho e os seus ficheiros
// vêm da própria app (pasta ocr), por isso a fotografia nunca sai do aparelho e nada se pede à internet.

export type Progresso = (mensagem: string, fracao: number) => void;

/** Larguras (em pixéis) a que a fotografia é lida. Cada uma erra em sítios diferentes; as contas da nota escolhem. */
export const LARGURAS = [1400, 1600, 1800];

/**
 * Passa a cinzento e estica o contraste entre o 1.º e o 99.º percentil (como "normalizar" num editor de
 * imagem): o papel fica branco e a tinta preta, mesmo com sombras e luz fraca. Altera o próprio array.
 */
export function realcarContraste(rgba: Uint8ClampedArray): void {
  const n = rgba.length / 4;
  const cinza = new Uint8Array(n);
  const histograma = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
    cinza[i] = g;
    histograma[g]++;
  }
  const corte = n * 0.01;
  let soma = 0;
  let baixo = 0;
  while (baixo < 255 && soma + histograma[baixo] <= corte) soma += histograma[baixo++];
  soma = 0;
  let alto = 255;
  while (alto > 0 && soma + histograma[alto] <= corte) soma += histograma[alto--];
  const amplitude = Math.max(alto - baixo, 1);
  for (let i = 0; i < n; i++) {
    const v = Math.min(255, Math.max(0, Math.round(((cinza[i] - baixo) * 255) / amplitude)));
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
}

async function abrirImagem(ficheiro: File): Promise<ImageBitmap> {
  // "from-image" respeita a rotação que o telemóvel grava na fotografia.
  return createImageBitmap(ficheiro, { imageOrientation: "from-image" });
}

function tratada(imagem: ImageBitmap, largura: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = Math.round((imagem.height * largura) / imagem.width);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Este aparelho não consegue tratar a imagem.");
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  const pixeis = ctx.getImageData(0, 0, canvas.width, canvas.height);
  realcarContraste(pixeis.data);
  ctx.putImageData(pixeis, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível tratar a imagem."))), "image/png"));
}

/** Uma leitura por largura (ver LARGURAS). */
export async function lerFotografia(ficheiro: File, progresso: Progresso): Promise<string[]> {
  progresso("A abrir a fotografia…", 0.02);
  const imagem = await abrirImagem(ficheiro);
  const { createWorker, PSM } = await import("tesseract.js");
  const pasta = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;

  const trabalhador = await createWorker("por", 1, {
    workerPath: `${pasta}worker.min.js`,
    corePath: pasta,
    langPath: pasta,
    gzip: true,
    // A política de segurança da app não aceita trabalhadores criados a partir de texto.
    workerBlobURL: false,
    logger: (m) => {
      if (m.status.startsWith("loading") || m.status.startsWith("initializ")) progresso("A preparar o leitor (só demora na primeira vez)…", 0.05 + 0.15 * (m.progress ?? 0));
    },
  });
  try {
    await trabalhador.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1" });
    const textos: string[] = [];
    for (let i = 0; i < LARGURAS.length; i++) {
      progresso(`A ler a nota (passagem ${i + 1} de ${LARGURAS.length})…`, 0.2 + (0.78 * i) / LARGURAS.length);
      const { data } = await trabalhador.recognize(await tratada(imagem, LARGURAS[i]));
      textos.push(data.text);
    }
    progresso("Leitura concluída.", 1);
    return textos;
  } finally {
    await trabalhador.terminate();
    imagem.close();
  }
}
