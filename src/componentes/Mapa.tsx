// Mapa do imóvel e dos comparáveis (ponto 5.3), com OpenStreetMap e a biblioteca Leaflet.
// O imóvel tem um marcador próprio; cada anúncio tem uma etiqueta com o preço ou a renda.
// Os anúncios fora do mercado normal (leilões, temporários, quartos) têm etiqueta tracejada.
// A Leaflet só é carregada quando o mapa aparece, para não atrasar o arranque da app.

import { useEffect, useRef, useState } from "react";
import type { Map as MapaLeaflet, LayerGroup } from "leaflet";
import type { Coordenadas } from "../calculo/geo";

export interface Marcador {
  id: string;
  coordenadas: Coordenadas;
  etiqueta: string;
  /** Linhas de texto da janela que abre ao tocar no marcador. */
  detalhe: string[];
  link?: string;
  aParte: boolean;
  foraDoRaio: boolean;
}

const PORTUGAL: Coordenadas = { lat: 39.6, lng: -8.0 };

export function Mapa({
  imovel,
  marcadores,
  raioKm,
  onClique,
  descricao,
}: {
  imovel: Coordenadas | null;
  marcadores: Marcador[];
  raioKm: number | null;
  /** Com esta função, tocar no mapa devolve a posição (para marcar o imóvel ou um anúncio). */
  onClique?: (c: Coordenadas) => void;
  descricao: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const clique = useRef(onClique);
  clique.current = onClique;
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let cancelado = false;
    Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
      .then(([L]) => {
        if (cancelado || !caixa.current) return;
        leaflet.current = L;
        const m = L.map(caixa.current, { scrollWheelZoom: false }).setView([PORTUGAL.lat, PORTUGAL.lng], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        }).addTo(m);
        m.on("click", (e) => clique.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
        camada.current = L.layerGroup().addTo(m);
        mapa.current = m;
        setPronto(true);
      })
      .catch(() => setErro(true));
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    const m = mapa.current;
    const g = camada.current;
    if (!pronto || !L || !m || !g) return;
    g.clearLayers();
    const pontos: [number, number][] = [];
    // Com o imóvel e o raio, o mapa enquadra o círculo; os anúncios mais longe veem-se ao arrastar.
    const enquadrarRaio = !!imovel && !!raioKm;

    if (imovel) {
      if (raioKm) {
        const c = L.circle([imovel.lat, imovel.lng], { radius: raioKm * 1000, color: "#2f5496", weight: 1, fillOpacity: 0.06 }).addTo(g);
        const b = c.getBounds();
        pontos.push([b.getNorth(), b.getEast()], [b.getSouth(), b.getWest()]);
      }
      if (!enquadrarRaio) pontos.push([imovel.lat, imovel.lng]);
      L.marker([imovel.lat, imovel.lng], {
        icon: L.divIcon({ className: "marcador-imovel", html: "<span>O seu imóvel</span>", iconSize: [0, 0] }),
        zIndexOffset: 1000,
        keyboard: false,
      }).addTo(g);
    }

    for (const x of marcadores) {
      const icone = L.divIcon({ className: `etiqueta-preco${x.aParte ? " a-parte" : ""}${x.foraDoRaio ? " fora" : ""}`, html: "", iconSize: [0, 0] });
      const mk = L.marker([x.coordenadas.lat, x.coordenadas.lng], { icon: icone, title: x.etiqueta, riseOnHover: true }).addTo(g);
      // Texto dos anúncios entra com textContent: são dados escritos pelo utilizador.
      mk.getElement()?.replaceChildren(Object.assign(document.createElement("span"), { textContent: x.etiqueta }));
      const janela = document.createElement("div");
      for (const linha of x.detalhe) janela.appendChild(Object.assign(document.createElement("div"), { textContent: linha }));
      if (x.link && /^https?:\/\//.test(x.link)) {
        const a = Object.assign(document.createElement("a"), { href: x.link, target: "_blank", rel: "noopener noreferrer", textContent: "Abrir o anúncio" });
        janela.appendChild(a);
      }
      mk.bindPopup(janela);
      if (!enquadrarRaio) pontos.push([x.coordenadas.lat, x.coordenadas.lng]);
    }

    if (pontos.length === 1) m.setView(pontos[0], 15);
    else if (pontos.length > 1) m.fitBounds(pontos, { padding: enquadrarRaio ? [0, 0] : [30, 30], maxZoom: 16 });
  }, [pronto, imovel, marcadores, raioKm]);

  if (erro) return <p className="suave">Não foi possível abrir o mapa. Verifique a ligação à internet.</p>;
  return <div ref={caixa} className={`mapa${onClique ? " a-marcar" : ""}`} role="region" aria-label={descricao} />;
}
