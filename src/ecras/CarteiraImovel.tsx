// Secção "Carteira e histórico" da ficha do imóvel (ponto 5.11): posição atual,
// reavaliações, histórico, gráfico da evolução e resultado da venda.

import { useState } from "react";
import { Aviso, Campo, CampoNumero } from "../componentes/ui";
import { GraficoLinha } from "../componentes/GraficoLinha";
import { Indicadores } from "../componentes/Indicadores";
import { diaISO, evolucaoImovel, posicao, resultadoVenda } from "../calculo/carteira";
import type { AnaliseImovel } from "../calculo/imovel";
import { CARTEIRA_VAZIA, NOMES_METODO, VENDA_VAZIA, type Avaliacao, type DadosCarteira, type Imovel, type MetodoAvaliacao, type VendaRealizada } from "../dados/imoveis";
import { euros } from "../util/numeros";
import { pct, sinal } from "./Estrategias";

const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
const comSinal = (n: number) => `${n >= 0 ? "+" : "−"}${euros(Math.abs(n))}`;

export function CarteiraImovel({
  i,
  a,
  onChange,
  onGravarAvaliacao,
}: {
  i: Imovel;
  a: AnaliseImovel;
  onChange: (c: DadosCarteira) => void;
  /** Acrescenta a avaliação e grava o imóvel logo, para o histórico não se perder. */
  onGravarAvaliacao: (c: DadosCarteira) => Promise<void>;
}) {
  const c = i.carteira ?? CARTEIRA_VAZIA;
  const muda = <K extends keyof DadosCarteira>(k: K, v: DadosCarteira[K]) => onChange({ ...c, [k]: v });
  const venda = c.venda ?? VENDA_VAZIA;
  const mudaVenda = <K extends keyof VendaRealizada>(k: K, v: VendaRealizada[K]) => muda("venda", { ...venda, [k]: v });

  const hoje = diaISO(new Date());
  const p = posicao(i, a, hoje);
  const pontos = evolucaoImovel(i);
  const historico = [...c.avaliacoes].sort((x, y) => y.data.localeCompare(x.data));

  async function retirar(av: Avaliacao) {
    if (!window.confirm(`Retirar a avaliação de ${data(av.data)} (${euros(av.valor)}) do histórico?`)) return;
    await onGravarAvaliacao({ ...c, avaliacoes: c.avaliacoes.filter((x) => x.id !== av.id) });
  }

  return (
    <>
      <h2>Carteira e histórico</h2>
      <div className="cartao grelha">
        <Campo rotulo="Data de compra (escritura)" ajuda="Para a dívida em curso e o gráfico.">
          {(id) => <input id={id} type="date" value={c.dataCompra} onChange={(e) => muda("dataCompra", e.target.value)} />}
        </Campo>
        <CampoNumero rotulo="Obras já realizadas" sufixo="€" valor={c.obrasRealizadas} onChange={(v) => muda("obrasRealizadas", v)} ajuda="Entram no custo investido." />
      </div>

      {p ? (
        <Indicadores
          itens={[
            { rotulo: "Valor atual", valor: euros(p.valorAtual), nota: p.avaliadoEm ? `Avaliado a ${data(p.avaliadoEm)}` : "Preço de compra (sem avaliações)" },
            { rotulo: "Custo investido", valor: euros(p.custoInvestido), nota: "Compra, custos e obras" },
            { rotulo: "Mais-valia latente", valor: comSinal(p.maisValiaLatente), nota: pct(p.maisValiaPct), cor: sinal(p.maisValiaLatente) },
            { rotulo: "Dívida em curso", valor: p.divida === null ? "—" : euros(p.divida), nota: p.divida === null ? "Falta a data de compra" : undefined },
            { rotulo: "Capital próprio", valor: p.capitalProprio === null ? "—" : euros(p.capitalProprio), nota: "Valor atual − dívida" },
          ]}
        />
      ) : (
        <Aviso>Indique o valor de compra para ver a posição.</Aviso>
      )}

      <NovaAvaliacao ultima={historico[0]} onGravar={(av) => onGravarAvaliacao({ ...c, avaliacoes: [...c.avaliacoes, av] })} />

      {pontos.length >= 2 && (
        <div className="cartao">
          <h3>Evolução do valor</h3>
          <GraficoLinha pontos={pontos} descricao={`Evolução do valor de ${i.nome || "este imóvel"}`} />
        </div>
      )}

      {historico.length > 0 && (
        <details className="cartao" open={historico.length <= 5}>
          <summary>Histórico de avaliações ({historico.length})</summary>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                  <th style={{ textAlign: "right" }}>Renda</th>
                  <th>Método e fonte</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {historico.map((av) => (
                  <tr key={av.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{data(av.data)}</td>
                    <td style={{ textAlign: "right" }}>{euros(av.valor)}</td>
                    <td style={{ textAlign: "right" }}>{av.renda ? euros(av.renda) : "—"}</td>
                    <td>
                      {NOMES_METODO[av.metodo]}
                      {av.fonte && <div className="suave">{av.fonte}</div>}
                    </td>
                    <td>
                      <button type="button" className="botao-ligacao" onClick={() => retirar(av)} aria-label={`Retirar a avaliação de ${data(av.data)}`}>
                        Retirar
                      </button>
                    </td>
                  </tr>
                ))}
                {i.preco && c.dataCompra && (
                  <tr>
                    <td>{data(c.dataCompra)}</td>
                    <td style={{ textAlign: "right" }}>{euros(i.preco)}</td>
                    <td style={{ textAlign: "right" }}>—</td>
                    <td>Preço de compra</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {i.estado === "vendido" && (
        <>
          <h3>Venda realizada</h3>
          <div className="cartao grelha">
            <Campo rotulo="Data da venda">{(id) => <input id={id} type="date" value={venda.data} onChange={(e) => mudaVenda("data", e.target.value)} />}</Campo>
            <CampoNumero rotulo="Valor de venda" sufixo="€" valor={venda.valor} onChange={(v) => mudaVenda("valor", v)} />
            <CampoNumero rotulo="Custos de venda" sufixo="€" valor={venda.custos} onChange={(v) => mudaVenda("custos", v)} ajuda="Comissão, certificado, distrate…" />
            <CampoNumero rotulo="IRS pago sobre a mais-valia" sufixo="€" valor={venda.irs} onChange={(v) => mudaVenda("irs", v)} />
            <CampoNumero
              rotulo="Rendas líquidas recebidas"
              sufixo="€"
              valor={venda.rendimentoLiquido}
              onChange={(v) => mudaVenda("rendimentoLiquido", v)}
              ajuda="Total, se o imóvel esteve arrendado."
            />
          </div>
          <ResultadoVenda i={i} a={a} hoje={hoje} />
        </>
      )}
    </>
  );
}

function ResultadoVenda({ i, a, hoje }: { i: Imovel; a: AnaliseImovel; hoje: string }) {
  const p = posicao(i, a, hoje);
  const r = p ? resultadoVenda(i, p) : null;
  if (!r) return <Aviso>Indique a data de compra, a data e o valor da venda para ver o resultado.</Aviso>;
  return (
    <>
      <Indicadores
        itens={[
          { rotulo: "Lucro realizado", valor: comSinal(r.lucro), cor: sinal(r.lucro) },
          { rotulo: "ROI", valor: pct(r.roi), cor: sinal(r.roi) },
          { rotulo: "TIR anual", valor: r.tir === null ? "—" : pct(r.tir), cor: sinal(r.tir ?? 0) },
          { rotulo: "IRS pago", valor: euros(i.carteira?.venda?.irs ?? 0) },
        ]}
      />
      <small className="ajuda">Aproximação: considera todo o custo investido na data de compra e tudo o que recebeu na data da venda, sem separar o crédito.</small>
    </>
  );
}

function NovaAvaliacao({ ultima, onGravar }: { ultima: Avaliacao | undefined; onGravar: (a: Avaliacao) => Promise<void> }) {
  const [aberta, setAberta] = useState(false);
  const [dia, setDia] = useState(diaISO(new Date()));
  const [valor, setValor] = useState<number | null>(null);
  const [renda, setRenda] = useState<number | null>(null);
  const [metodo, setMetodo] = useState<MetodoAvaliacao>(ultima?.metodo ?? "comparaveis");
  const [fonte, setFonte] = useState("");
  const [aGravar, setAGravar] = useState(false);

  if (!aberta) {
    return (
      <button type="button" className="botao botao-secundario" onClick={() => setAberta(true)}>
        Reavaliar
      </button>
    );
  }

  async function gravar() {
    setAGravar(true);
    await onGravar({ id: crypto.randomUUID(), data: dia, valor: valor!, renda, metodo, fonte: fonte.trim() });
    setAGravar(false);
    setAberta(false);
    setValor(null);
    setRenda(null);
    setFonte("");
  }

  return (
    <div className="cartao">
      <h3>Nova avaliação</h3>
      <p className="suave">
        Por agora, a avaliação é introduzida por si. Na fase 2, a app vai buscar também a mediana do INE e os comparáveis.
        {ultima && ` Última: ${euros(ultima.valor)} a ${data(ultima.data)}.`}
      </p>
      <div className="grelha">
        <Campo rotulo="Data">{(id) => <input id={id} type="date" value={dia} onChange={(e) => setDia(e.target.value)} />}</Campo>
        <CampoNumero rotulo="Valor de mercado" sufixo="€" valor={valor} onChange={setValor} />
        <CampoNumero rotulo="Renda de mercado" sufixo="€/mês" valor={renda} onChange={setRenda} ajuda="Opcional." />
        <Campo rotulo="Método">
          {(id) => (
            <select id={id} value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoAvaliacao)}>
              {(Object.keys(NOMES_METODO) as MetodoAvaliacao[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_METODO[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Fonte" ajuda="Por exemplo: 3 anúncios no Idealista, relatório do banco…">
          {(id) => <input id={id} value={fonte} onChange={(e) => setFonte(e.target.value)} />}
        </Campo>
      </div>
      <div className="acoes">
        <button type="button" className="botao" disabled={!valor || !/^\d{4}-\d{2}-\d{2}$/.test(dia) || aGravar} onClick={gravar}>
          {aGravar ? "A gravar…" : "Gravar avaliação"}
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => setAberta(false)}>
          Cancelar
        </button>
      </div>
      <small className="ajuda">Gravar a avaliação guarda também as outras alterações feitas neste imóvel.</small>
    </div>
  );
}
