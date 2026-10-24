// Converter uma morada em coordenadas com o serviço público do OpenStreetMap (Nominatim).
// Regras de utilização do serviço: no máximo um pedido por segundo e nunca enquanto se
// escreve. Por isso só se pede quando o utilizador carrega em "Localizar".
// Só se envia a morada (ou a zona) a localizar: nenhum outro dado do utilizador.

import type { Coordenadas } from "../calculo/geo";

let ultimoPedido = 0;

export interface ResultadoLocalizacao {
  coordenadas: Coordenadas;
  /** Morada como o OpenStreetMap a reconheceu, para o utilizador confirmar. */
  descricao: string;
}

/** Null se a morada não for encontrada. Lança erro se o serviço não responder. */
export async function localizarMorada(texto: string): Promise<ResultadoLocalizacao | null> {
  const espera = ultimoPedido + 1100 - Date.now();
  if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
  ultimoPedido = Date.now();

  const q = new URLSearchParams({ q: texto, format: "jsonv2", limit: "1", countrycodes: "pt", "accept-language": "pt" });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`);
  if (!r.ok) throw new Error(`O serviço de mapas respondeu com o erro ${r.status}.`);
  const [primeiro] = (await r.json()) as { lat: string; lon: string; display_name: string }[];
  if (!primeiro) return null;
  return { coordenadas: { lat: Number(primeiro.lat), lng: Number(primeiro.lon) }, descricao: primeiro.display_name };
}
