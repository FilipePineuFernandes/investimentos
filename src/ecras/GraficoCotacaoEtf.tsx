// Evolução da cotação dos ETF escolhidos, a partir do histórico que a app guarda sempre que vai
// buscar as cotações (os últimos 100 dias de cada vez) ou quando se indica uma à mão. Para comparar
// ETF com preços muito diferentes, mostra por defeito a variação (%) desde o início do período.

import { useState } from "react";
import { Aviso } from "../componentes/ui";
import { Icone } from "../componentes/Icone";
import { Janela } from "../componentes/Janela";
import { GraficoComparacao, type SerieGrafico } from "../componentes/GraficoComparacao";

const MAX_SERIES = 6;
type Periodo = "tudo" | "1a" | "6m" | "3m";
const NOMES_PERIODO: Record<Periodo, string> = { tudo: "Tudo", "1a": "1 ano", "6m": "6 meses", "3m": "3 meses" };
const MESES_PERIODO: Record<Periodo, number | null> = { tudo: null, "1a": 12, "6m": 6, "3m": 3 };

interface ConfigCotacao {
  /** ETF escolhidos (ISIN); null = os 3 com mais valor. */
  isins: string[] | null;
  emPct: boolean;
  periodo: Periodo;
}
/** A escolha fica enquanto a app está aberta. */
let escolhaCotacao: ConfigCotacao = { isins: null, emPct: true, periodo: "tudo" };

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
const pctEixo = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
const eur = (n: number) => `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const eurEixo = (n: number) => n.toLocaleString("pt-PT", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "EUR" });

export interface EtfComCotacoes {
  isin: string;
  codigo: string;
  /** Valor em carteira, para escolher os maiores por defeito. */
  valor: number;
  /** Por ordem de data. */
  pontos: { data: string; preco: number }[];
}

/** As séries a desenhar: a cotação em € ou a variação (%) desde a primeira cotação do período. */
export function seriesCotacao(etf: EtfComCotacoes[], isins: string[], emPct: boolean, desde: string): SerieGrafico[] {
  return etf
    .filter((e) => isins.includes(e.isin))
    .map((e) => {
      const pontos = e.pontos.filter((p) => p.data >= desde);
      const base = pontos[0]?.preco ?? 0;
      return {
        id: e.isin,
        nome: e.codigo,
        pontos: pontos.map((p) => ({ data: p.data, valor: emPct ? Math.round((p.preco / base - 1) * 10000) / 100 : p.preco })),
      };
    })
    .filter((s) => s.pontos.length >= 2);
}

export function GraficoCotacaoEtf({ etf }: { etf: EtfComCotacoes[] }) {
  const [config, setConfigEstado] = useState<ConfigCotacao>(escolhaCotacao);
  const [verParametros, setVerParametros] = useState(false);
  const setConfig = (c: ConfigCotacao) => {
    escolhaCotacao = c;
    setConfigEstado(c);
  };
  const comHistorico = etf.filter((e) => e.pontos.length >= 2).sort((a, b) => a.codigo.localeCompare(b.codigo, "pt", { numeric: true }));
  const escolhidos = config.isins ?? [...comHistorico].sort((a, b) => b.valor - a.valor).slice(0, 3).map((e) => e.isin);
  const meses = MESES_PERIODO[config.periodo];
  let desde = "";
  if (meses !== null) {
    const d = new Date();
    d.setMonth(d.getMonth() - meses);
    desde = d.toISOString().slice(0, 10);
  }
  const series = seriesCotacao(etf, escolhidos, config.emPct, desde);
  const descricao = `${config.emPct ? "Variação da cotação (%)" : "Cotação (€)"} · ${NOMES_PERIODO[config.periodo]}`;

  const grafico =
    comHistorico.length === 0 ? (
      <Aviso>
        Ainda não há histórico de cotações. A app passa a guardá-lo sempre que atualiza as cotações automáticas (os últimos 100 dias de cada ETF) ou quando indica uma
        cotação à mão. Volte aqui depois de atualizar as cotações na carteira de ETF.
      </Aviso>
    ) : series.length === 0 ? (
      <p className="suave">Os ETF escolhidos não têm cotações suficientes neste período. Escolha outros ETF ou um período maior em «Parâmetros».</p>
    ) : (
      <GraficoComparacao series={series} formato={config.emPct ? pct : eur} formatoEixo={config.emPct ? pctEixo : eurEixo} descricao={descricao} />
    );

  const grupo = <T,>(rotulo: string, opcoes: { v: T; nome: string }[], atual: T, muda: (v: T) => void) => (
    <div className="regimes regimes-4" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.nome} type="button" className={`botao ${atual === o.v ? "botao-verde" : "botao-secundario"}`} aria-pressed={atual === o.v} onClick={() => muda(o.v)}>
          {o.nome}
        </button>
      ))}
    </div>
  );

  return (
    <div className="cartao grafico-zona">
      <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icone nome="linha" /> Cotação dos ETF
      </h3>
      <p className="suave" style={{ margin: 0 }}>
        Evolução · {descricao}
      </p>
      {grafico}
      {config.emPct && series.length > 0 && <small className="ajuda">Variação em relação à primeira cotação do período, para comparar ETF com preços diferentes.</small>}
      <button data-icone="parametros" type="button" className="botao botao-secundario botao-parametros" aria-haspopup="dialog" onClick={() => setVerParametros(true)}>
        Parâmetros
      </button>

      {verParametros && (
        <Janela titulo="Parâmetros · Cotação dos ETF" onFechar={() => setVerParametros(false)}>
          <div className="cartao">
            <h3 style={{ margin: 0 }}>ETF a mostrar</h3>
            <p className="suave" style={{ margin: 0 }}>
              Escolha até {MAX_SERIES}. Só aparecem os ETF com cotações guardadas.
            </p>
            {comHistorico.length === 0 ? (
              <p className="suave">Ainda nenhum ETF tem cotações guardadas.</p>
            ) : (
              <div className="regimes regimes-4" role="group" aria-label="ETF a mostrar">
                {comHistorico.map((e) => {
                  const on = escolhidos.includes(e.isin);
                  return (
                    <button
                      key={e.isin}
                      type="button"
                      className={`botao ${on ? "botao-verde" : "botao-secundario"}`}
                      aria-pressed={on}
                      disabled={!on && escolhidos.length >= MAX_SERIES}
                      onClick={() => setConfig({ ...config, isins: on ? escolhidos.filter((x) => x !== e.isin) : [...escolhidos, e.isin] })}
                    >
                      {e.codigo}
                    </button>
                  );
                })}
              </div>
            )}

            <h3 style={{ margin: 0 }}>Mostrar como</h3>
            {grupo("Mostrar como", [{ v: true, nome: "Variação (%)" }, { v: false, nome: "Cotação (€)" }], config.emPct, (v) => setConfig({ ...config, emPct: v }))}
            <small className="ajuda">A variação (%) permite comparar ETF com preços muito diferentes no mesmo gráfico.</small>

            <h3 style={{ margin: 0 }}>Período</h3>
            {grupo(
              "Período",
              (Object.keys(NOMES_PERIODO) as Periodo[]).map((p) => ({ v: p, nome: NOMES_PERIODO[p] })),
              config.periodo,
              (v) => setConfig({ ...config, periodo: v }),
            )}
          </div>

          <div className="cartao grafico-zona">
            <h3 style={{ margin: 0 }}>Pré-visualização</h3>
            {grafico}
          </div>

          <div className="acoes">
            <button data-icone="ver" type="button" className="botao" onClick={() => setVerParametros(false)}>
              Ver o gráfico
            </button>
          </div>
        </Janela>
      )}
    </div>
  );
}
