// Copia para public/ocr os ficheiros do leitor de texto das fotografias (nota de liquidação de IRS), para
// a app os servir a partir do seu próprio endereço: a fotografia nunca sai do aparelho e nada vem da internet.
// Corre sozinho antes de "npm run dev" e "npm run build".

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "public", "ocr");
mkdirSync(destino, { recursive: true });

const ficheiros = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz", "por.traineddata.gz"],
];

for (const [de, para] of ficheiros) {
  const origem = join(raiz, de);
  if (!existsSync(origem)) {
    console.error(`Falta ${de}. Corra "npm install" primeiro.`);
    process.exit(1);
  }
  copyFileSync(origem, join(destino, para));
}
console.log(`Leitor de texto copiado para public/ocr (${ficheiros.length} ficheiros).`);
