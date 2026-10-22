/** Arredonda ao cêntimo. */
export const centimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const DIA = 86_400_000;

/**
 * TIR anual (em fração) de fluxos em datas reais: a taxa que anula
 * Σ valor ÷ (1 + r)^(dias desde o primeiro fluxo ÷ 365). Procura por bisseção.
 * NaN se não houver uma taxa entre −99% e +1000% que resolva.
 */
export function tirDatas(fluxos: { data: Date; valor: number }[]): number {
  if (fluxos.length < 2) return NaN;
  const inicio = Math.min(...fluxos.map((f) => f.data.getTime()));
  const va = (r: number) => fluxos.reduce((s, f) => s + f.valor / Math.pow(1 + r, (f.data.getTime() - inicio) / DIA / 365), 0);
  let baixo = -0.99;
  let alto = 10;
  if (va(baixo) * va(alto) > 0) return NaN;
  for (let k = 0; k < 200; k++) {
    const meio = (baixo + alto) / 2;
    if (va(baixo) * va(meio) <= 0) alto = meio;
    else baixo = meio;
  }
  return (baixo + alto) / 2;
}

/** Data a partir de "AAAA-MM-DD", ou null se o texto não for uma data. */
export function lerData(texto: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
