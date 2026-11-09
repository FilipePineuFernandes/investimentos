import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Política de segurança de conteúdo (CSP), só na versão publicada.
// Em desenvolvimento o Vite precisa de scripts inline, por isso não se aplica.
// 'wasm-unsafe-eval' é necessário para o Argon2id (WebAssembly).
const CSP = [
  "default-src 'self'",
  // Google Drive: o script de entrada da Google, a janela de entrada e a API do Drive (só quando a pessoa liga o Drive).
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "frame-src https://accounts.google.com",
  // Mapa: imagens do OpenStreetMap.
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  // BCE (Euribor) e Banco de Portugal aceitam pedidos diretos da app. Os dados do INE vêm com a app.
  // Alpha Vantage: cotações automáticas dos ETF (só com a chave do próprio utilizador).
  "connect-src 'self' https://data-api.ecb.europa.eu https://bpstat.bportugal.pt https://nominatim.openstreetmap.org https://www.googleapis.com https://accounts.google.com https://www.alphavantage.co",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function cspNaPublicacao(): Plugin {
  return {
    name: "csp-na-publicacao",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// O Node existe ao compilar, mas o projeto não inclui os tipos do Node (a app corre no navegador).
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // No GitHub Pages a app fica em https://<utilizador>.github.io/<repositório>/, por isso a
  // publicação automática define BASE=/<repositório>/. Localmente fica na raiz.
  base: process.env.BASE ?? "/",
  plugins: [
    react(),
    cspNaPublicacao(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icone.png", "apple-touch-icon.png", "logotipo.png", "simbolo.png"],
      manifest: {
        name: "Investimentos: Imobiliário e ETF",
        short_name: "Investimentos",
        description: "Simulação e acompanhamento de investimentos em imobiliário e ETF. Os dados ficam no seu aparelho.",
        lang: "pt-PT",
        theme_color: "#1c1c1c",
        background_color: "#1c1c1c",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,wasm,json}"],
        // O leitor de texto da nota de IRS (vários MB) não vai na instalação: fica guardado quando se usa pela primeira vez.
        globIgnores: ["ocr/**", "assets/pdf-*.js"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/ocr/") || /\/assets\/pdf[.-]/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "leitura-da-nota", expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
});
