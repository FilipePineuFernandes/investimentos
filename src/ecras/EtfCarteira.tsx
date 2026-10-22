// Carteira de ETF (pontos 6.9 e 6.11): posições calculadas a partir dos movimentos,
// cotações introduzidas pelo utilizador, distribuição por região e setor, IRS das vendas.

import { useEffect, useState } from "react";
import { Aviso, Campo, CampoNumero, Ecra } from "../componentes/ui";
import { Indicadores } from "../componentes/Indicadores";
import { diaISO } from "../calculo/carteira";
import { impostoPorAno, posicaoEtf, type PosicaoEtf } from "../calculo/carteiraEtf";
import { listarETF, NOMES_REGIAO, NOMES_SETOR, type ETF } from "../dados/etf";
import {
  apagarMovimento,
  guardarCotacao,
  guardarMovimento,
  listarCotacoes,
  listarMovimentos,
  NOMES_ORIGEM,
  NOMES_TIPO,
  type Cotacao,
  type Movimento,
  type TipoMovimento,
} from "../dados/movimentosEtf";
import { lerPerfil, type Perfil } from "../dados/perfil";
import { euros } from "../util/numeros";

const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
const comSinal = (n: number) => `${n >= 0 ? "+" : "−"}${euros(Math.abs(n))}`;
const cor = (n: number | null) => (n !== null && n < 0 ? "var(--erro)" : undefined);
const pct = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;

