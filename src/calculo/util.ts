/** Arredonda ao cêntimo. */
export const centimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
