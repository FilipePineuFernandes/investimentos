// Carteira de criptomoedas: à imagem da carteira de ETF, só com o essencial. Movimentos por moeda,
// registo e importação do Excel, cotações automáticas (CoinGecko, sem chave) e o IRS das vendas
// com a regra dos 365 dias.

import { Fragment, useEffect, useRef, useState } from "react";
import { Aviso, Campo, CampoNumero, Ecra } from "../componentes/ui";
import { Indicadores } from "../componentes/Indicadores";
import { diaISO } from "../calculo/carteira";
import { DIAS_ISENCAO_CRIPTO, impostoCripto, posicaoCripto } from "../calculo/carteiraCripto";
import { descarregar } from "../dados/copias";
import { criarModeloCripto, interpretarFicheiroCripto, lerMoeda, NOME_MODELO_CRIPTO, type ResultadoImportacaoCripto } from "../dados/importarCripto";
import {
  apagarMovimentoCripto,
  guardarCotacaoCripto,
  guardarMovimentoCripto,
  listarCotacoesCripto,
  listarMovimentosCripto,
  NOMES_TIPO_CRIPTO,
  ordenarMovimentosCripto,
  type CotacaoCripto,
  type MovimentoCripto,
  type TipoCripto,
} from "../dados/movimentosCripto";
import { MENSAGENS_ERRO_CRIPTO, pedirCotacoesCripto } from "../nuvem/cotacoesCripto";
import { assinalarAtividade } from "../util/atividade";
import { euros } from "../util/numeros";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
const comSinal = (n: number) => `${n >= 0 ? "+" : "−"}${euros(Math.abs(n))}`;
const cor = (n: number | null) => (n !== null && n < 0 ? "var(--erro)" : undefined);
const qtd = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 8 });
/** Preço por unidade: as moedas muito baratas precisam de mais casas do que o cêntimo. */
const precoUnit = (n: number) => (n >= 1 ? euros(n) : `${n.toLocaleString("pt-PT", { maximumSignificantDigits: 6 })} €`);
/** Ao abrir a carteira, as cotações com mais de 15 minutos são renovadas (um só pedido para todas). */
const VALIDADE_COTACAO_MS = 15 * 60_000;
const FUNDO_TIPO: Record<TipoCripto, string> = { compra: "var(--sucesso-fundo)", venda: "var(--erro-fundo)" };

interface GrupoMoeda {
  moeda: string;
  movimentos: MovimentoCripto[];
  compras: number;
  vendas: number;
  quantidade: number;
  valorAtual: number | null;
}

