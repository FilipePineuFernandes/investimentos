// Comparação das propostas de ETF lado a lado: TER, política, replicação, dimensão do fundo,
// data de lançamento, número de posições e disponibilidade para particulares na UE.

import type { ReactNode } from "react";
import { anosDesde, classeDimensao, destaquesComparacao, posicaoDimensao, type ClasseDimensao } from "../calculo/etf";
import { NOME_BOLSA, NOMES_POLITICA, NOMES_REPLICACAO, type ETF } from "../dados/etf";
import "./ComparacaoEtf.css";

const NOMES_CLASSE: Record<ClasseDimensao, string> = { grande: "grande", media: "média", pequena: "pequena" };

const numero = (n: number, casas = 0) => n.toLocaleString("pt-PT", { maximumFractionDigits: casas });

function dataCurta(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
}

/** Indicador de cor da dimensão: de vermelho (pequeno) a verde (grande), com a classe escrita por baixo. */
function IndicadorDimensao({ milhoes }: { milhoes: number }) {
  const classe = classeDimensao(milhoes);
  return (
    <span className="indicador-dimensao">
      <span className="escala" role="img" aria-label={`Fundo de dimensão ${NOMES_CLASSE[classe]}`}>
        <span className="marca" style={{ left: `${posicaoDimensao(milhoes) * 100}%` }} />
      </span>
      <span className={`classe classe-${classe}`}>{NOMES_CLASSE[classe]}</span>
    </span>
  );
}

const Falta = () => <span className="suave">por preencher</span>;

export function ComparacaoEtf({ lista, hoje, escolhidos }: { lista: ETF[]; hoje: string; escolhidos: string[] }) {
  const d = destaquesComparacao(lista);
  const melhor = (grupo: string[], isin: string, texto: string) =>
    grupo.includes(isin) ? (
      <span className="destaque" title={texto}>
        ▲ {texto}
      </span>
    ) : null;

  const linhas: { fator: string; ajuda: string; valor: (e: ETF) => ReactNode }[] = [
    {
      fator: "Código e bolsa",
      ajuda: "O código a usar na corretora. Todos na Xetra, em euros: sem custos de câmbio.",
      valor: (e) => (
        <>
          <strong>{e.ticker}</strong>
          <span className="suave">{NOME_BOLSA} · EUR</span>
        </>
      ),
    },
    {
      fator: "TER",
      ajuda: "Custo anual, descontado ao valor do fundo.",
      valor: (e) => (
        <>
          <strong>{e.ter !== null ? `${numero(e.ter, 3)}% ao ano` : "—"}</strong>
          {melhor(d.ter, e.isin, "mais barato")}
        </>
      ),
    },
    {
      fator: "Política de rendimentos",
      ajuda: "Acumulação: reinveste os dividendos (só paga IRS na venda). Distribuição: paga dividendos, com IRS todos os anos.",
      valor: (e) => <strong>{NOMES_POLITICA[e.politica]}</strong>,
    },
    {
      fator: "Replicação",
      ajuda: "Física: o fundo compra as ações do índice. Sintética: usa contratos com um banco para obter o resultado do índice.",
      valor: (e) => <strong>{NOMES_REPLICACAO[e.replicacao]}</strong>,
    },
    {
      fator: "Dimensão do fundo",
      ajuda: "Fundos grandes (mais de 1 000 M€) têm, em regra, menos risco de fechar e mais liquidez.",
      valor: (e) =>
        e.dimensao !== null ? (
          <>
            <strong>{numero(e.dimensao)} M€</strong>
            <IndicadorDimensao milhoes={e.dimensao} />
            {melhor(d.dimensao, e.isin, "o maior")}
          </>
        ) : (
          <Falta />
        ),
    },
    {
      fator: "Data de lançamento",
      ajuda: "Um historial longo permite avaliar melhor como o fundo acompanha o índice.",
      valor: (e) => {
        const anos = anosDesde(e.dataLancamento, hoje);
        return anos !== null ? (
          <>
            <strong>{dataCurta(e.dataLancamento)}</strong>
            <span className="suave">
              {anos} {anos === 1 ? "ano" : "anos"}
            </span>
            {melhor(d.antiguidade, e.isin, "o mais antigo")}
          </>
        ) : (
          <Falta />
        );
      },
    },
    {
      fator: "Número de posições",
      ajuda: "Quantas empresas ou títulos o fundo detém. Mais posições significa mais diversificação, mas um ETF de um só setor tem naturalmente menos.",
      valor: (e) => (e.numeroPosicoes !== null ? <strong>{numero(e.numeroPosicoes)}</strong> : <Falta />),
    },
    {
      fator: "Disponível para particulares na UE",
      ajuda: "Só entram nas propostas ETF com documento KID para investidores particulares (regras UCITS/PRIIPs).",
      valor: () => <strong style={{ color: "var(--sucesso)" }}>✓ Sim, tem KID</strong>,
    },
  ];

  return (
    <div className="cartao">
      <div className="tabela-rolavel">
        <table className="comparacao-etf">
          <thead>
            <tr>
              <th scope="col">Fator</th>
              {lista.map((e) => (
                <th key={e.isin} scope="col" className={escolhidos.includes(e.isin) ? "escolhido" : undefined}>
                  {e.nome}
                  <div className="suave">
                    <strong>{e.ticker}</strong> · {e.isin}
                    {escolhidos.includes(e.isin) && " · escolhido"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.fator}>
                <th scope="row">
                  {l.fator}
                  <div className="suave">{l.ajuda}</div>
                </th>
                {lista.map((e) => (
                  <td key={e.isin} className={escolhidos.includes(e.isin) ? "escolhido" : undefined}>
                    <span className="valor-fator">{l.valor(e)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="ajuda">
        ▲ marca o melhor ETF em cada fator, quando há pelo menos dois com o valor preenchido. Os dados vêm do seu catálogo: os que faltam podem ser acrescentados
        na ficha de cada ETF.
      </small>
    </div>
  );
}
