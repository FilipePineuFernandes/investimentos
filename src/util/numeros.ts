// Números no formato português: "1 234,56" ou "1.234,56". Também aceita "1234.56".

export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(/\s|€|%/g, "");
  if (t === "") return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : (t.match(/\./g)?.length ?? 0) > 1 ? t.replace(/\./g, "") : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export function textoNumero(n: number | null | undefined, casas = 2): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("pt-PT", { maximumFractionDigits: casas, useGrouping: false });
}

export const euros = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

export function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB`;
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
