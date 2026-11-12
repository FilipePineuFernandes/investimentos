// Gráficos da carteira, por zonas: Carteira global, Imobiliário, ETF e Cripto. Cada zona abre já
// com um gráfico feito com os parâmetros base da área; por baixo de cada gráfico, o botão
// «Parâmetros» abre uma janela para escolher o tipo de gráfico (circular, barras, evolução), o que
// medir e como agrupar. As escolhas ficam enquanto a app está aberta.

import { Fragment, useMemo, useState } from "react";
import { GraficoCotacaoEtf } from "./GraficoCotacaoEtf";
import { Aviso } from "../componentes/ui";
import { Icone, type NomeIcone } from "../componentes/Icone";
import { Janela } from "../componentes/Janela";
import { GraficoCircular } from "../componentes/GraficoCircular";
import { GraficoBarras } from "../componentes/GraficoBarras";
import { GraficoComparacao, type SerieGrafico } from "../componentes/GraficoComparacao";
import { agregar, compatibilidade, NOMES_TIPO_GRAFICO, type ItemGrafico, type TipoGrafico } from "../calculo/graficos";
import { NOMES_METRICA, valorDaMetrica, type Metrica, type SerieHistorico } from "../calculo/historico";
import type { Ativo } from "../calculo/patrimonio";
import { NOMES_REGIAO, NOMES_SETOR } from "../dados/etf";
import { euros } from "../util/numeros";
import type { DadosCarteiraGlobal } from "./CarteiraGlobal";

