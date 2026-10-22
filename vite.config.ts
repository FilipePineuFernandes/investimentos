import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Política de segurança de conteúdo (CSP), só na versão publicada.
// Em desenvolvimento o Vite precisa de scripts inline, por isso não se aplica.
// 'wasm-unsafe-eval' é necessário para o Argon2id (WebAssembly).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
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

export default defineConfig({
  plugins: [
    react(),
    cspNaPublicacao(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icone.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Investimentos: Imobiliário e ETF",
        short_name: "Investimentos",
        description: "Simulação e acompanhamento de investimentos em imobiliário e ETF. Os dados ficam no seu aparelho.",
        lang: "pt-PT",
        theme_color: "#1f3864",
        background_color: "#f5f7fb",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,wasm}"],
      },
    }),
  ],
});
