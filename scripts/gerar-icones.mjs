// Gera os ícones PNG da app (sem dependências): fundo azul com três barras a subir e um telhado.
// Uso: node scripts/gerar-icones.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const AZUL = [0x1f, 0x38, 0x64];
const BRANCO = [0xff, 0xff, 0xff];
const DOURADO = [0xf1, 0xc2, 0x5b];

function desenhar(n) {
  const px = Array.from({ length: n * n }, () => AZUL);
  const pintar = (x0, y0, x1, y1, cor) => {
    for (let y = Math.round(y0 * n); y < Math.round(y1 * n); y++)
      for (let x = Math.round(x0 * n); x < Math.round(x1 * n); x++) px[y * n + x] = cor;
  };
  // Três barras (ETF a crescer)
  pintar(0.2, 0.58, 0.32, 0.78, BRANCO);
  pintar(0.4, 0.46, 0.52, 0.78, BRANCO);
  pintar(0.6, 0.34, 0.72, 0.78, BRANCO);
  // Telhado (imobiliário): triângulo sobre as barras
  for (let y = Math.round(0.16 * n); y < Math.round(0.3 * n); y++) {
    const t = (y / n - 0.16) / 0.14; // 0 no topo, 1 na base
    const meia = 0.06 + t * 0.32;
    pintar(0.5 - meia, y / n, 0.5 + meia, (y + 1) / n, DOURADO);
  }
  return px;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const t = Buffer.from(tipo, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([len, t, dados, crc]);
}

function png(n) {
  const px = desenhar(n);
  const linhas = Buffer.alloc(n * (1 + n * 3));
  for (let y = 0; y < n; y++) {
    linhas[y * (1 + n * 3)] = 0;
    for (let x = 0; x < n; x++) px[y * n + x].forEach((v, i) => (linhas[y * (1 + n * 3) + 1 + x * 3 + i] = v));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco("IHDR", ihdr), bloco("IDAT", deflateSync(linhas)), bloco("IEND", Buffer.alloc(0))]);
}

mkdirSync("public", { recursive: true });
writeFileSync("public/icone-192.png", png(192));
writeFileSync("public/icone-512.png", png(512));
writeFileSync("public/apple-touch-icon.png", png(180));
writeFileSync(
  "public/icone.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#1f3864"/><polygon points="44,16 56,16 88,30 12,30" fill="#f1c25b"/><rect x="20" y="58" width="12" height="20" fill="#fff"/><rect x="40" y="46" width="12" height="32" fill="#fff"/><rect x="60" y="34" width="12" height="44" fill="#fff"/></svg>`,
);
console.log("Ícones gerados em public/");
