// Simulação de investimento em ETF (pontos 6.1 e 6.4 a 6.6): valor a investir, propostas,
// escolha com o valor de cada ETF, e projeção a 4%, 6%, 8% e 10% com custos e impostos.

import { useEffect, useMemo, useState } from "react";
import { Aviso, Campo, CampoNumero, Ecra } from "../componentes/ui";
import { Indicadores } from "../componentes/Indicadores";
import { CENARIOS, HORIZONTES, INFLACAO, problemasETF, simular, type Escolha } from "../calculo/etf";
import { listarETF, NOMES_POLITICA, NOMES_REGIAO, NOMES_SETOR, type ETF, type RegiaoETF, type SetorETF } from "../dados/etf";
import { lerPerfil, type Perfil } from "../dados/perfil";
import { euros } from "../util/numeros";

const pct = (n: number, casas = 2) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: casas })}%`;

export function EtfSimulacao({ chave, voltar, onCatalogo }: { chave: CryptoKey; voltar: () => void; onCatalogo: () => void }) {
  const [catalogo, setCatalogo] = useState<ETF[] | null>(null);
  const [perfil, setPerfil] = useState<Perfil | undefined>();
  const [inicial, setInicial] = useState<number | null>(null);
  const [mensal, setMensal] = useState<number | null>(null);
  const [regiao, setRegiao] = useState<RegiaoETF | "">("");
  const [setor, setSetor] = useState<SetorETF | "">("");
  const [texto, setTexto] = useState("");
  /** Valor atribuído a cada ETF escolhido, por ISIN. */
  const [escolhidos, setEscolhidos] = useState<Record<string, number | null>>({});
  const [cenarios, setCenarios] = useState<(number | null)[]>(CENARIOS);
  const [inflacao, setInflacao] = useState<number | null>(INFLACAO);
  const [horizonte, setHorizonte] = useState(10);
  // Muda quando a app reparte o valor, para os campos de valor mostrarem os novos números.
  const [reparticao, setReparticao] = useState(0);

  useEffect(() => {
    Promise.all([listarETF(chave), lerPerfil(chave)]).then(([l, p]) => {
      setCatalogo(l);
      setPerfil(p);
    });
  }, [chave]);

  const validos = useMemo(() => (catalogo ?? []).filter((e) => problemasETF(e).length === 0), [catalogo]);
  const t = texto.trim().toLowerCase();
  const propostas = validos.filter(
    (e) =>
      e.isin in escolhidos ||
      ((!regiao || e.regiao === regiao) && (!setor || e.setor === setor) && (!t || [e.nome, e.indice, e.isin, e.emitente].some((x) => x.toLowerCase().includes(t)))),
  );
  const escolhas: Escolha[] = validos.filter((e) => e.isin in escolhidos && (escolhidos[e.isin] ?? 0) > 0).map((e) => ({ etf: e, valor: escolhidos[e.isin]! }));
  const atribuido = escolhas.reduce((s, x) => s + x.valor, 0);
  const taxas = cenarios.filter((c): c is number => c !== null);
  const sim = escolhas.length > 0 ? simular(escolhas, mensal ?? 0, perfil, taxas, HORIZONTES, inflacao ?? 0) : null;

  if (!catalogo) return <Ecra titulo="Simulação de ETF">A carregar…</Ecra>;

  function alternar(isin: string) {
    const novo = { ...escolhidos };
    if (isin in novo) delete novo[isin];
    else novo[isin] = null;
    setEscolhidos(novo);
  }

  function dividirIgual() {
    const isins = Object.keys(escolhidos);
    if (!inicial || isins.length === 0) return;
    const parte = Math.floor((inicial / isins.length) * 100) / 100;
    const novo: Record<string, number> = {};
    isins.forEach((k, n) => (novo[k] = n === isins.length - 1 ? Math.round((inicial - parte * (isins.length - 1)) * 100) / 100 : parte));
    setEscolhidos(novo);
    setReparticao(reparticao + 1);
  }

  return (
    <Ecra titulo="Simulação de ETF" voltar={voltar}>
      <h2>1. Valor a investir</h2>
      <div className="cartao grelha">
        <CampoNumero rotulo="Montante inicial" sufixo="€" valor={inicial} onChange={setInicial} />
        <CampoNumero rotulo="Reforço mensal" sufixo="€/mês" valor={mensal} onChange={setMensal} ajuda="Opcional. Divide-se pelos ETF na proporção do valor inicial." />
      </div>

      <h2>2. O que procura</h2>
      <div className="cartao grelha">
        <Campo rotulo="Região">
          {(id) => (
            <select id={id} value={regiao} onChange={(e) => setRegiao(e.target.value as RegiaoETF | "")}>
              <option value="">Todas</option>
              {(Object.keys(NOMES_REGIAO) as RegiaoETF[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_REGIAO[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Setor">
          {(id) => (
            <select id={id} value={setor} onChange={(e) => setSetor(e.target.value as SetorETF | "")}>
              <option value="">Todos</option>
              {(Object.keys(NOMES_SETOR) as SetorETF[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_SETOR[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Índice, nome ou ISIN">{(id) => <input id={id} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Por exemplo MSCI World" />}</Campo>
      </div>

      <h2>3. Propostas e escolha</h2>
      <p className="suave">
        Candidatos do seu catálogo que cumprem os critérios que escolheu. Na fase 4, a IA passa a apresentar e justificar as propostas. Escolha os que quer e
        atribua um valor a cada um. Só os escolhidos contam.
      </p>
      {validos.length === 0 ? (
        <Aviso>
          O catálogo ainda não tem ETF completos.{" "}
          <button type="button" className="botao-ligacao" onClick={onCatalogo}>
            Abrir o catálogo
          </button>
        </Aviso>
      ) : propostas.length === 0 ? (
        <Aviso>Nenhum ETF do catálogo cumpre estes critérios.</Aviso>
      ) : (
        <div className="cartao">
          {propostas.map((e) => {
            const escolhido = e.isin in escolhidos;
            return (
              <div key={e.isin} className="grelha" style={{ borderBottom: "1px solid var(--borda)", paddingBottom: 12, alignItems: "center" }}>
                <label className="caixa">
                  <input type="checkbox" checked={escolhido} onChange={() => alternar(e.isin)} />
                  <span>
                    <strong>{e.nome}</strong>
                    <span className="suave" style={{ display: "block" }}>
                      {e.isin} · TER {pct(e.ter ?? 0)} · {NOMES_POLITICA[e.politica]} · {e.domicilio}
                      {e.dimensao ? ` · ${e.dimensao.toLocaleString("pt-PT")} M€` : ""}
                    </span>
                  </span>
                </label>
                {escolhido && (
                  <CampoNumero
                    rotulo="Valor a investir neste ETF"
                    sufixo="€"
                    valor={escolhidos[e.isin]}
                    onChange={(v) => setEscolhidos({ ...escolhidos, [e.isin]: v })}
                    key={`${e.isin}-${reparticao}`}
                  />
                )}
              </div>
            );
          })}
          {Object.keys(escolhidos).length > 1 && inicial ? (
            <button type="button" className="botao botao-secundario" onClick={dividirIgual}>
              Dividir o montante inicial em partes iguais
            </button>
          ) : null}
        </div>
      )}
      {inicial !== null && escolhas.length > 0 && Math.abs(atribuido - inicial) > 0.005 && (
        <Aviso tipo="atencao">
          Atribuiu {euros(atribuido)} aos ETF escolhidos, e o montante inicial é {euros(inicial)}. A simulação usa os valores atribuídos.
        </Aviso>
      )}

      {sim && (
        <>
          <h2>4. Resultado</h2>
          <Indicadores
            itens={[
              { rotulo: "Investimento inicial", valor: euros(sim.inicialTotal), nota: `${escolhas.length} ETF` },
              { rotulo: "TER ponderado", valor: pct(sim.terPonderado, 3), nota: `${euros(sim.terAnual)} por ano` },
              { rotulo: "Custos de compra", valor: euros(sim.custosCompraIniciais), nota: perfil?.corretora.nome ? `Corretora ${perfil.corretora.nome}` : "Preencha a corretora no perfil" },
            ]}
          />

          <div className="cartao">
            <div className="acoes" role="group" aria-label="Horizonte">
              {HORIZONTES.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`botao ${h === horizonte ? "" : "botao-secundario"}`}
                  style={{ flex: "1 1 60px", minHeight: 40, padding: "6px 10px" }}
                  aria-pressed={h === horizonte}
                  onClick={() => setHorizonte(h)}
                >
                  {h} {h === 1 ? "ano" : "anos"}
                </button>
              ))}
            </div>
            <p className="suave">
              Investido em {horizonte} {horizonte === 1 ? "ano" : "anos"}: {euros(sim.resultados[horizonte][taxas[0]]?.investido ?? 0)}. Valores se vender tudo no fim do
              prazo.
            </p>
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Rendibilidade</th>
                    <th style={{ textAlign: "right" }}>Valor final</th>
                    <th style={{ textAlign: "right" }}>IRS na venda</th>
                    <th style={{ textAlign: "right" }}>Líquido</th>
                    <th style={{ textAlign: "right" }}>Em euros de hoje</th>
                    <th style={{ textAlign: "right" }}>Custo do TER</th>
                  </tr>
                </thead>
                <tbody>
                  {taxas.map((c) => {
                    const r = sim.resultados[horizonte][c];
                    return (
                      <tr key={c}>
                        <td>{pct(c)} ao ano</td>
                        <td style={{ textAlign: "right" }}>{euros(r.valorFinal)}</td>
                        <td style={{ textAlign: "right" }}>{euros(r.imposto)}</td>
                        <td style={{ textAlign: "right" }}>
                          <strong>{euros(r.liquido)}</strong>
                        </td>
                        <td style={{ textAlign: "right" }}>{euros(r.real)}</td>
                        <td style={{ textAlign: "right" }}>{euros(r.custoTER)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <small className="ajuda">
              Rendibilidade antes do TER, que a app desconta. «Em euros de hoje» desconta a inflação de {pct(inflacao ?? 0)} ao ano. IRS{" "}
              {perfil?.englobamentoMaisValias ? "por englobamento, como escolheu no perfil" : "à taxa de 28%"}.
            </small>
          </div>

          <details className="cartao">
            <summary>Alterar cenários e inflação</summary>
            <div className="grelha">
              {cenarios.map((c, k) => (
                <CampoNumero
                  key={k}
                  rotulo={`Cenário ${k + 1}`}
                  sufixo="%/ano"
                  valor={c}
                  onChange={(v) => setCenarios(cenarios.map((x, j) => (j === k ? v : x)))}
                />
              ))}
              <CampoNumero rotulo="Inflação" sufixo="%/ano" valor={inflacao} onChange={setInflacao} />
            </div>
          </details>

          <Aviso>Simulação com taxas fixas. Não é uma previsão nem aconselhamento financeiro ou fiscal. O registo da compra na carteira chega no próximo passo.</Aviso>
        </>
      )}
    </Ecra>
  );
}
