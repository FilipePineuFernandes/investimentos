// Gráficos da carteira global: a pessoa escolhe o que medir (valor, o que pagou, lucro em € ou em %)
// e o que comparar (o total, o imobiliário, os ETF, cada imóvel e cada ETF).

import { useMemo, useState } from "react";
import { Aviso } from "../componentes/ui";
import { GraficoComparacao, type SerieGrafico } from "../componentes/GraficoComparacao";
import { NOMES_METRICA, valorDaMetrica, type HistoricoCarteira, type Metrica, type SerieHistorico } from "../calculo/historico";
import { euros } from "../util/numeros";

const MAXIMO = 6;
const METRICAS: Metrica[] = ["valor", "custo", "lucro", "lucroPct"];

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
const compacto = (n: number) => n.toLocaleString("pt-PT", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "EUR" });
const pctEixo = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;

/** Por defeito compara o imobiliário com os ETF; se só há uma área, mostra o total. */
function predefinidas(h: HistoricoCarteira): string[] {
  const areas = h.somas.filter((s) => s.tipo === "imobiliario" || s.tipo === "etf").map((s) => s.id);
  return areas.length === 2 ? areas : h.somas.slice(0, 1).map((s) => s.id);
}

export function GraficosCarteira({ historico }: { historico: HistoricoCarteira }) {
  const opcoes: SerieHistorico[] = useMemo(() => [...historico.somas, ...historico.ativos], [historico]);
  const [metrica, setMetrica] = useState<Metrica>("lucro");
  const [escolhidas, setEscolhidas] = useState<string[]>(() => predefinidas(historico));

  const series: SerieGrafico[] = useMemo(
    () =>
      opcoes
        .filter((o) => escolhidas.includes(o.id))
        .map((o) => ({
          id: o.id,
          nome: o.nome,
          pontos: o.pontos.flatMap((p) => {
            const v = valorDaMetrica(p, metrica);
            return v === null ? [] : [{ data: p.data, valor: v }];
          }),
        }))
        .filter((s) => s.pontos.length > 0),
    [opcoes, escolhidas, metrica],
  );

  if (opcoes.length === 0) {
    return (
      <Aviso>
        Ainda não há dados para desenhar. Os imóveis precisam de preço e de data de compra (abra o imóvel na lista «Dados de cada imóvel»), e os ETF de pelo menos uma compra.
      </Aviso>
    );
  }

  const cheio = escolhidas.length >= MAXIMO;
  const alternar = (id: string) => setEscolhidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length >= MAXIMO ? l : [...l, id]));
  const emEuros = metrica !== "lucroPct";
  const comEtf = opcoes.some((o) => escolhidas.includes(o.id) && o.tipo !== "imovel" && o.tipo !== "imobiliario");

  return (
    <div className="cartao">
      <h3>O que quer ver?</h3>
      <div className="regimes regimes-4" role="group" aria-label="O que medir">
        {METRICAS.map((m) => (
          <button key={m} type="button" className={`botao ${metrica === m ? "botao-verde" : "botao-secundario"}`} aria-pressed={metrica === m} onClick={() => setMetrica(m)}>
            {NOMES_METRICA[m]}
          </button>
        ))}
      </div>

      <h3>O que quer comparar?</h3>
      <p className="suave">Escolha até {MAXIMO}. Os imóveis e os ETF aparecem pelo nome.</p>
      <div className="estrategias" role="group" aria-label="O que comparar">
        {opcoes.map((o) => {
          const on = escolhidas.includes(o.id);
          return (
            <button key={o.id} type="button" className={`botao ${on ? "botao-verde" : "botao-secundario"}`} aria-pressed={on} disabled={!on && cheio} onClick={() => alternar(o.id)}>
              {o.nome}
            </button>
          );
        })}
      </div>

      {series.length === 0 ? (
        <Aviso>Escolha pelo menos uma opção para desenhar o gráfico.</Aviso>
      ) : (
        <>
          <h3>{NOMES_METRICA[metrica]}</h3>
          <GraficoComparacao
            series={series}
            formato={emEuros ? euros : pct}
            formatoEixo={emEuros ? compacto : pctEixo}
            descricao={`${NOMES_METRICA[metrica]} ao longo do tempo`}
          />
          {series.length < escolhidas.length && <small className="ajuda">Há opções sem pontos nesta medida (por exemplo, sem o que pagou para calcular a percentagem).</small>}
        </>
      )}

      {comEtf && (
        <small className="ajuda">
          Nos ETF, a app só conhece a cotação de hoje: antes de hoje o valor mostrado é o que pagou pelas unidades que tinha, e o lucro só aparece hoje.
        </small>
      )}
      {historico.fora.length > 0 && (
        <small className="ajuda">
          Ficam fora do gráfico por faltarem dados (preço ou data de compra): {historico.fora.join(", ")}.
        </small>
      )}
    </div>
  );
}
