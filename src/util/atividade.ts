// Trabalho em curso que deve contar como utilização da app, para o bloqueio automático por
// inatividade não a fechar a meio (por exemplo, a atualização das cotações, que demora minutos).

export const EVENTO_ATIVIDADE = "investimentos:atividade";

/** Diz à app que há trabalho em curso: adia o bloqueio automático. */
export function assinalarAtividade(): void {
  window.dispatchEvent(new Event(EVENTO_ATIVIDADE));
}
