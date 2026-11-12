// Secção "Carteira e histórico" da ficha do imóvel (ponto 5.11): posição atual,
// reavaliações, histórico, gráfico da evolução e resultado da venda.

import { useState } from "react";
import { Aviso, Campo, CampoNumero } from "../componentes/ui";
import { Janela } from "../componentes/Janela";
import { GraficoLinha } from "../componentes/GraficoLinha";
import { Indicadores } from "../componentes/Indicadores";
import { diaISO, evolucaoImovel, posicao } from "../calculo/carteira";
import type { AnaliseImovel } from "../calculo/imovel";
import { rendasRecebidas } from "../calculo/patrimonio";
import { CARTEIRA_VAZIA, NOMES_METODO, type Avaliacao, type DadosCarteira, type Imovel, type MetodoAvaliacao } from "../dados/imoveis";
import { euros } from "../util/numeros";
import { pct } from "./Estrategias";

const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
/** Verde se ganhou, vermelho se perdeu. */
const corLucro = (n: number) => (n >= 0 ? "var(--sucesso)" : "var(--erro)");
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

  const hoje = diaISO(new Date());
  const p = posicao(i, a, hoje);
  const rendas = p ? rendasRecebidas(i, hoje) : null;
  const lucro = p ? p.maisValiaLatente + (rendas?.valor ?? 0) : null;
  const mostrarContrato = i.estado === "arrendado" || !!c.arrendadoDesde || c.rendaContrato != null || c.rendasRecebidas != null;
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

      {mostrarContrato && (
        <>
          <h3>Arrendamento</h3>
          <div className="cartao grelha">
            <Campo rotulo="Arrendado desde" ajuda="Início do contrato em curso.">
              {(id) => <input id={id} type="date" value={c.arrendadoDesde ?? ""} onChange={(e) => muda("arrendadoDesde", e.target.value)} />}
            </Campo>
            <CampoNumero
              rotulo="Renda mensal do contrato"
              sufixo="€"
              valor={c.rendaContrato ?? null}
              onChange={(v) => muda("rendaContrato", v)}
              ajuda="Conta-se como recebida em cada dia 8, desde o início do contrato."
            />
            <CampoNumero
              rotulo="Rendas recebidas até hoje"
              sufixo="€"
              valor={c.rendasRecebidas ?? null}
              onChange={(v) => muda("rendasRecebidas", v)}
              ajuda="Opcional. Se souber o valor exato, substitui a soma automática."
            />
          </div>
        </>
      )}

      {p ? (
        <Indicadores
          itens={[
            { rotulo: "Valor atual", valor: euros(p.valorAtual), nota: p.avaliadoEm ? `Avaliado a ${data(p.avaliadoEm)}` : "Preço de compra (sem avaliações)" },
            { rotulo: "Custo investido", valor: euros(p.custoInvestido), nota: "Compra, custos e obras" },
            { rotulo: "Valorização", valor: comSinal(p.maisValiaLatente), nota: `${pct(p.maisValiaPct)} · numa possível venda`, cor: corLucro(p.maisValiaLatente) },
            ...(rendas ? [{ rotulo: "Rendas recebidas", valor: comSinal(rendas.valor), nota: rendas.nota, cor: corLucro(rendas.valor) }] : []),
            { rotulo: "Lucro líquido", valor: comSinal(lucro!), nota: rendas ? "Valorização + rendas" : "Desde a aquisição", cor: corLucro(lucro!) },
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

  const botao = (
    <button type="button" className="botao botao-secundario" aria-haspopup="dialog" onClick={() => setAberta(true)}>
      Reavaliar
    </button>
  );
  if (!aberta) return botao;

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
    <>
    {botao}
    <Janela titulo="Nova avaliação" onFechar={() => setAberta(false)}>
    <div className="cartao">
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
    </Janela>
    </>
  );
}
