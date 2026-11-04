// Novo ETF (pontos 6.1 e 6.4 a 6.6): primeiro o setor, a região e se é um ETF que já tem na carteira; depois
// a escolha do ETF; só então o montante a investir. Segue-se a projeção a 4%, 6%, 8% e 10% com custos e impostos.

import { useEffect, useMemo, useState } from "react";
import { Aviso, Campo, CampoNumero, Ecra } from "../componentes/ui";
import { Indicadores } from "../componentes/Indicadores";
import { ComparacaoEtf } from "../componentes/ComparacaoEtf";
import { CENARIOS, custoCompra, HORIZONTES, INFLACAO, problemasETF, simular, unidadesCompra, type Escolha } from "../calculo/etf";
import { diaISO } from "../calculo/carteira";
import { guardarMovimento, listarMovimentos, type Movimento } from "../dados/movimentosEtf";
import { posicaoEtf } from "../calculo/carteiraEtf";
import { listarETF, NOMES_POLITICA, NOMES_REGIAO, NOMES_SETOR, type ETF, type RegiaoETF, type SetorETF } from "../dados/etf";
import { lerPerfil, type Perfil } from "../dados/perfil";
import { euros } from "../util/numeros";

const pct = (n: number, casas = 2) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: casas })}%`;

export function EtfSimulacao({ chave, voltar, onCatalogo, onCarteira }: { chave: CryptoKey; voltar: () => void; onCatalogo: () => void; onCarteira: () => void }) {
  const [catalogo, setCatalogo] = useState<ETF[] | null>(null);
  const [perfil, setPerfil] = useState<Perfil | undefined>();
  const [inicial, setInicial] = useState<number | null>(null);
  const [regiao, setRegiao] = useState<RegiaoETF | "">("");
  const [setor, setSetor] = useState<SetorETF | "">("");
  const [texto, setTexto] = useState("");
  /** Só os ETF que já tem na carteira. */
  const [soCarteira, setSoCarteira] = useState(false);
  const [emCarteira, setEmCarteira] = useState<Set<string>>(new Set());
  /** Valor atribuído a cada ETF escolhido, por ISIN. */
  const [escolhidos, setEscolhidos] = useState<Record<string, number | null>>({});
  const [cenarios, setCenarios] = useState<(number | null)[]>(CENARIOS);
  const [inflacao, setInflacao] = useState<number | null>(INFLACAO);
  const [horizonte, setHorizonte] = useState(10);
  // Muda quando a app reparte o valor, para os campos de valor mostrarem os novos números.
  const [reparticao, setReparticao] = useState(0);
  const [registar, setRegistar] = useState(false);

  useEffect(() => {
    Promise.all([listarETF(chave), lerPerfil(chave), listarMovimentos(chave)]).then(([l, p, movs]) => {
      setCatalogo(l);
      setPerfil(p);
      setEmCarteira(new Set([...new Set(movs.map((m) => m.isin))].filter((isin) => posicaoEtf(isin, movs, null).quantidade > 0)));
    });
  }, [chave]);

  const validos = useMemo(() => (catalogo ?? []).filter((e) => problemasETF(e).length === 0), [catalogo]);
  const t = texto.trim().toLowerCase();
  const propostas = validos.filter(
    (e) =>
      e.isin in escolhidos ||
      ((!regiao || e.regiao === regiao) && (!setor || e.setor === setor) && (!soCarteira || emCarteira.has(e.isin)) && (!t || [e.nome, e.indice, e.isin, e.ticker, e.emitente].some((x) => x.toLowerCase().includes(t)))),
  );
  const nEscolhidos = Object.keys(escolhidos).length;
  /** Com um só ETF escolhido, o montante inicial vai todo para ele; com vários, cada um tem o seu valor. */
  const valorDe = (isin: string) => (nEscolhidos === 1 ? inicial : escolhidos[isin]);
  const escolhas: Escolha[] = validos.filter((e) => e.isin in escolhidos && (valorDe(e.isin) ?? 0) > 0).map((e) => ({ etf: e, valor: valorDe(e.isin)! }));
  const atribuido = escolhas.reduce((s, x) => s + x.valor, 0);
  const taxas = cenarios.filter((c): c is number => c !== null);
  const sim = escolhas.length > 0 ? simular(escolhas, 0, perfil, taxas, HORIZONTES, inflacao ?? 0) : null;

  if (!catalogo) return <Ecra titulo="Novo ETF">A carregar…</Ecra>;

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
    <Ecra titulo="Novo ETF" voltar={voltar}>
      <h2>1. O que procura</h2>
      <div className="cartao grelha">
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
        <Campo rotulo="Índice, nome, código ou ISIN">{(id) => <input id={id} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Por exemplo MSCI World" />}</Campo>
        <div>
          <span className="rotulo-campo">Algum que já tenha na carteira?</span>
          <div className="regimes regimes-4" role="group" aria-label="Algum que já tenha na carteira?" style={{ marginTop: 6 }}>
            {[
              { v: false, nome: "Qualquer" },
              { v: true, nome: "Só os que já tenho" },
            ].map((o) => (
              <button key={o.nome} type="button" className={`botao ${soCarteira === o.v ? "botao-verde" : ""}`} aria-pressed={soCarteira === o.v} onClick={() => setSoCarteira(o.v)}>
                {o.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2>2. Escolha o ETF</h2>
      <p className="suave">
        ETF do seu catálogo que cumprem o que escolheu, todos negociados na Xetra (Alemanha), em euros. Na fase 4, a IA passa a apresentar e justificar as propostas. O montante a investir é pedido
        a seguir, depois de escolher.
      </p>
      {validos.length === 0 ? (
        <Aviso>
          O catálogo ainda não tem ETF completos.{" "}
          <button type="button" className="botao-ligacao" onClick={onCatalogo}>
            Abrir o catálogo
          </button>
        </Aviso>
      ) : propostas.length === 0 ? (
        <Aviso>
          {soCarteira && emCarteira.size === 0 ? "Ainda não tem ETF na carteira." : `Nenhum dos ${validos.length} ETF do seu catálogo cumpre tudo o que escolheu${[setor && NOMES_SETOR[setor], regiao && NOMES_REGIAO[regiao], t && `«${texto.trim()}»`].filter(Boolean).length > 0 ? ` (${[setor && NOMES_SETOR[setor], regiao && NOMES_REGIAO[regiao], t && `«${texto.trim()}»`].filter(Boolean).join(", ")})` : ""}. Os critérios somam-se: experimente tirar algum.`}{" "}
          <button type="button" className="botao-ligacao" onClick={onCatalogo}>
            Abrir o catálogo
          </button>
        </Aviso>
      ) : (
        <>
          {propostas.length >= 2 && (
            <>
              <h3>Comparação das propostas</h3>
              <ComparacaoEtf lista={propostas} hoje={diaISO(new Date())} escolhidos={Object.keys(escolhidos)} />
            </>
          )}
          <div className="cartao">
            {propostas.map((e) => (
              <div key={e.isin} style={{ borderBottom: "1px solid var(--borda)", paddingBottom: 12 }}>
                <label className="caixa">
                  <input type="checkbox" checked={e.isin in escolhidos} onChange={() => alternar(e.isin)} />
                  <span>
                    <strong>{e.nome}</strong>
                    {emCarteira.has(e.isin) && <span className="suave"> · já na carteira</span>}
                    <span className="suave" style={{ display: "block" }}>
                      <strong>{e.ticker}</strong> · {e.isin} · TER {pct(e.ter ?? 0)} · {NOMES_POLITICA[e.politica]} · {e.domicilio}
                      {e.dimensao ? ` · ${e.dimensao.toLocaleString("pt-PT")} M€` : ""}
                    </span>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </>
      )}

      {nEscolhidos > 0 && (
        <>
          <h2>3. Valor a investir</h2>
          <div className="cartao grelha">
            <CampoNumero rotulo="Montante a investir" sufixo="€" valor={inicial} onChange={setInicial} />
          </div>
          {nEscolhidos > 1 && (
            <div className="cartao">
              <p className="suave">Escolheu vários ETF: indique quanto vai para cada um.</p>
              {validos
                .filter((e) => e.isin in escolhidos)
                .map((e) => (
                  <CampoNumero
                    key={`${e.isin}-${reparticao}`}
                    rotulo={`Valor a investir em ${e.ticker || e.nome}`}
                    sufixo="€"
                    valor={escolhidos[e.isin]}
                    onChange={(v) => setEscolhidos({ ...escolhidos, [e.isin]: v })}
                  />
                ))}
              {inicial ? (
                <button type="button" className="botao botao-secundario" onClick={dividirIgual}>
                  Dividir o montante em partes iguais
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
      {nEscolhidos > 1 && inicial !== null && escolhas.length > 0 && Math.abs(atribuido - inicial) > 0.005 && (
        <Aviso tipo="atencao">
          Atribuiu {euros(atribuido)} aos ETF escolhidos, e o montante a investir é {euros(inicial)}. A simulação usa os valores atribuídos.
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

          <Aviso>Simulação com taxas fixas. Não é uma previsão nem aconselhamento financeiro ou fiscal.</Aviso>

          <h2>5. Registar a compra</h2>
          {registar ? (
            <RegistoCompra
              escolhas={escolhas}
              perfil={perfil}
              onCancelar={() => setRegistar(false)}
              onGuardar={async (movimentos) => {
                for (const m of movimentos) await guardarMovimento(chave, m);
                onCarteira();
              }}
            />
          ) : (
            <>
              <p className="suave">Depois de comprar na corretora, registe aqui o que comprou. Os ETF escolhidos e os valores passam para a carteira.</p>
              <button type="button" className="botao" onClick={() => setRegistar(true)}>
                Registar compra
              </button>
            </>
          )}
        </>
      )}
    </Ecra>
  );
}

/** Registo da compra feita na corretora: preço de cada ETF, unidades e comissão (6.11). */
function RegistoCompra({
  escolhas,
  perfil,
  onGuardar,
  onCancelar,
}: {
  escolhas: Escolha[];
  perfil: Perfil | undefined;
  onGuardar: (m: Movimento[]) => Promise<void>;
  onCancelar: () => void;
}) {
  const [dia, setDia] = useState(diaISO(new Date()));
  const [inteiras, setInteiras] = useState(false);
  const [precos, setPrecos] = useState<Record<string, number | null>>({});
  const [comissoes, setComissoes] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(escolhas.map((x) => [x.etf.isin, Math.round(custoCompra(x.etf, x.valor, perfil) * 100) / 100])),
  );
  const [aGuardar, setAGuardar] = useState(false);

  const linhas = escolhas.map((x) => {
    const preco = precos[x.etf.isin] ?? null;
    const comissao = comissoes[x.etf.isin] ?? 0;
    return { ...x, preco, comissao, ...(preco ? unidadesCompra(x.valor, preco, comissao, inteiras) : { quantidade: 0, gasto: 0, resto: x.valor }) };
  });
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(dia) && linhas.every((l) => l.preco && l.quantidade > 0);

  async function guardar() {
    setAGuardar(true);
    await onGuardar(
      linhas.map((l) => ({
        id: crypto.randomUUID(),
        isin: l.etf.isin,
        tipo: "compra",
        data: dia,
        quantidade: l.quantidade,
        preco: l.preco!,
        comissao: l.comissao,
        valor: 0,
        imposto: 0,
        corretora: perfil?.corretora.nome ?? "",
        origem: "proposta",
      })),
    );
  }

  return (
    <div className="cartao">
      <div className="grelha">
        <Campo rotulo="Data da compra">{(id) => <input id={id} type="date" value={dia} onChange={(e) => setDia(e.target.value)} />}</Campo>
        <label className="caixa" style={{ alignSelf: "center" }}>
          <input type="checkbox" checked={inteiras} onChange={(e) => setInteiras(e.target.checked)} />
          <span>A corretora só vende unidades inteiras</span>
        </label>
      </div>
      {linhas.map((l) => (
        <div key={l.etf.isin} className="grelha" style={{ borderTop: "1px solid var(--borda)", paddingTop: 12 }}>
          <div>
            <strong>{l.etf.nome}</strong>
            <div className="suave">Valor atribuído: {euros(l.valor)}</div>
          </div>
          <CampoNumero rotulo="Preço por unidade" sufixo="€" valor={l.preco} onChange={(v) => setPrecos({ ...precos, [l.etf.isin]: v })} ajuda="O preço a que comprou." />
          <CampoNumero
            rotulo="Comissão e câmbio"
            sufixo="€"
            valor={comissoes[l.etf.isin] ?? null}
            onChange={(v) => setComissoes({ ...comissoes, [l.etf.isin]: v })}
            ajuda="Calculada com a corretora do perfil. Corrija se for diferente."
          />
          <div className="suave" style={{ alignSelf: "center" }}>
            {l.preco
              ? `${l.quantidade.toLocaleString("pt-PT", { maximumFractionDigits: 6 })} unidades · ${euros(l.gasto)}${l.resto > 0 ? ` · sobram ${euros(l.resto)}` : ""}`
              : "Indique o preço."}
          </div>
        </div>
      ))}
      <div className="acoes">
        <button type="button" className="botao" disabled={!valido || aGuardar} onClick={guardar}>
          {aGuardar ? "A guardar…" : "Guardar na carteira"}
        </button>
        <button type="button" className="botao botao-secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
