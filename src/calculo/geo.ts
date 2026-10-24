// Distâncias no mapa (Anexo A: fórmula de Haversine) e etiquetas de preço dos marcadores.

export interface Coordenadas {
  lat: number;
  lng: number;
}

const RAIO_TERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância em km entre dois pontos, pela fórmula de Haversine. */
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

/** Etiqueta curta para o mapa: "395 mil €", "1,2 M€", "1200 €/mês". */
export function etiquetaPreco(valor: number, mensal: boolean): string {
  if (mensal) return `${Math.round(valor).toLocaleString("pt-PT")} €/mês`;
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} M€`;
  if (valor >= 1000) return `${Math.round(valor / 1000).toLocaleString("pt-PT")} mil €`;
  return `${Math.round(valor)} €`;
}
