// Gráfico circular (anel): partes de um todo, por exemplo o valor da carteira por setor.
// Até 7 fatias com cor própria e o resto junto em «Outros». A legenda por baixo mostra sempre o
// nome, o valor e a percentagem de cada fatia (a cor nunca é a única pista). Tocar numa fatia ou
// numa linha da legenda destaca-a.

import { useState } from "react";

export interface Fatia {
  id: string;
  nome: string;
  valor: number;
}

/** Cores das séries (validadas para daltonismo, em modo claro e escuro): ver --serie-1 … --serie-8 em estilos.css. */
export const corSerie = (k: number) => `var(--serie-${(k % 8) + 1})`;
const COR_OUTROS = "var(--serie-outros)";
const MAX_FATIAS = 7;

/** As maiores fatias, por ordem; o resto junta-se em «Outros». Só entram valores positivos. */
export function prepararFatias(fatias: Fatia[]): (Fatia & { cor: string })[] {
  const positivas = fatias.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const principais = positivas.length > MAX_FATIAS + 1 ? positivas.slice(0, MAX_FATIAS) : positivas;
  const resto = positivas.slice(principais.length);
  const lista = principais.map((f, k) => ({ ...f, cor: corSerie(k) }));
  if (resto.length) lista.push({ id: "outros", nome: `Outros (${resto.length})`, valor: resto.reduce((s, f) => s + f.valor, 0), cor: COR_OUTROS });
  return lista;
}

function arco(cx: number, cy: number, r: number, ri: number, a0: number, a1: number): string {
  const p = (r0: number, a: number) => [cx + r0 * Math.sin(a), cy - r0 * Math.cos(a)];
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r, a0);
  const [x1, y1] = p(r, a1);
  const [x2, y2] = p(ri, a1);
  const [x3, y3] = p(ri, a0);
  return `M${x0} ${y0}A${r} ${r} 0 ${grande} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${grande} 0 ${x3} ${y3}Z`;
}

export function GraficoCircular({ fatias, formato, descricao, rotuloTotal = "Total" }: { fatias: Fatia[]; formato: (n: number) => string; descricao: string; rotuloTotal?: string }) {
  const [ativa, setAtiva] = useState<string | null>(null);
  const lista = prepararFatias(fatias);
  const total = lista.reduce((s, f) => s + f.valor, 0);
  if (total <= 0) return <p className="suave">Não há valores positivos para desenhar.</p>;
  const pct = (v: number) => `${((v / total) * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;

  let inicio = 0;
  const destacada = lista.find((f) => f.id === ativa);
  return (
    <div className="grafico-viz grafico-circular">
      <svg viewBox="0 0 200 200" role="img" aria-label={`${descricao}. ${lista.map((f) => `${f.nome}: ${formato(f.valor)} (${pct(f.valor)})`).join("; ")}`}>
        {lista.length === 1 ? (
          <circle cx="100" cy="100" r="72" fill="none" stroke={lista[0].cor} strokeWidth="36" />
        ) : (
          lista.map((f) => {
            const fim = inicio + (f.valor / total) * Math.PI * 2;
            const d = arco(100, 100, ativa === f.id ? 94 : 90, 54, inicio, fim);
            inicio = fim;
            return (
              <path
                key={f.id}
                d={d}
                fill={f.cor}
                stroke="var(--superficie)"
                strokeWidth="2"
                opacity={ativa && ativa !== f.id ? 0.45 : 1}
                onPointerEnter={() => setAtiva(f.id)}
                onClick={() => setAtiva(ativa === f.id ? null : f.id)}
                style={{ cursor: "pointer" }}
              >
                <title>{`${f.nome}: ${formato(f.valor)} (${pct(f.valor)})`}</title>
              </path>
            );
          })
        )}
        <text x="100" y="94" textAnchor="middle" className="grafico-centro-rotulo">
          {destacada ? pct(destacada.valor) : rotuloTotal}
        </text>
        <text x="100" y="114" textAnchor="middle" className="grafico-centro-valor">
          {formato(destacada ? destacada.valor : total)}
        </text>
      </svg>
      <ul className="grafico-legenda" onPointerLeave={() => setAtiva(null)}>
        {lista.map((f) => (
          <li key={f.id} className={ativa === f.id ? "ativa" : undefined} onPointerEnter={() => setAtiva(f.id)} onClick={() => setAtiva(ativa === f.id ? null : f.id)}>
            <span className="amostra-serie" style={{ background: f.cor }} aria-hidden="true" />
            <span className="legenda-nome">{f.nome}</span>
            <span className="legenda-valor">{formato(f.valor)}</span>
            <span className="legenda-pct">{pct(f.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
