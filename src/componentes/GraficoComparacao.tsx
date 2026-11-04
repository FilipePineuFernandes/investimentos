// Gráfico de linhas para comparar várias séries ao longo do tempo (imóveis, ETF, totais).
// SVG simples: cada série tem cor e traço próprios (a cor não é a única diferença), legenda por baixo
// e uma linha vertical com dica que segue o ponteiro (ou as setas do teclado) e mostra o valor de cada série nessa data.

import { useLayoutEffect, useRef, useState } from "react";
import { marcas } from "./GraficoLinha";

export interface SerieGrafico {
  id: string;
  nome: string;
  /** Por ordem de data. */
  pontos: { data: string; valor: number }[];
}

const ALTURA = 240;
const M = { cima: 16, direita: 16, baixo: 28, esquerda: 64 };
const ESTILOS = [
  { cor: "#08806d", traco: undefined },
  { cor: "#2563eb", traco: "7 4" },
  { cor: "#d97706", traco: "2 4" },
  { cor: "#7c3aed", traco: "9 3 2 3" },
  { cor: "#dc2626", traco: "5 5" },
  { cor: "#475569", traco: "1 4" },
];
export const estiloDaSerie = (k: number) => ESTILOS[k % ESTILOS.length];

const tempo = (d: string) => new Date(`${d}T00:00:00`).getTime();
const dataCurta = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT", { month: "short", year: "numeric" });
const dataLonga = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");

/** O valor da série numa data: o último ponto até essa data (null antes do primeiro). */
function valorEm(s: SerieGrafico, data: string): number | null {
  let r: number | null = null;
  for (const p of s.pontos) {
    if (p.data > data) break;
    r = p.valor;
  }
  return r;
}

export function GraficoComparacao({
  series,
  formato,
  formatoEixo,
  descricao,
}: {
  series: SerieGrafico[];
  /** Como se escreve um valor na dica. */
  formato: (n: number) => string;
  /** Como se escreve um valor no eixo (mais curto). */
  formatoEixo: (n: number) => string;
  descricao: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [ativo, setAtivo] = useState<number | null>(null);

  const datas = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.data)))].sort();
  const desenha = datas.length >= 2;
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    setLargura(Math.max(260, el.clientWidth));
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(260, e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, [desenha]);

  if (!desenha) return <p className="suave">Ainda não há pontos suficientes para desenhar o gráfico (é preciso pelo menos duas datas).</p>;

  const valores = series.flatMap((s) => s.pontos.map((p) => p.valor));
  const lo = Math.min(...valores, 0);
  const hi = Math.max(...valores, 0);
  const folga = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1;
  const ticks = marcas(lo < 0 ? lo - folga : lo, hi + folga);
  const vMin = ticks[0];
  const vMax = ticks[ticks.length - 1];
  const t0 = tempo(datas[0]);
  const t1 = tempo(datas[datas.length - 1]);

  const x = (d: string) => M.esquerda + ((tempo(d) - t0) / (t1 - t0 || 1)) * (largura - M.esquerda - M.direita);
  const y = (v: number) => M.cima + (1 - (v - vMin) / (vMax - vMin || 1)) * (ALTURA - M.cima - M.baixo);
  const base = ALTURA - M.baixo;

  function maisProximo(px: number) {
    let melhor = 0;
    datas.forEach((d, k) => {
      if (Math.abs(x(d) - px) < Math.abs(x(datas[melhor]) - px)) melhor = k;
    });
    return melhor;
  }

  const dia = ativo === null ? null : datas[ativo];
  const poucos = datas.length <= 24;

  return (
    <div>
      <div ref={caixa} className="grafico">
        {largura > 0 && (
          <svg
            width={largura}
            height={ALTURA}
            role="img"
            aria-label={`${descricao}. ${series.map((s) => s.nome).join(", ")}. Use as setas para percorrer as datas.`}
            tabIndex={0}
            onPointerMove={(e) => setAtivo(maisProximo(e.clientX - e.currentTarget.getBoundingClientRect().left))}
            onPointerLeave={() => setAtivo(null)}
            onBlur={() => setAtivo(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setAtivo((k) => Math.min((k ?? -1) + 1, datas.length - 1));
              else if (e.key === "ArrowLeft") setAtivo((k) => Math.max((k ?? datas.length) - 1, 0));
              else return;
              e.preventDefault();
            }}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.esquerda} x2={largura - M.direita} y1={y(v)} y2={y(v)} stroke="var(--borda)" strokeWidth={v === 0 && vMin < 0 ? 1.5 : 1} />
                <text x={M.esquerda - 8} y={y(v)} dy="0.32em" textAnchor="end" className="grafico-eixo">
                  {formatoEixo(v)}
                </text>
              </g>
            ))}
            <text x={x(datas[0])} y={ALTURA - 8} textAnchor="start" className="grafico-eixo">
              {dataCurta(datas[0])}
            </text>
            <text x={x(datas[datas.length - 1])} y={ALTURA - 8} textAnchor="end" className="grafico-eixo">
              {dataCurta(datas[datas.length - 1])}
            </text>

            {dia && <line x1={x(dia)} x2={x(dia)} y1={M.cima} y2={base} stroke="var(--texto-suave)" strokeWidth={1} />}
            {series.map((s, k) => {
              const { cor, traco } = estiloDaSerie(k);
              const linha = s.pontos.map((p, j) => `${j === 0 ? "M" : "L"}${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
              return (
                <g key={s.id}>
                  <path d={linha} fill="none" stroke={cor} strokeWidth={2.5} strokeDasharray={traco} strokeLinejoin="round" strokeLinecap="round" />
                  {(poucos || s.pontos.length === 1) && s.pontos.map((p, j) => <circle key={j} cx={x(p.data)} cy={y(p.valor)} r={3.5} fill={cor} stroke="var(--superficie)" strokeWidth={1.5} />)}
                  {dia && valorEm(s, dia) !== null && <circle cx={x(dia)} cy={y(valorEm(s, dia)!)} r={5.5} fill={cor} stroke="var(--superficie)" strokeWidth={2} />}
                </g>
              );
            })}
          </svg>
        )}

        {dia && (
          <div className="grafico-dica" style={{ left: Math.min(Math.max(x(dia), 110), largura - 110), top: 4, transform: "translateX(-50%)" }} aria-live="polite">
            <div className="suave">{dataLonga(dia)}</div>
            {series.map((s, k) => {
              const v = valorEm(s, dia);
              return (
                <div key={s.id}>
                  <span style={{ color: estiloDaSerie(k).cor }} aria-hidden="true">
                    ●{" "}
                  </span>
                  {s.nome}: <strong>{v === null ? "—" : formato(v)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ul className="legenda-grafico">
        {series.map((s, k) => {
          const { cor, traco } = estiloDaSerie(k);
          return (
            <li key={s.id}>
              <svg width="28" height="10" aria-hidden="true">
                <line x1="1" x2="27" y1="5" y2="5" stroke={cor} strokeWidth="2.5" strokeDasharray={traco} strokeLinecap="round" />
              </svg>
              {s.nome}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