export function EtfCarteira({ chave, voltar }: { chave: CryptoKey; voltar: () => void }) {
  const [catalogo, setCatalogo] = useState<ETF[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[] | null>(null);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [perfil, setPerfil] = useState<Perfil | undefined>();
  const [novo, setNovo] = useState(false);

  async function carregar() {
    const [c, m, q, p] = await Promise.all([listarETF(chave), listarMovimentos(chave), listarCotacoes(chave), lerPerfil(chave)]);
    setCatalogo(c);
    setMovimentos(m);
    setCotacoes(q);
    setPerfil(p);
  }

  useEffect(() => {
    carregar();
  }, [chave]);

  if (!movimentos) return <Ecra titulo="Carteira de ETF">A carregar…</Ecra>;

  const nome = (isin: string) => catalogo.find((e) => e.isin === isin)?.nome ?? isin;
  const isins = [...new Set(movimentos.map((m) => m.isin))];
  const posicoes = isins.map((isin) => posicaoEtf(isin, movimentos, cotacoes.find((c) => c.isin === isin)?.preco ?? null));
  const ativas = posicoes.filter((p) => p.quantidade > 0);
  const semCotacao = ativas.filter((p) => p.valorAtual === null).length;
  const valorAtual = ativas.reduce((s, p) => s + (p.valorAtual ?? 0), 0);
  const custo = ativas.reduce((s, p) => s + p.custo, 0);
  const latente = ativas.reduce((s, p) => s + (p.latente ?? 0), 0);
  const realizado = posicoes.reduce((s, p) => s + p.realizado, 0);
  const dividendos = posicoes.reduce((s, p) => s + p.dividendosLiquidos, 0);
  const impostos = impostoPorAno(posicoes);

  async function apagar(m: Movimento) {
    if (!window.confirm(`Apagar ${NOMES_TIPO[m.tipo].toLowerCase()} de ${data(m.data)} (${nome(m.isin)})?`)) return;
    await apagarMovimento(m.id);
    await carregar();
  }

  return (
    <Ecra titulo="Carteira de ETF" voltar={voltar}>
      {movimentos.length === 0 && <Aviso>Ainda não registou compras. Faça uma simulação e registe a compra no fim, ou registe aqui um movimento.</Aviso>}

      {ativas.length > 0 && (
        <Indicadores
          itens={[
            { rotulo: "Valor atual", valor: euros(valorAtual), nota: semCotacao > 0 ? `${semCotacao} ETF sem cotação` : `${ativas.length} ETF` },
            { rotulo: "Ganho latente", valor: comSinal(latente), cor: cor(latente), nota: `Sobre ${euros(custo)} investidos` },
            { rotulo: "Ganho realizado", valor: comSinal(realizado), cor: cor(realizado), nota: "Vendas (FIFO)" },
            { rotulo: "Dividendos líquidos", valor: euros(dividendos) },
          ]}
        />
      )}

      {posicoes.flatMap((p) => p.erros).map((e) => (
        <Aviso key={e} tipo="erro">
          {e}
        </Aviso>
      ))}

      {ativas.map((p) => (
        <CartaoPosicao key={p.isin} p={p} nome={nome(p.isin)} cotacao={cotacoes.find((c) => c.isin === p.isin)} onCotacao={async (c) => {
            await guardarCotacao(chave, c);
            await carregar();
          }} />
      ))}

      {ativas.length > 0 && <Distribuicao posicoes={ativas} catalogo={catalogo} />}

      {impostos.length > 0 && (
        <>
          <h2>IRS das vendas</h2>
          <div className="cartao tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Ano</th>
                  <th style={{ textAlign: "right" }}>Saldo</th>
                  <th style={{ textAlign: "right" }}>IRS a 28%</th>
                </tr>
              </thead>
              <tbody>
                {impostos.map((a) => (
                  <tr key={a.ano}>
                    <td>{a.ano}</td>
                    <td style={{ textAlign: "right", color: cor(a.saldo) }}>{comSinal(a.saldo)}</td>
                    <td style={{ textAlign: "right" }}>{euros(a.imposto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="ajuda">
              Saldo entre mais-valias e menos-valias de cada ano. Se optar pelo englobamento, o imposto é outro.
              {impostos.some((a) => a.curtoPrazo) &&
                " Há vendas de unidades detidas menos de 365 dias: se o seu rendimento coletável chegar ao último escalão, esse saldo é englobado obrigatoriamente."}
            </small>
          </div>
        </>
      )}

      <h2>Movimentos</h2>
      {novo ? (
        <NovoMovimento
          catalogo={catalogo}
          perfil={perfil}
          onCancelar={() => setNovo(false)}
          onGuardar={async (m) => {
            await guardarMovimento(chave, m);
            setNovo(false);
            await carregar();
          }}
        />
      ) : (
        <button className="botao botao-secundario" onClick={() => setNovo(true)}>
          Registar movimento
        </button>
      )}
      {movimentos.length > 0 && (
        <div className="cartao tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Movimento</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...movimentos].reverse().map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{data(m.data)}</td>
                  <td>
                    {NOMES_TIPO[m.tipo]} · {nome(m.isin)}
                    <div className="suave">
                      {m.tipo === "dividendo"
                        ? `Imposto retido ${euros(m.imposto)}`
                        : `${m.quantidade.toLocaleString("pt-PT", { maximumFractionDigits: 6 })} × ${euros(m.preco)} · comissão ${euros(m.comissao)}`}
                      {m.origem && ` · ${NOMES_ORIGEM[m.origem]}`}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>{euros(m.tipo === "dividendo" ? m.valor : m.quantidade * m.preco)}</td>
                  <td>
                    <button type="button" className="botao-ligacao" onClick={() => apagar(m)}>
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="suave">A app não liga à corretora: regista o que fez lá. As vendas usam o método FIFO, como manda a lei fiscal.</p>
    </Ecra>
  );
}

function CartaoPosicao({ p, nome, cotacao, onCotacao }: { p: PosicaoEtf; nome: string; cotacao: Cotacao | undefined; onCotacao: (c: Cotacao) => Promise<void> }) {
  const [preco, setPreco] = useState<number | null>(null);
  const [aEditar, setAEditar] = useState(false);
  return (
    <div className="cartao">
      <h3>{nome}</h3>
      <dl className="lista">
        <dt>Unidades</dt>
        <dd>{p.quantidade.toLocaleString("pt-PT", { maximumFractionDigits: 6 })}</dd>
        <dt>Custo (FIFO)</dt>
        <dd>
          {euros(p.custo)}
          <div className="suave">Preço médio {euros(p.precoMedio)} (só informativo)</div>
        </dd>
        <dt>Cotação</dt>
        <dd>
          {cotacao ? `${euros(cotacao.preco)} a ${data(cotacao.data)}` : "Sem cotação"}{" "}
          <button type="button" className="botao-ligacao" onClick={() => setAEditar(!aEditar)}>
            {cotacao ? "Atualizar" : "Indicar"}
          </button>
        </dd>
        {p.valorAtual !== null && (
          <>
            <dt>Valor atual</dt>
            <dd>
              <strong>{euros(p.valorAtual)}</strong>{" "}
              <span style={{ color: cor(p.latente) }}>
                ({comSinal(p.latente!)}
                {p.latentePct !== null && `, ${pct(p.latentePct)}`})
              </span>
            </dd>
          </>
        )}
      </dl>
      {aEditar && (
        <div className="grelha">
          <CampoNumero rotulo="Cotação de hoje" sufixo="€" valor={preco} onChange={setPreco} ajuda="Da corretora ou do site da bolsa." />
          <div style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="botao"
              disabled={!preco}
              onClick={async () => {
                await onCotacao({ isin: p.isin, preco: preco!, data: diaISO(new Date()) });
                setAEditar(false);
              }}
            >
              Guardar cotação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Distribuição do valor por região e por setor, em barras horizontais de uma só cor. */
function Distribuicao({ posicoes, catalogo }: { posicoes: PosicaoEtf[]; catalogo: ETF[] }) {
  const base = (p: PosicaoEtf) => p.valorAtual ?? p.custo;
  const total = posicoes.reduce((s, p) => s + base(p), 0);
  if (total <= 0) return null;
  const agrupar = (chave: (e: ETF | undefined) => string) => {
    const m = new Map<string, number>();
    for (const p of posicoes) {
      const k = chave(catalogo.find((e) => e.isin === p.isin));
      m.set(k, (m.get(k) ?? 0) + base(p));
    }
    return [...m.entries()].map(([nome, valor]) => ({ nome, valor, peso: (valor / total) * 100 })).sort((a, b) => b.valor - a.valor);
  };
  const grupos = [
    { titulo: "Por região", linhas: agrupar((e) => (e ? NOMES_REGIAO[e.regiao] : "Fora do catálogo")) },
    { titulo: "Por setor", linhas: agrupar((e) => (e ? NOMES_SETOR[e.setor] : "Fora do catálogo")) },
  ];
  return (
    <>
      <h2>Distribuição</h2>
      <div className="grelha">
        {grupos.map((g) => (
          <div key={g.titulo} className="cartao">
            <h3>{g.titulo}</h3>
            {g.linhas.map((l) => (
              <div key={l.nome} className="barra-linha" title={`${l.nome}: ${euros(l.valor)}`}>
                <div className="barra-rotulo">
                  <span>{l.nome}</span>
                  <span>{pct(Math.round(l.peso * 10) / 10)}</span>
                </div>
                <div className="barra-fundo">
                  <div className="barra" style={{ width: `${l.peso}%` }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <small className="ajuda">
        Pela região e pelo setor principais de cada ETF, com o valor atual (ou o custo, sem cotação). A exposição real por país e setor, a partir das posições de cada
        ETF, chega na fase 3.
      </small>
    </>
  );
}

function NovoMovimento({ catalogo, perfil, onGuardar, onCancelar }: { catalogo: ETF[]; perfil: Perfil | undefined; onGuardar: (m: Movimento) => Promise<void>; onCancelar: () => void }) {
  const [tipo, setTipo] = useState<TipoMovimento>("compra");
  const [isin, setIsin] = useState(catalogo[0]?.isin ?? "");
  const [dia, setDia] = useState(diaISO(new Date()));
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [comissao, setComissao] = useState<number | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [imposto, setImposto] = useState<number | null>(null);

  if (catalogo.length === 0) return <Aviso>Acrescente primeiro o ETF ao catálogo.</Aviso>;
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(dia) && isin && (tipo === "dividendo" ? !!valor : !!quantidade && !!preco);

  return (
    <div className="cartao">
      <div className="grelha">
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimento)}>
              {(Object.keys(NOMES_TIPO) as TipoMovimento[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_TIPO[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="ETF">
          {(id) => (
            <select id={id} value={isin} onChange={(e) => setIsin(e.target.value)}>
              {catalogo.map((e) => (
                <option key={e.isin} value={e.isin}>
                  {e.nome}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Data">{(id) => <input id={id} type="date" value={dia} onChange={(e) => setDia(e.target.value)} />}</Campo>
        {tipo === "dividendo" ? (
          <>
            <CampoNumero rotulo="Dividendo bruto" sufixo="€" valor={valor} onChange={setValor} />
            <CampoNumero rotulo="Imposto retido" sufixo="€" valor={imposto} onChange={setImposto} ajuda="Se a corretora reteve IRS." />
          </>
        ) : (
          <>
            <CampoNumero rotulo="Unidades" valor={quantidade} onChange={setQuantidade} ajuda="Pode ser fracionada." />
            <CampoNumero rotulo="Preço por unidade" sufixo="€" valor={preco} onChange={setPreco} />
            <CampoNumero rotulo="Comissão e câmbio" sufixo="€" valor={comissao} onChange={setComissao} />
          </>
        )}
      </div>
      <div className="acoes">
        <button
          type="button"
          className="botao"
          disabled={!valido}
          onClick={() =>
            onGuardar({
              id: crypto.randomUUID(),
              isin,
              tipo,
              data: dia,
              quantidade: quantidade ?? 0,
              preco: preco ?? 0,
              comissao: comissao ?? 0,
              valor: valor ?? 0,
              imposto: imposto ?? 0,
              corretora: perfil?.corretora.nome ?? "",
              origem: tipo === "compra" ? "propria" : null,
            })
          }
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
