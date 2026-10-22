// Gráfico de linha de uma só série ao longo do tempo (evolução do valor de um imóvel ou
// da carteira). SVG simples, sem bibliotecas: linha de 2px, área a 10%, marcadores com
// anel da cor do fundo, grelha discreta, e uma linha vertical com dica que segue o
// ponteiro (ou as setas do teclado) até ao ponto mais próximo.

import { useLayoutEffect, useRef, useState } from "react";
import { euros } from "../util/numeros";

export interface Ponto {
  data: string; // AAAA-MM-DD
  valor: number;
}

const ALTURA = 220;
const M = { cima: 16, direita: 16, baixo: 28, esquerda: 72 };

const tempo = (d: string) => new Date(`${d}T00:00:00`).getTime();
const dataCurta = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT", { month: "short", year: "numeric" });
const dataLonga = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
const compacto = (n: number) => n.toLocaleString("pt-PT", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "EUR" });

/** Marcas "redondas" do eixo dos valores (1, 2 ou 5 × potência de 10). */
function marcas(min: number, max: number, quantas = 4): number[] {
  const bruto = (max - min) / quantas || Math.abs(max) || 1;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!;
  const inicio = Math.floor(min / passo) * passo;
  const lista: number[] = [];
  for (let v = inicio; v <= max + passo * 0.001; v += passo) lista.push(v);
  if (lista[lista.length - 1] < max) lista.push(lista[lista.length - 1] + passo);
  return lista;
}

export function GraficoLinha({ pontos, descricao }: { pontos: Ponto[]; descricao: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [ativo, setAtivo] = useState<number | null>(null);

  const desenha = pontos.length >= 2;
  // Mede a caixa antes de desenhar (useLayoutEffect), para o SVG nunca ser mais largo do que ela.
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    setLargura(Math.max(260, el.clientWidth));
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(260, e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, [desenha]);

  if (!desenha) return null;

  const t0 = tempo(pontos[0].data);
  const t1 = tempo(pontos[pontos.length - 1].data);
  const valores = pontos.map((p) => p.valor);
  const folga = (Math.max(...valores) - Math.min(...valores)) * 0.1 || Math.max(...valores) * 0.05;
  const ticks = marcas(Math.min(...valores) - folga, Math.max(...valores) + folga);
  const vMin = ticks[0];
  const vMax = ticks[ticks.length - 1];

  const x = (d: string) => M.esquerda + ((tempo(d) - t0) / (t1 - t0 || 1)) * (largura - M.esquerda - M.direita);
  const y = (v: number) => M.cima + (1 - (v - vMin) / (vMax - vMin || 1)) * (ALTURA - M.cima - M.baixo);
  const base = ALTURA - M.baixo;

  const linha = pontos.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const area = `${linha} L${x(pontos[pontos.length - 1].data).toFixed(1)},${base} L${x(pontos[0].data).toFixed(1)},${base} Z`;

  function maisProximo(px: number) {
    let melhor = 0;
    pontos.forEach((p, k) => {
      if (Math.abs(x(p.data) - px) < Math.abs(x(pontos[melhor].data) - px)) melhor = k;
    });
    return melhor;
  }

  const p = ativo === null ? null : pontos[ativo];
  const anterior = ativo !== null && ativo > 0 ? pontos[ativo - 1] : null;

  return (
    <div ref={caixa} className="grafico">
      {largura > 0 && (
        <svg
          width={largura}
          height={ALTURA}
          role="img"
          aria-label={`${descricao}: de ${euros(pontos[0].valor)} em ${dataLonga(pontos[0].data)} a ${euros(pontos[pontos.length - 1].valor)} em ${dataLonga(pontos[pontos.length - 1].data)}. Use as setas para percorrer os pontos.`}
          tabIndex={0}
          onPointerMove={(e) => setAtivo(maisProximo(e.clientX - e.currentTarget.getBoundingClientRect().left))}
          onPointerLeave={() => setAtivo(null)}
          onBlur={() => setAtivo(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setAtivo((k) => Math.min((k ?? -1) + 1, pontos.length - 1));
            else if (e.key === "ArrowLeft") setAtivo((k) => Math.max((k ?? pontos.length) - 1, 0));
            else return;
            e.preventDefault();
          }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.esquerda} x2={largura - M.direita} y1={y(v)} y2={y(v)} stroke="var(--borda)" strokeWidth={1} />
              <text x={M.esquerda - 8} y={y(v)} dy="0.32em" textAnchor="end" className="grafico-eixo">
                {compacto(v)}
              </text>
            </g>
          ))}
          <text x={x(pontos[0].data)} y={ALTURA - 8} textAnchor="start" className="grafico-eixo">
            {dataCurta(pontos[0].data)}
          </text>
          <text x={x(pontos[pontos.length - 1].data)} y={ALTURA - 8} textAnchor="end" className="grafico-eixo">
            {dataCurta(pontos[pontos.length - 1].data)}
          </text>

          <path d={area} fill="var(--realce)" opacity={0.1} />
          <path d={linha} fill="none" stroke="var(--realce)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {p && <line x1={x(p.data)} x2={x(p.data)} y1={M.cima} y2={base} stroke="var(--texto-suave)" strokeWidth={1} />}
          {pontos.map((q, k) => (
            <circle key={k} cx={x(q.data)} cy={y(q.valor)} r={k === ativo ? 6 : 4} fill="var(--realce)" stroke="var(--superficie)" strokeWidth={2} />
          ))}
        </svg>
      )}

      {p && (
        <div className="grafico-dica" style={{ left: Math.min(Math.max(x(p.data), 90), largura - 90), top: Math.max(y(p.valor) - 12, 0) }} aria-live="polite">
          <div className="suave">{dataLonga(p.data)}</div>
          <strong>{euros(p.valor)}</strong>
          {anterior && (
            <div className="suave">
              {p.valor >= anterior.valor ? "+" : "−"}
              {euros(Math.abs(p.valor - anterior.valor))} desde o ponto anterior
            </div>
          )}
        </div>
      )}
    </div>
  );
}
