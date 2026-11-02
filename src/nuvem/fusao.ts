// Junta os dados de dois aparelhos (o local e o que está no Drive) sem perder nada.
//
// Cada registo (um imóvel, o perfil, uma compra de ETF…) tem a hora da última alteração; vale a
// mais recente. Apagar também é uma alteração, com hora: se apagou num aparelho depois de o outro
// o ter mexido, apaga-se nos dois. Em caso de empate, o registo fica (nunca se perde por empate).

import type { FicheiroCopia } from "../dados/copias";

export interface ResultadoFusao {
  ficheiro: FicheiroCopia;
  /** O Drive tem coisas que este aparelho ainda não tem. */
  mudouLocal: boolean;
  /** Este aparelho tem coisas que o Drive ainda não tem. */
  mudouRemoto: boolean;
}

type Registo = FicheiroCopia["registos"][number];
type Evento = { em: string; registo?: Registo };

/** Os dois ficheiros são do mesmo cofre (têm a mesma chave de dados por baixo). */
export const mesmoCofre = (a: FicheiroCopia, b: FicheiroCopia): boolean => a.cofre.criadoEm === b.cofre.criadoEm;

const instanteCofre = (f: FicheiroCopia) => f.cofre.atualizadoEm ?? f.cofre.criadoEm;

const chaveDe = (tipo: string, id: string) => `${tipo}\u0000${id}`;

/** O acontecimento mais recente de cada registo, num dos lados. */
function eventos(f: FicheiroCopia): Map<string, { tipo: string; id: string; ev: Evento }> {
  const m = new Map<string, { tipo: string; id: string; ev: Evento }>();
  const juntar = (tipo: string, id: string, ev: Evento) => {
    const k = chaveDe(tipo, id);
    const atual = m.get(k);
    if (!atual || mais(ev, atual.ev) > 0) m.set(k, { tipo, id, ev });
  };
  for (const a of f.apagados ?? []) juntar(a.tipo, a.id, { em: a.em });
  for (const r of f.registos) juntar(r.tipo, r.id, { em: r.atualizadoEm, registo: r });
  return m;
}

/** Positivo se `a` é mais recente que `b`; no empate o registo vale mais do que o apagado. */
function mais(a: Evento, b: Evento): number {
  if (a.em !== b.em) return a.em > b.em ? 1 : -1;
  return Number(!!a.registo) - Number(!!b.registo);
}

const igual = (a: Evento | undefined, b: Evento): boolean => !!a && a.em === b.em && !!a.registo === !!b.registo;

export function fundir(local: FicheiroCopia, remoto: FicheiroCopia): ResultadoFusao {
  let mudouLocal = false;
  let mudouRemoto = false;

  // As chaves embrulhadas: fica a versão mais recente (muda quando se define uma nova palavra-passe).
  const cofreRemotoMaisNovo = instanteCofre(remoto) > instanteCofre(local);
  const cofreLocalMaisNovo = instanteCofre(local) > instanteCofre(remoto);
  if (cofreRemotoMaisNovo) mudouLocal = true;
  if (cofreLocalMaisNovo) mudouRemoto = true;

  const l = eventos(local);
  const r = eventos(remoto);
  const registos: Registo[] = [];
  const apagados: { tipo: string; id: string; em: string }[] = [];

  for (const k of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(k);
    const b = r.get(k);
    const vencedor = !a ? b! : !b ? a : mais(b.ev, a.ev) > 0 ? b : a;
    if (vencedor.ev.registo) registos.push(vencedor.ev.registo);
    else apagados.push({ tipo: vencedor.tipo, id: vencedor.id, em: vencedor.ev.em });
    if (!igual(a?.ev, vencedor.ev)) mudouLocal = true;
    if (!igual(b?.ev, vencedor.ev)) mudouRemoto = true;
  }

  return {
    ficheiro: { ...local, criadoEm: new Date().toISOString(), cofre: cofreRemotoMaisNovo ? remoto.cofre : local.cofre, registos, apagados },
    mudouLocal,
    mudouRemoto,
  };
}