const METRICAS: Metrica[] = ["valor", "custo", "lucro", "lucroPct"];
const TIPOS: TipoGrafico[] = ["circular", "barras", "evolucao"];
const ICONE_TIPO: Record<TipoGrafico, NomeIcone> = { circular: "circular", barras: "barras", evolucao: "linha" };
const MAX_SERIES = 6;

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
const comSinal = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${euros(Math.abs(n))}`;
const compacto = (n: number) => n.toLocaleString("pt-PT", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "EUR" });
const pctEixo = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;

interface Config {
  tipo: TipoGrafico;
  medida: Metrica;
  agrupar: string;
}

interface Agrupamento {
  id: string;
  nome: string;
  /** As séries no tempo para este agrupamento, se houver evolução. */
  evolucao?: () => SerieHistorico[];
}

/** Escolhas de cada zona, guardadas enquanto a app está aberta. */
const escolhas = new Map<string, Config>();

const item = (a: Ativo, grupos: ItemGrafico["grupos"]): ItemGrafico => ({ id: a.id, nome: a.nome, grupos, custo: a.custo, valor: a.valorAtual, lucro: a.lucro });

export function GraficosCarteira({ dados }: { dados: DadosCarteiraGlobal }) {
  const { imobiliario, etf, cripto, historico, etfInfo } = dados;
  const porTipo = (t: SerieHistorico["tipo"]) => historico.ativos.filter((s) => s.tipo === t);
  const maiores = (l: SerieHistorico[]) =>
    [...l].sort((a, b) => (b.pontos.at(-1)?.valor ?? 0) - (a.pontos.at(-1)?.valor ?? 0)).slice(0, MAX_SERIES);
  const soma = (id: string) => historico.somas.filter((s) => s.id === id);

  const zonas = useMemo(() => {
    const area = (id: string, nome: string) => ({ id, nome });
    const itensImoveis = imobiliario.ativos.map((a) => item(a, { area: area("imobiliario", "Imobiliário"), ativo: { id: a.id, nome: a.nome }, estado: { id: a.detalhe, nome: a.detalhe } }));
    const itensEtf = etf.ativos.map((a) => {
      const info = etfInfo[a.id];
      const codigo = info?.ticker || a.nome;
      return item(a, {
        area: area("etf", "ETF"),
        ativo: { id: a.id, nome: codigo },
        setor: info ? { id: info.setor, nome: NOMES_SETOR[info.setor] } : { id: "outro", nome: "Sem setor" },
        regiao: info ? { id: info.regiao, nome: NOMES_REGIAO[info.regiao] } : { id: "outra", nome: "Sem região" },
      });
    });
    const itensCripto = cripto.ativos.map((a) => item(a, { area: area("cripto", "Cripto"), ativo: { id: a.id, nome: a.nome } }));

    return [
      {
        id: "global",
        titulo: "Carteira global",
        icone: "carteira" as NomeIcone,
        itens: [...itensImoveis, ...itensEtf, ...itensCripto],
        base: { tipo: "circular", medida: "valor", agrupar: "area" } as Config,
        agrupamentos: [
          { id: "area", nome: "Área", evolucao: () => historico.somas },
          { id: "ativo", nome: "Cada ativo", evolucao: () => maiores(historico.ativos) },
        ] as Agrupamento[],
      },
      {
        id: "imobiliario",
        titulo: "Imobiliário",
        icone: "imobiliario" as NomeIcone,
        itens: itensImoveis,
        base: { tipo: "barras", medida: "lucro", agrupar: "ativo" } as Config,
        agrupamentos: [
          { id: "ativo", nome: "Cada imóvel", evolucao: () => maiores(porTipo("imovel")) },
          { id: "estado", nome: "Estado" },
          { id: "area", nome: "Total do imobiliário", evolucao: () => soma("imobiliario") },
        ] as Agrupamento[],
      },
      {
        id: "etf",
        titulo: "ETF",
        icone: "etf" as NomeIcone,
        itens: itensEtf,
        base: { tipo: "circular", medida: "valor", agrupar: "setor" } as Config,
        agrupamentos: [
          { id: "setor", nome: "Setor" },
          { id: "regiao", nome: "Região" },
          { id: "ativo", nome: "Cada ETF", evolucao: () => maiores(porTipo("etfAtivo")) },
          { id: "area", nome: "Total dos ETF", evolucao: () => soma("etf") },
        ] as Agrupamento[],
      },
      {
        id: "cripto",
        titulo: "Cripto",
        icone: "cripto" as NomeIcone,
        itens: itensCripto,
        base: { tipo: "circular", medida: "valor", agrupar: "ativo" } as Config,
        agrupamentos: [{ id: "ativo", nome: "Cada moeda" }] as Agrupamento[],
      },
    ].filter((z) => z.itens.length > 0);
  }, [dados]);

  if (zonas.length === 0) {
    return <Aviso>Ainda não há dados para desenhar. Registe imóveis comprados, compras de ETF ou de cripto.</Aviso>;
  }
  return (
    <>
      {zonas.map((z) => (
        <Fragment key={z.id}>
          <Zona {...z} notaEtf={z.id === "etf" || z.id === "global"} fora={z.id !== "etf" && z.id !== "cripto" ? historico.fora : []} />
          {z.id === "etf" && (
            <GraficoCotacaoEtf
              etf={etf.ativos.map((a) => ({ isin: a.id, codigo: etfInfo[a.id]?.ticker || a.nome, valor: a.valorAtual ?? a.custo ?? 0, pontos: dados.precosEtf[a.id] ?? [] }))}
            />
          )}
        </Fragment>
      ))}
    </>
  );
}

function Zona({
  id,
  titulo,
  icone,
  itens,
  base,
  agrupamentos,
  notaEtf,
  fora,
}: {
  id: string;
  titulo: string;
  icone: NomeIcone;
  itens: ItemGrafico[];
  base: Config;
  agrupamentos: Agrupamento[];
  notaEtf: boolean;
  fora: string[];
}) {
  const [config, setConfigEstado] = useState<Config>(() => escolhas.get(id) ?? base);
  const [verParametros, setVerParametros] = useState(false);
  const setConfig = (c: Config) => {
    escolhas.set(id, c);
    setConfigEstado(c);
  };
  const agrupamento = agrupamentos.find((a) => a.id === config.agrupar) ?? agrupamentos[0];
  const emPct = config.medida === "lucroPct";
  const formato = emPct ? pct : config.medida === "lucro" ? comSinal : euros;
  const titulo2 = `${NOMES_METRICA[config.medida]} · ${agrupamento.nome}`;
  const problema = compatibilidade(config.tipo, config.medida, !!agrupamento.evolucao);

  let grafico: React.ReactNode;
  let semDados = 0;
  if (problema) {
    grafico = <Aviso tipo="atencao">{problema}</Aviso>;
  } else if (config.tipo === "evolucao") {
    const series: SerieGrafico[] = agrupamento.evolucao!()
      .map((s) => ({
        id: s.id,
        nome: s.nome,
        pontos: s.pontos.flatMap((p) => {
          const v = valorDaMetrica(p, config.medida);
          return v === null ? [] : [{ data: p.data, valor: v }];
        }),
      }))
      .filter((s) => s.pontos.length > 0);
    grafico =
      series.length === 0 ? (
        <p className="suave">Não há pontos no tempo para esta medida.</p>
      ) : (
        <GraficoComparacao series={series} formato={formato} formatoEixo={emPct ? pctEixo : compacto} descricao={`${titulo2}, ao longo do tempo`} />
      );
  } else {
    const r = agregar(itens, agrupamento.id, config.medida);
    semDados = r.semDados;
    grafico =
      config.tipo === "circular" ? (
        <GraficoCircular fatias={r.grupos} formato={formato} descricao={titulo2} />
      ) : (
        <GraficoBarras barras={r.grupos} formato={formato} descricao={titulo2} />
      );
  }

  const mudou = config.tipo !== base.tipo || config.medida !== base.medida || config.agrupar !== base.agrupar;
  return (
    <div className="cartao grafico-zona">
      <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icone nome={icone} /> {titulo}
      </h3>
      <p className="suave" style={{ margin: 0 }}>
        {NOMES_TIPO_GRAFICO[config.tipo]} · {titulo2}
      </p>
      {grafico}
      {semDados > 0 && (
        <small className="ajuda">
          {semDados === 1 ? "1 ativo fica" : `${semDados} ativos ficam`} de fora por faltar o dado desta medida (por exemplo, a cotação de hoje).
        </small>
      )}
      {config.tipo === "evolucao" && notaEtf && (
        <small className="ajuda">
          Nos ETF, o valor de cada dia usa as cotações guardadas pela app (os últimos 100 dias de cada atualização). Antes da primeira cotação guardada conta o que pagou.
        </small>
      )}
      {config.tipo === "evolucao" && fora.length > 0 && <small className="ajuda">Ficam fora por faltarem dados (preço ou data de compra): {fora.join(", ")}.</small>}
      <button data-icone="parametros" type="button" className="botao botao-secundario botao-parametros" aria-haspopup="dialog" onClick={() => setVerParametros(true)}>
        Parâmetros
      </button>

      {verParametros && (
        <Janela titulo={`Parâmetros · ${titulo}`} onFechar={() => setVerParametros(false)}>
          <div className="cartao">
            <h3 style={{ margin: 0 }}>Tipo de gráfico</h3>
            <div className="tipos-grafico" role="group" aria-label="Tipo de gráfico">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`botao ${config.tipo === t ? "botao-verde" : "botao-secundario"}`}
                  aria-pressed={config.tipo === t}
                  onClick={() => {
                    // Ao escolher circular com o lucro, passa para o valor (o circular só mostra partes de um todo).
                    const medida = t === "circular" && (config.medida === "lucro" || config.medida === "lucroPct") ? "valor" : config.medida;
                    // Ao escolher evolução, passa para um agrupamento que tenha evolução.
                    const agrupar = t === "evolucao" && !agrupamento.evolucao ? (agrupamentos.find((a) => a.evolucao)?.id ?? config.agrupar) : config.agrupar;
                    setConfig({ tipo: t, medida, agrupar });
                  }}
                >
                  <Icone nome={ICONE_TIPO[t]} />
                  {NOMES_TIPO_GRAFICO[t]}
                </button>
              ))}
            </div>
            <small className="ajuda">Circular: partes de um todo. Barras: comparar valores. Evolução: como mudou ao longo do tempo.</small>

            <h3 style={{ margin: 0 }}>O que medir</h3>
            <div className="regimes regimes-4" role="group" aria-label="O que medir">
              {METRICAS.map((m) => {
                const impossivel = config.tipo === "circular" && (m === "lucro" || m === "lucroPct");
                return (
                  <button
                    key={m}
                    type="button"
                    className={`botao ${config.medida === m ? "botao-verde" : "botao-secundario"}`}
                    aria-pressed={config.medida === m}
                    disabled={impossivel}
                    onClick={() => setConfig({ ...config, medida: m })}
                  >
                    {NOMES_METRICA[m]}
                  </button>
                );
              })}
            </div>
            {config.tipo === "circular" && <small className="ajuda">O lucro não se mostra em gráfico circular: escolha barras ou evolução.</small>}

            <h3 style={{ margin: 0 }}>Agrupar por</h3>
            <div className="regimes regimes-4" role="group" aria-label="Agrupar por">
              {agrupamentos.map((a) => {
                const impossivel = config.tipo === "evolucao" && !a.evolucao;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`botao ${config.agrupar === a.id ? "botao-verde" : "botao-secundario"}`}
                    aria-pressed={config.agrupar === a.id}
                    disabled={impossivel}
                    onClick={() => setConfig({ ...config, agrupar: a.id })}
                  >
                    {a.nome}
                  </button>
                );
              })}
            </div>
            {config.tipo === "evolucao" && agrupamentos.some((a) => !a.evolucao) && (
              <small className="ajuda">Os agrupamentos desativados não têm evolução no tempo.</small>
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
            {mudou && (
              <button data-icone="repor" type="button" className="botao botao-secundario" onClick={() => setConfig(base)}>
                Repor o gráfico base
              </button>
            )}
          </div>
        </Janela>
      )}
    </div>
  );
}