export function CriptoCarteira({ chave, voltar }: { chave: CryptoKey; voltar: () => void }) {
  const [movimentos, setMovimentos] = useState<MovimentoCripto[] | null>(null);
  const [cotacoes, setCotacoes] = useState<CotacaoCripto[]>([]);
  const [novo, setNovo] = useState(false);
  const [importar, setImportar] = useState(false);
  const [importados, setImportados] = useState<number | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [estadoCot, setEstadoCot] = useState<{ aAtualizar: boolean; mensagem: string | null; erro: boolean }>({ aAtualizar: false, mensagem: null, erro: false });
  const jaTentou = useRef(false);

  async function carregar() {
    const [m, q] = await Promise.all([listarMovimentosCripto(chave), listarCotacoesCripto(chave)]);
    setMovimentos(m);
    setCotacoes(q);
    return { m, q };
  }

  /** Vai buscar as cotações de todas as moedas que tem, num só pedido. */
  async function atualizarCotacoes(m: MovimentoCripto[], q: CotacaoCripto[]) {
    const moedas = [...new Set(m.map((x) => x.moeda))].filter((moeda) => posicaoCripto(moeda, m, null).quantidade > 0);
    if (moedas.length === 0) return;
    setEstadoCot({ aAtualizar: true, mensagem: null, erro: false });
    assinalarAtividade();
    const ids = Object.fromEntries(q.map((c) => [c.moeda, c.idServico]));
    const r = await pedirCotacoesCripto(moedas, ids);
    const agora = new Date().toISOString();
    for (const c of r.cotacoes) await guardarCotacaoCripto(chave, { ...c, obtidaEm: agora });
    await carregar();
    const partes = [
      r.cotacoes.length > 0 ? `${r.cotacoes.length} ${r.cotacoes.length === 1 ? "cotação atualizada" : "cotações atualizadas"}.` : "",
      r.semDados.length > 0 ? `O serviço não conhece: ${r.semDados.join(", ")}. Confirme o código da moeda.` : "",
      r.erro ? MENSAGENS_ERRO_CRIPTO[r.erro] : "",
    ];
    setEstadoCot({ aAtualizar: false, mensagem: partes.filter(Boolean).join(" "), erro: r.erro !== null || r.semDados.length > 0 });
  }

  useEffect(() => {
    carregar().then(({ m, q }) => {
      if (jaTentou.current) return;
      jaTentou.current = true;
      const velha = [...new Set(m.map((x) => x.moeda))].some((moeda) => {
        const c = q.find((x) => x.moeda === moeda);
        return !c || Date.now() - new Date(c.obtidaEm).getTime() > VALIDADE_COTACAO_MS;
      });
      if (velha) atualizarCotacoes(m, q);
    });
  }, [chave]);

  if (!movimentos) return <Ecra titulo="Cripto">A carregar…</Ecra>;

  const moedas = [...new Set(movimentos.map((m) => m.moeda))];
  const cotacaoDe = (moeda: string) => cotacoes.find((c) => c.moeda === moeda);
  const posicoes = moedas.map((moeda) => ({ moeda, p: posicaoCripto(moeda, movimentos, cotacaoDe(moeda)?.preco ?? null) }));
  const ativas = posicoes.filter((x) => x.p.quantidade > 0);
  const semCotacao = ativas.filter((x) => x.p.valorAtual === null).length;
  const valorAtual = ativas.reduce((s, x) => s + (x.p.valorAtual ?? 0), 0);
  const custo = ativas.reduce((s, x) => s + x.p.custo, 0);
  const latente = ativas.reduce((s, x) => s + (x.p.latente ?? 0), 0);
  const realizado = posicoes.reduce((s, x) => s + x.p.realizado, 0);
  const impostos = impostoCripto(movimentos);
  const erros = posicoes.flatMap((x) => x.p.erros.map((e) => `${x.moeda}: ${e}`));

  const grupos: GrupoMoeda[] = posicoes
    .map(({ moeda, p }) => {
      const ms = movimentos.filter((m) => m.moeda === moeda);
      const soma = (t: TipoCripto, f: (m: MovimentoCripto) => number) => ms.filter((m) => m.tipo === t).reduce((a, m) => a + f(m), 0);
      return {
        moeda,
        movimentos: [...ms].reverse(),
        compras: soma("compra", (m) => m.quantidade * m.preco + m.comissao),
        vendas: soma("venda", (m) => m.quantidade * m.preco - m.comissao),
        quantidade: p.quantidade,
        valorAtual: p.valorAtual,
      };
    })
    .sort((a, b) => a.moeda.localeCompare(b.moeda, "pt", { numeric: true }));
  const ultimaCotacao = cotacoes.map((c) => c.obtidaEm).sort().at(-1);

  async function apagar(m: MovimentoCripto) {
    if (!window.confirm(`Apagar ${NOMES_TIPO_CRIPTO[m.tipo].toLowerCase()} de ${data(m.data)} (${m.moeda})?`)) return;
    await apagarMovimentoCripto(m.id);
    await carregar();
  }

  return (
    <Ecra titulo="Cripto" voltar={voltar}>
      {movimentos.length === 0 && <Aviso>Ainda não registou movimentos. Registe uma compra ou importe-as do Excel.</Aviso>}

      {ativas.length > 0 && (
        <Indicadores
          itens={[
            { rotulo: "Valor atual", valor: euros(valorAtual), nota: semCotacao > 0 ? `${semCotacao} sem cotação` : `${ativas.length} ${ativas.length === 1 ? "moeda" : "moedas"}` },
            { rotulo: "Ganho latente", valor: comSinal(latente), cor: cor(latente), nota: `Sobre ${euros(custo)} investidos` },
            { rotulo: "Ganho realizado", valor: comSinal(realizado), cor: cor(realizado), nota: "Vendas (FIFO)" },
          ]}
        />
      )}

      {ativas.length > 0 && (
        <div className="cartao">
          <div className="acoes" style={{ alignItems: "center" }}>
            <button type="button" className="botao botao-secundario" disabled={estadoCot.aAtualizar} onClick={() => atualizarCotacoes(movimentos, cotacoes)}>
              {estadoCot.aAtualizar ? "A atualizar…" : "Atualizar cotações"}
            </button>
          </div>
          <small className="ajuda">
            Cotações em euros do CoinGecko, gratuitas e sem chave. A app só envia os nomes das moedas.
            {ultimaCotacao && ` Última atualização: ${new Date(ultimaCotacao).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`}
          </small>
          {estadoCot.mensagem && <Aviso tipo={estadoCot.erro ? "atencao" : "sucesso"}>{estadoCot.mensagem}</Aviso>}
        </div>
      )}

      {erros.map((e) => (
        <Aviso key={e} tipo="erro">
          {e}
        </Aviso>
      ))}

      <h2>Movimentos</h2>
      {importados !== null && <Aviso tipo="sucesso">{importados === 1 ? "1 movimento importado do Excel." : `${importados} movimentos importados do Excel.`}</Aviso>}
      {importar ? (
        <ImportarCripto
          chave={chave}
          movimentos={movimentos}
          onFechar={() => setImportar(false)}
          onImportado={async (n) => {
            const { m, q } = await carregar();
            setImportar(false);
            setImportados(n);
            await atualizarCotacoes(m, q);
          }}
        />
      ) : novo ? (
        <NovoMovimentoCripto
          onCancelar={() => setNovo(false)}
          onGuardar={async (m) => {
            await guardarMovimentoCripto(chave, m);
            setNovo(false);
            const r = await carregar();
            if (!r.q.some((c) => c.moeda === m.moeda)) await atualizarCotacoes(r.m, r.q);
          }}
        />
      ) : (
        <div className="acoes">
          <button className="botao botao-secundario" onClick={() => { setImportados(null); setNovo(true); }}>
            Registar movimento
          </button>
          <button className="botao botao-secundario" onClick={() => { setImportados(null); setImportar(true); }}>
            Importar do Excel
          </button>
        </div>
      )}

      {grupos.length > 0 && (
        <div className="cartao tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Moeda</th>
                <th style={{ textAlign: "right" }}>Investido</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const abertoAqui = aberto === g.moeda;
                const alternar = () => setAberto(abertoAqui ? null : g.moeda);
                return (
                  <Fragment key={g.moeda}>
                    <tr
                      className="linha-movimento"
                      onClick={alternar}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), alternar())}
                      tabIndex={0}
                      aria-expanded={abertoAqui}
                    >
                      <td>
                        <strong>{g.moeda}</strong>
                        <div className="suave">
                          {g.movimentos.length} {g.movimentos.length === 1 ? "movimento" : "movimentos"}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{euros(g.compras - g.vendas)}</td>
                      <td className="seta-grupo" aria-hidden="true">
                        {abertoAqui ? "▴" : "▾"}
                      </td>
                    </tr>
                    {abertoAqui && (
                      <tr className="linha-detalhe">
                        <td colSpan={3}>
                          <DetalheMoeda g={g} cotacao={cotacaoDe(g.moeda)} onFechar={() => setAberto(null)} onApagar={apagar} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <small className="ajuda">Investido = compras − vendas. Toque numa moeda para ver os movimentos; toque de novo para fechar.</small>
        </div>
      )}
      {grupos.length > 0 && (
        <p className="legenda-movimentos suave">
          {(Object.keys(NOMES_TIPO_CRIPTO) as TipoCripto[]).map((t) => (
            <span key={t}>
              <span className="amostra" style={{ background: FUNDO_TIPO[t] }} aria-hidden="true" /> {NOMES_TIPO_CRIPTO[t]}
            </span>
          ))}
        </p>
      )}

      {impostos.length > 0 && (
        <>
          <h2>IRS das vendas</h2>
          <div className="cartao tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Ano</th>
                  <th style={{ textAlign: "right" }}>Tributável</th>
                  <th style={{ textAlign: "right" }}>Isento</th>
                  <th style={{ textAlign: "right" }}>IRS a 28%</th>
                </tr>
              </thead>
              <tbody>
                {impostos.map((a) => (
                  <tr key={a.ano}>
                    <td>{a.ano}</td>
                    <td style={{ textAlign: "right", color: cor(a.tributavel) }}>{comSinal(a.tributavel)}</td>
                    <td style={{ textAlign: "right", color: cor(a.isento) }}>{comSinal(a.isento)}</td>
                    <td style={{ textAlign: "right" }}>{euros(a.imposto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="ajuda">
              Tributável: ganhos e perdas de unidades detidas menos de {DIAS_ISENCAO_CRIPTO} dias (taxa de 28%, ou englobamento se optar). Isento: unidades detidas{" "}
              {DIAS_ISENCAO_CRIPTO} dias ou mais. Método FIFO. Estimativa a confirmar com um contabilista.
            </small>
          </div>
        </>
      )}

      <p className="suave">
        As criptomoedas podem perder grande parte do valor em pouco tempo. A app não liga às corretoras: regista o que fez lá. Ferramenta de simulação, não é aconselhamento
        financeiro nem fiscal.
      </p>
    </Ecra>
  );
}

function DetalheMoeda({ g, cotacao, onFechar, onApagar }: { g: GrupoMoeda; cotacao: CotacaoCripto | undefined; onFechar: () => void; onApagar: (m: MovimentoCripto) => void }) {
  return (
    <div className="detalhe-movimento">
      <button type="button" className="detalhe-cabecalho" onClick={onFechar} aria-label={`Fechar ${g.moeda}`}>
        <strong>{g.moeda}</strong>
        <span className="suave">Fechar ▴</span>
      </button>
      <dl className="lista">
        <dt>Quantidade que tem</dt>
        <dd>{qtd(g.quantidade)}</dd>
        <dt>Cotação</dt>
        <dd>{cotacao ? `${precoUnit(cotacao.preco)} a ${data(cotacao.data)}` : "Sem cotação"}</dd>
        {g.valorAtual !== null && (
          <>
            <dt>Valor atual</dt>
            <dd>{euros(g.valorAtual)}</dd>
          </>
        )}
        <dt>Compras</dt>
        <dd>{euros(g.compras)}</dd>
        {g.vendas > 0 && (
          <>
            <dt>Vendas</dt>
            <dd>{euros(g.vendas)}</dd>
          </>
        )}
      </dl>
      <ul className="lista-movimentos">
        {g.movimentos.map((m) => (
          <li key={m.id} style={{ background: FUNDO_TIPO[m.tipo] }}>
            <div className="mov-topo">
              <span>
                {data(m.data)} <span className="suave">· {NOMES_TIPO_CRIPTO[m.tipo]}</span>
              </span>
              <strong>{euros(m.quantidade * m.preco)}</strong>
            </div>
            <div className="mov-base">
              <span className="suave">
                {qtd(m.quantidade)} × {precoUnit(m.preco)}
                {m.comissao ? ` · comissão ${euros(m.comissao)}` : ""}
              </span>
              <button type="button" className="botao-ligacao" onClick={() => onApagar(m)}>
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NovoMovimentoCripto({ onGuardar, onCancelar }: { onGuardar: (m: MovimentoCripto) => Promise<void>; onCancelar: () => void }) {
  const [tipo, setTipo] = useState<TipoCripto>("compra");
  const [moeda, setMoeda] = useState("");
  const [dia, setDia] = useState(diaISO(new Date()));
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [comissao, setComissao] = useState<number | null>(null);
  const codigo = lerMoeda(moeda);
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(dia) && /^[A-Z0-9]{2,12}$/.test(codigo) && !!quantidade && !!preco;

  return (
    <div className="cartao">
      <div className="grelha">
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoCripto)}>
              {(Object.keys(NOMES_TIPO_CRIPTO) as TipoCripto[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_TIPO_CRIPTO[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Moeda" ajuda="O código, por exemplo BTC, ETH ou SOL.">
          {(id) => <input id={id} value={moeda} onChange={(e) => setMoeda(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="BTC" />}
        </Campo>
        <Campo rotulo="Data">{(id) => <input id={id} type="date" value={dia} onChange={(e) => setDia(e.target.value)} />}</Campo>
        <CampoNumero rotulo="Quantidade" valor={quantidade} onChange={setQuantidade} ajuda="Com todas as casas decimais, por exemplo 0,00125." />
        <CampoNumero rotulo="Preço por unidade" sufixo="€" valor={preco} onChange={setPreco} />
        <CampoNumero rotulo="Comissão" sufixo="€" valor={comissao} onChange={setComissao} />
      </div>
      <div className="acoes">
        <button
          type="button"
          className="botao"
          disabled={!valido}
          onClick={() => onGuardar({ id: crypto.randomUUID(), moeda: codigo, tipo, data: dia, quantidade: quantidade ?? 0, preco: preco ?? 0, comissao: comissao ?? 0 })}
        >
          Guardar movimento
        </button>
        <button type="button" className="botao botao-secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ImportarCripto({ chave, movimentos, onFechar, onImportado }: { chave: CryptoKey; movimentos: MovimentoCripto[]; onFechar: () => void; onImportado: (n: number) => Promise<void> }) {
  const [ficheiro, setFicheiro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacaoCripto | null>(null);
  const [erroModelo, setErroModelo] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function escolher(f: File | undefined) {
    if (!f) return;
    setFicheiro(f.name);
    setResultado(interpretarFicheiroCripto(new Uint8Array(await f.arrayBuffer()), movimentos));
    if (entrada.current) entrada.current.value = "";
  }

  const novos = resultado?.linhas.filter((l) => l.movimento && !l.repetido).map((l) => l.movimento!) ?? [];
  const repetidos = resultado?.linhas.filter((l) => l.repetido).length ?? 0;
  const comErros = resultado?.linhas.filter((l) => l.erros.length > 0) ?? [];
  const todos = ordenarMovimentosCripto([...movimentos, ...novos]);
  const avisosVendas = [...new Set(novos.filter((m) => m.tipo === "venda").map((m) => m.moeda))].flatMap((moeda) => posicaoCripto(moeda, todos, null).erros.map((e) => `${moeda}: ${e}`));

  async function gravar() {
    setAGravar(true);
    try {
      for (const m of novos) await guardarMovimentoCripto(chave, m);
      await onImportado(novos.length);
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="cartao">
      <h3 style={{ marginTop: 0 }}>Importar do Excel</h3>
      <ol className="suave" style={{ paddingLeft: 20, margin: "8px 0" }}>
        <li>Descarregue o modelo e abra-o no Excel ou no Numbers.</li>
        <li>Na folha «Movimentos», escreva um movimento por linha: data, tipo (Compra ou Venda), moeda (BTC, ETH…), quantidade, preço e comissão.</li>
        <li>Grave em formato .xlsx e escolha aqui o ficheiro. A app mostra o que leu antes de gravar.</li>
      </ol>
      <div className="acoes">
        <button
          type="button"
          className="botao botao-secundario"
          onClick={async () => {
            setErroModelo(null);
            try {
              await descarregar(NOME_MODELO_CRIPTO, criarModeloCripto(), TIPO_XLSX, "Modelo de movimentos de cripto");
            } catch (e) {
              setErroModelo((e as Error).message);
            }
          }}
        >
          Descarregar o modelo
        </button>
        <button type="button" className="botao" onClick={() => entrada.current?.click()}>
          {resultado ? "Escolher outro ficheiro" : "Escolher o ficheiro preenchido"}
        </button>
        <input ref={entrada} type="file" accept={`.xlsx,${TIPO_XLSX}`} style={{ display: "none" }} onChange={(e) => escolher(e.target.files?.[0])} />
      </div>
      {erroModelo && <Aviso tipo="atencao">{erroModelo}</Aviso>}

      {resultado?.erro && (
        <Aviso tipo="erro" titulo={ficheiro ?? undefined}>
          {resultado.erro}
        </Aviso>
      )}
      {resultado && !resultado.erro && (
        <>
          <Aviso tipo={novos.length > 0 && comErros.length === 0 ? "sucesso" : "atencao"} titulo={ficheiro ?? undefined}>
            {[
              `${novos.length} ${novos.length === 1 ? "movimento pronto" : "movimentos prontos"} a registar`,
              repetidos > 0 ? `${repetidos} já ${repetidos === 1 ? "estava registado" : "estavam registados"} (não ${repetidos === 1 ? "entra" : "entram"} outra vez)` : "",
              comErros.length > 0 ? `${comErros.length} com erros (não ${comErros.length === 1 ? "entra" : "entram"})` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
            .
          </Aviso>
          {comErros.length > 0 && (
            <details className="cartao" open>
              <summary>Linhas com erros</summary>
              <p className="suave">Corrija-as no Excel e envie de novo o ficheiro: os movimentos que já tiver registado não entram outra vez.</p>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                {comErros.map((l) => (
                  <li key={l.linha}>
                    <strong>Linha {l.linha}</strong>
                    {l.moeda && ` (${l.moeda})`}: {l.erros.join(" ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {avisosVendas.length > 0 && (
            <Aviso tipo="atencao" titulo="Vendas a confirmar">
              {avisosVendas.join(" ")} Verifique se falta alguma compra no ficheiro.
            </Aviso>
          )}
          {novos.length > 0 && (
            <ul className="lista-movimentos">
              {resultado.linhas
                .filter((l) => l.movimento && !l.repetido)
                .map((l) => {
                  const m = l.movimento!;
                  return (
                    <li key={l.linha} style={{ background: FUNDO_TIPO[m.tipo] }}>
                      <div className="mov-topo">
                        <span>
                          {data(m.data)} <span className="suave">· {NOMES_TIPO_CRIPTO[m.tipo]}</span> <strong>{m.moeda}</strong>
                        </span>
                        <strong>{euros(m.quantidade * m.preco)}</strong>
                      </div>
                      <span className="suave">
                        {qtd(m.quantidade)} × {precoUnit(m.preco)}
                        {m.comissao ? ` · comissão ${euros(m.comissao)}` : ""}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </>
      )}
      <div className="acoes">
        {novos.length > 0 && (
          <button type="button" className="botao" disabled={aGravar} onClick={gravar}>
            {aGravar ? "A registar…" : `Registar ${novos.length} ${novos.length === 1 ? "movimento" : "movimentos"}`}
          </button>
        )}
        <button type="button" className="botao botao-secundario" disabled={aGravar} onClick={onFechar}>
          {resultado ? "Cancelar" : "Fechar"}
        </button>
      </div>
    </div>
  );
}
