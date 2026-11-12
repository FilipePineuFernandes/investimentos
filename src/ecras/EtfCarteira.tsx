// Carteira de ETF (pontos 6.9 e 6.11): posições calculadas a partir dos movimentos,
// cotações introduzidas pelo utilizador, distribuição por região e setor, IRS das vendas.

import { Fragment, useEffect, useRef, useState } from "react";
import { Aviso, Campo, CampoNumero, Ecra } from "../componentes/ui";
import { Indicadores } from "../componentes/Indicadores";
import { Icone, type NomeIcone } from "../componentes/Icone";
import { Janela } from "../componentes/Janela";
import { diaISO } from "../calculo/carteira";
import { impostoPorAno, posicaoEtf, type PosicaoEtf } from "../calculo/carteiraEtf";
import { listarETF, NOMES_REGIAO, NOMES_SETOR, type ETF } from "../dados/etf";
import {
  apagarMovimento,
  guardarCotacao,
  guardarMovimento,
  listarCotacoes,
  listarMovimentos,
  NOMES_TIPO,
  type Cotacao,
  type Movimento,
  type TipoMovimento,
} from "../dados/movimentosEtf";
import { lerPerfil, type Perfil } from "../dados/perfil";
import { apagarChaveCotacoes, guardarChaveCotacoes, lerChaveCotacoes } from "../dados/cotacoesAuto";
import { atualizarEmSerie, INTERVALO_PEDIDOS_MS, MENSAGENS_ERRO, type EtfACotar } from "../nuvem/cotacoes";
import { euros } from "../util/numeros";
import { assinalarAtividade } from "../util/atividade";
import { EtfImportar } from "./EtfImportar";

const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
const comSinal = (n: number) => `${n >= 0 ? "+" : "−"}${euros(Math.abs(n))}`;
const cor = (n: number | null) => (n !== null && n < 0 ? "var(--erro)" : undefined);
const pct = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
/** Ao abrir a carteira, renovam-se as cotações com mais de 20 horas: o serviço gratuito dá 25 pedidos
 *  por dia, por isso cada ETF é atualizado no máximo uma vez por dia, a começar pelos mais antigos. */
const VALIDADE_COTACAO_MS = 20 * 3_600_000;
/** Fundo de cada linha dos movimentos: compras a verde, vendas a vermelho, dividendos a azul (tons ténues). */
const FUNDO_TIPO: Record<TipoMovimento, string> = { compra: "var(--sucesso-fundo)", venda: "var(--erro-fundo)", dividendo: "var(--info-fundo)" };

export function EtfCarteira({ chave, voltar }: { chave: CryptoKey; voltar: () => void }) {
  const [catalogo, setCatalogo] = useState<ETF[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[] | null>(null);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [perfil, setPerfil] = useState<Perfil | undefined>();
  const [novo, setNovo] = useState(false);
  const [importar, setImportar] = useState(false);
  /** Painel das cotações automáticas aberto (abre-se sozinho se ainda não indicou a chave). */
  const [verCotacoes, setVerCotacoes] = useState<boolean | null>(null);
  const [importados, setImportados] = useState<number | null>(null);
  /** ETF (ISIN) com os movimentos abertos: só um de cada vez. */
  const [aberto, setAberto] = useState<string | null>(null);
  /** A chave do serviço de cotações (vazia se ainda não a indicou). Null enquanto carrega. */
  const [chaveApi, setChaveApi] = useState<string | null>(null);
  const [estadoCot, setEstadoCot] = useState<{ aAtualizar: boolean; mensagem: string | null; erro: boolean }>({ aAtualizar: false, mensagem: null, erro: false });
  const jaTentou = useRef(false);

  async function carregar() {
    const [c, m, q, p, k] = await Promise.all([listarETF(chave), listarMovimentos(chave), listarCotacoes(chave), lerPerfil(chave), lerChaveCotacoes(chave)]);
    setCatalogo(c);
    setMovimentos(m);
    setCotacoes(q);
    setPerfil(p);
    setChaveApi(k);
    return { c, m, q, k };
  }

  /** Vai buscar a cotação dos ETF que tem em carteira, um de cada vez e com os pedidos espaçados
   *  (5 por minuto), a começar pelos que têm a cotação mais antiga. Só as velhas, ao abrir a carteira. */
  async function atualizarCotacoes(c: ETF[], m: Movimento[], q: Cotacao[], k: string, soVelhas = false) {
    const idade = (isin: string) => {
      const obtida = q.find((x) => x.isin === isin)?.obtidaEm;
      return obtida ? Date.now() - new Date(obtida).getTime() : Infinity;
    };
    const ativos = [...new Set(m.map((x) => x.isin))]
      .filter((isin) => posicaoEtf(isin, m, null).quantidade > 0)
      .filter((isin) => !soVelhas || idade(isin) > VALIDADE_COTACAO_MS)
      .sort((a, b) => idade(b) - idade(a));
    const semCodigo = ativos.filter((isin) => !c.find((e) => e.isin === isin)?.ticker?.trim());
    const lista: EtfACotar[] = ativos
      .filter((isin) => !semCodigo.includes(isin))
      .map((isin) => ({ isin, ticker: c.find((e) => e.isin === isin)!.ticker.trim().toUpperCase(), simbolo: q.find((x) => x.isin === isin)?.simbolo }));
    if (lista.length === 0) {
      setEstadoCot({ aAtualizar: false, mensagem: "As cotações estão em dia.", erro: false });
      return;
    }
    const r = await atualizarEmSerie(lista, k, {
      onProgresso: (feitos, total, ticker) => {
        assinalarAtividade();
        const minutos = Math.max(1, Math.ceil(((total - feitos) * INTERVALO_PEDIDOS_MS) / 60_000));
        setEstadoCot({
          aAtualizar: true,
          mensagem: `A atualizar ${feitos + 1} de ${total} (${ticker}). Faltam cerca de ${minutos} min: o serviço gratuito só aceita 5 pedidos por minuto. Pode continuar a usar a app.`,
          erro: false,
        });
      },
      onCotacao: async (isin, ok) => {
        assinalarAtividade();
        await guardarCotacao(chave, { isin, preco: ok.preco, data: ok.data, simbolo: ok.simbolo, obtidaEm: new Date().toISOString() });
        setCotacoes(await listarCotacoes(chave));
      },
    });
    await carregar();
    const nomes = (l: string[]) => l.join(", ");
    const partes = [
      r.atualizadas > 0 ? `${r.atualizadas} ${r.atualizadas === 1 ? "cotação atualizada" : "cotações atualizadas"}.` : "",
      r.semDados.length > 0 ? `Sem cotação no serviço para: ${nomes(r.semDados)}.` : "",
      semCodigo.length > 0 ? `Sem código da Xetra no catálogo: ${nomes(semCodigo.map((isin) => c.find((e) => e.isin === isin)?.nome ?? isin))}.` : "",
      r.erro ? `${MENSAGENS_ERRO[r.erro]}${r.porFazer > 0 && r.erro !== "limite" ? ` Ficaram ${r.porFazer} por atualizar.` : r.porFazer > 0 ? ` Ficaram ${r.porFazer}.` : ""}` : "",
    ];
    setEstadoCot({ aAtualizar: false, mensagem: partes.filter(Boolean).join(" ") || "Nada para atualizar.", erro: r.erro !== null || r.semDados.length > 0 || semCodigo.length > 0 });
  }

  useEffect(() => {
    carregar().then(({ c, m, q, k }) => {
      if (!k || jaTentou.current) return;
      const ativos = [...new Set(m.map((x) => x.isin))].filter((isin) => posicaoEtf(isin, m, null).quantidade > 0);
      const velha = ativos.some((isin) => {
        const cot = q.find((x) => x.isin === isin);
        return !cot?.obtidaEm || Date.now() - new Date(cot.obtidaEm).getTime() > VALIDADE_COTACAO_MS;
      });
      jaTentou.current = true;
      if (velha) atualizarCotacoes(c, m, q, k, true);
    });
  }, [chave]);

  if (!movimentos) return <Ecra titulo="Carteira de ETF">A carregar…</Ecra>;

  const nome = (isin: string) => catalogo.find((e) => e.isin === isin)?.nome ?? isin;
  /** Código da Xetra do ETF (EUNL, SXR8…); se ainda não tiver código, o nome. */
  const codigo = (isin: string) => catalogo.find((e) => e.isin === isin)?.ticker?.trim().toUpperCase() || nome(isin);
  /** Sem chave do serviço, o painel abre-se sozinho para a pedir. */
  const painelCotacoes = verCotacoes === true;
  const isins = [...new Set(movimentos.map((m) => m.isin))];
  /** Movimentos agrupados por ETF, por ordem alfabética do código da Xetra. */
  const grupos: GrupoEtf[] = isins
    .map((isin) => {
      const ms = movimentos.filter((m) => m.isin === isin);
      const soma = (t: TipoMovimento, f: (m: Movimento) => number) => ms.filter((m) => m.tipo === t).reduce((a, m) => a + f(m), 0);
      return {
        isin,
        codigo: codigo(isin),
        movimentos: [...ms].reverse(),
        compras: soma("compra", (m) => m.quantidade * m.preco + m.comissao),
        vendas: soma("venda", (m) => m.quantidade * m.preco - m.comissao),
        dividendos: soma("dividendo", (m) => m.valor - m.imposto),
        unidades: posicaoEtf(isin, movimentos, null).quantidade,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt", { numeric: true }));
  const grupoAberto = grupos.find((g) => g.isin === aberto) ?? null;
  const posicoes = isins.map((isin) => posicaoEtf(isin, movimentos, cotacoes.find((c) => c.isin === isin)?.preco ?? null));
  const ativas = posicoes.filter((p) => p.quantidade > 0);
  const semCotacao = ativas.filter((p) => p.valorAtual === null).length;
  const valorAtual = ativas.reduce((s, p) => s + (p.valorAtual ?? 0), 0);
  const custo = ativas.reduce((s, p) => s + p.custo, 0);
  const latente = ativas.reduce((s, p) => s + (p.latente ?? 0), 0);
  const realizado = posicoes.reduce((s, p) => s + p.realizado, 0);
  const dividendos = posicoes.reduce((s, p) => s + p.dividendosLiquidos, 0);
  const impostos = impostoPorAno(posicoes);
  /** Tudo o que pagou nas compras (unidades × preço + comissão), incluindo as unidades já vendidas. */
  const compras = movimentos.filter((m) => m.tipo === "compra");
  const totalCompras = compras.reduce((s, m) => s + m.quantidade * m.preco + m.comissao, 0);
  const numeroCompras = compras.length;

  async function apagar(m: Movimento) {
    if (!window.confirm(`Apagar ${NOMES_TIPO[m.tipo].toLowerCase()} de ${data(m.data)} (${codigo(m.isin)})?`)) return;
    await apagarMovimento(m.id);
    await carregar();
  }

  return (
    <Ecra titulo="Carteira de ETF" voltar={voltar}>
      {movimentos.length === 0 && <Aviso>Ainda não registou compras. Faça uma simulação e registe a compra no fim, ou registe aqui um movimento.</Aviso>}

      {ativas.length > 0 && (
        <Indicadores
          itens={[
            {
              rotulo: "Total investido",
              valor: euros(totalCompras),
              nota: `Soma das ${numeroCompras} ${numeroCompras === 1 ? "compra" : "compras"}, com comissões`,
              largo: true,
            },
            { rotulo: "Valor atual", valor: euros(valorAtual), nota: semCotacao > 0 ? `${semCotacao} ETF sem cotação` : `${ativas.length} ETF` },
            { rotulo: "Ganho latente", valor: comSinal(latente), cor: cor(latente), nota: `Sobre ${euros(custo)} investidos` },
            { rotulo: "Ganho realizado", valor: comSinal(realizado), cor: cor(realizado), nota: "Vendas (FIFO)" },
            { rotulo: "Dividendos líquidos", valor: euros(dividendos) },
          ]}
        />
      )}

      <div className="duas-areas">
        <BotaoIcone icone="cotacoes" nome="Cotações" onClick={() => setVerCotacoes(true)} />
        <BotaoIcone
          icone="registar"
          nome="Registar movimento"
          onClick={() => {
            setImportados(null);
            setNovo(true);
          }}
        />
        <BotaoIcone
          icone="importar"
          nome="Importar do Excel"
          onClick={() => {
            setImportados(null);
            setImportar(true);
          }}
        />
      </div>

      {/* Fora da janela: só o progresso ou o resultado da atualização automática. */}
      <CotacoesAutomaticas
        aberto={false}
        chaveApi={chaveApi}
        estado={estadoCot}
        onAtualizar={() => undefined}
        onGuardarChave={async () => undefined}
        onRemoverChave={async () => undefined}
      />
      {chaveApi === "" && ativas.length > 0 && <Aviso>Para as cotações aparecerem sozinhas, toque em «Cotações» e indique a chave gratuita do serviço.</Aviso>}
      {importados !== null && <Aviso tipo="sucesso">{importados === 1 ? "1 movimento importado do Excel." : `${importados} movimentos importados do Excel.`}</Aviso>}

      {painelCotacoes && (
        <Janela titulo="Cotações" onFechar={() => setVerCotacoes(false)}>
          <CotacoesAutomaticas
            aberto
            chaveApi={chaveApi}
            estado={estadoCot}
            onAtualizar={() => atualizarCotacoes(catalogo, movimentos, cotacoes, chaveApi ?? "")}
            onGuardarChave={async (k) => {
              await guardarChaveCotacoes(chave, k);
              const r = await carregar();
              if (k) await atualizarCotacoes(r.c, r.m, r.q, k);
            }}
            onRemoverChave={async () => {
              await apagarChaveCotacoes();
              setEstadoCot({ aAtualizar: false, mensagem: null, erro: false });
              await carregar();
            }}
          />
          <CotacaoManual
            etf={ativas.map((p) => ({ isin: p.isin, codigo: codigo(p.isin), cotacao: cotacoes.find((c) => c.isin === p.isin) }))}
            onGuardar={async (c) => {
              await guardarCotacao(chave, c);
              await carregar();
            }}
          />
        </Janela>
      )}
      {importar && (
        <Janela titulo="Importar do Excel" onFechar={() => setImportar(false)}>
          <EtfImportar
            chave={chave}
            catalogo={catalogo}
            movimentos={movimentos}
            corretora={perfil?.corretora.nome ?? ""}
            onFechar={() => setImportar(false)}
            onImportado={async (n) => {
              await carregar();
              setImportar(false);
              setImportados(n);
            }}
          />
        </Janela>
      )}
      {novo && (
        <Janela titulo="Registar movimento" onFechar={() => setNovo(false)}>
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
        </Janela>
      )}
      {grupoAberto && (
        <Janela titulo={grupoAberto.codigo} onFechar={() => setAberto(null)}>
          <DetalheEtf g={grupoAberto} nome={nome(grupoAberto.isin)} onApagar={apagar} />
        </Janela>
      )}

      {posicoes.flatMap((p) => p.erros).map((e) => (
        <Aviso key={e} tipo="erro">
          {e}
        </Aviso>
      ))}

      {movimentos.length > 0 && <h2>Movimentos</h2>}
      {movimentos.length > 0 && (
        <div className="cartao tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>ETF</th>
                <th style={{ textAlign: "right" }}>Investido</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const abrir = () => setAberto(g.isin);
                return (
                  <Fragment key={g.isin}>
                    <tr
                      className="linha-movimento"
                      onClick={abrir}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), abrir())}
                      tabIndex={0}
                      aria-haspopup="dialog"
                    >
                      <td>
                        <strong>{g.codigo}</strong>
                        <div className="suave">
                          {g.movimentos.length} {g.movimentos.length === 1 ? "movimento" : "movimentos"}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{euros(g.compras - g.vendas)}</td>
                      <td className="seta-grupo" aria-hidden="true">
                        ›
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <small className="ajuda">Investido = compras − vendas. Toque num ETF para ver os movimentos.</small>
        </div>
      )}
      {movimentos.length > 0 && (
        <p className="legenda-movimentos suave">
          {(Object.keys(NOMES_TIPO) as TipoMovimento[]).map((t) => (
            <span key={t}>
              <span className="amostra" style={{ background: FUNDO_TIPO[t] }} aria-hidden="true" /> {NOMES_TIPO[t]}
            </span>
          ))}
        </p>
      )}
      <p className="suave">A app não liga à corretora: regista o que fez lá. As vendas usam o método FIFO, como manda a lei fiscal.</p>

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

    </Ecra>
  );
}

interface GrupoEtf {
  isin: string;
  codigo: string;
  /** Do mais recente para o mais antigo. */
  movimentos: Movimento[];
  /** Total pago nas compras (com comissões). */
  compras: number;
  /** Total recebido nas vendas (já sem comissões). */
  vendas: number;
  /** Dividendos recebidos, já sem o imposto retido. */
  dividendos: number;
  unidades: number;
}

/** Movimentos de um ETF, abertos ao tocar na linha do código. */
function DetalheEtf({ g, nome, onApagar }: { g: GrupoEtf; nome: string; onApagar: (m: Movimento) => void }) {
  const un = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 6 });
  return (
    <div className="cartao">
      <strong>{nome}</strong>
      <dl className="lista">
        <dt>Unidades que tem</dt>
        <dd>{un(g.unidades)}</dd>
        <dt>Compras</dt>
        <dd>{euros(g.compras)}</dd>
        {g.vendas > 0 && (
          <>
            <dt>Vendas</dt>
            <dd>{euros(g.vendas)}</dd>
          </>
        )}
        {g.dividendos > 0 && (
          <>
            <dt>Dividendos</dt>
            <dd>{euros(g.dividendos)}</dd>
          </>
        )}
      </dl>
      <ul className="lista-movimentos">
        {g.movimentos.map((m) => (
          <li key={m.id} style={{ background: FUNDO_TIPO[m.tipo] }}>
            <div className="mov-topo">
              <span>
                {data(m.data)} <span className="suave">· {NOMES_TIPO[m.tipo]}</span>
              </span>
              <strong>{euros(m.tipo === "dividendo" ? m.valor : m.quantidade * m.preco)}</strong>
            </div>
            <div className="mov-base">
              <span className="suave">
                {m.tipo === "dividendo"
                  ? `Imposto retido ${euros(m.imposto)}`
                  : `${un(m.quantidade)} un. × ${euros(m.preco)}${m.comissao ? ` · comissão ${euros(m.comissao)}` : ""}`}
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
                  {e.ticker ? `${e.ticker.trim().toUpperCase()} · ${e.nome}` : e.nome}
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


/** Cotações do dia sem escrever à mão: pelo serviço gratuito Alpha Vantage, com a chave do próprio utilizador. */
function CotacoesAutomaticas({
  aberto,
  chaveApi,
  estado,
  onAtualizar,
  onGuardarChave,
  onRemoverChave,
}: {
  aberto: boolean;
  chaveApi: string | null;
  estado: { aAtualizar: boolean; mensagem: string | null; erro: boolean };
  onAtualizar: () => void;
  onGuardarChave: (k: string) => Promise<void>;
  onRemoverChave: () => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [aAlterar, setAAlterar] = useState(false);
  if (chaveApi === null) return null;
  const semChave = chaveApi === "";
  // Painel fechado: só se mostra o progresso ou o resultado da atualização, se houver.
  if (!aberto) return estado.mensagem ? <Aviso tipo={estado.erro ? "atencao" : "sucesso"}>{estado.mensagem}</Aviso> : null;

  return (
    <div className="cartao">
      <h3 style={{ margin: 0 }}>Cotações automáticas</h3>
      {semChave || aAlterar ? (
        <>
          <p className="suave">
            A app pode ir buscar o valor do dia de cada ETF ao serviço gratuito Alpha Vantage. Não liga à corretora nem envia dados pessoais: só o código do ETF.
          </p>
          <ol className="suave" style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>
              Abra{" "}
              <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer">
                alphavantage.co/support
              </a>
              .
            </li>
            <li>Preencha o pedido da chave gratuita (nome e email) e carregue em «GET FREE API KEY».</li>
            <li>Copie a chave que aparece e cole-a aqui.</li>
          </ol>
          <Campo rotulo="Chave do Alpha Vantage" ajuda="Fica guardada cifrada, como os outros dados. A chave gratuita dá 25 pedidos por dia.">
            {(id) => <input id={id} value={texto} onChange={(e) => setTexto(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} />}
          </Campo>
          <div className="acoes">
            <button
              type="button"
              className="botao"
              disabled={texto.trim().length < 8 || estado.aAtualizar}
              onClick={async () => {
                await onGuardarChave(texto);
                setTexto("");
                setAAlterar(false);
              }}
            >
              Guardar a chave e atualizar
            </button>
            {aAlterar && (
              <button type="button" className="botao" onClick={() => setAAlterar(false)}>
                Cancelar
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="suave">Ao abrir a carteira, a app atualiza uma vez por dia a cotação de cada ETF. O serviço gratuito só aceita 5 pedidos por minuto e 25 por dia: com muitos ETF, demora alguns minutos e alguns ficam para o dia seguinte.</p>
          <div className="acoes">
            <button type="button" className="botao" disabled={estado.aAtualizar} onClick={onAtualizar}>
              {estado.aAtualizar ? "A atualizar…" : "Atualizar cotações"}
            </button>
            <button type="button" className="botao" onClick={() => setAAlterar(true)}>
              Alterar a chave
            </button>
            <button type="button" className="botao" onClick={onRemoverChave}>
              Remover a chave
            </button>
          </div>
        </>
      )}
      {estado.mensagem && <Aviso tipo={estado.erro ? "atencao" : "sucesso"}>{estado.mensagem}</Aviso>}
    </div>
  );
}

/** Botão de ação com símbolo e nome por baixo, como no ecrã inicial. */
function BotaoIcone({ icone, nome, ativo, onClick }: { icone: NomeIcone; nome: string; ativo?: boolean; onClick: () => void }) {
  return (
    <button className={`area-botao${ativo ? " area-ativa" : ""}`} onClick={onClick} aria-haspopup="dialog">
      <span className="area-simbolo" aria-hidden="true">
        <Icone nome={icone} />
      </span>
      <span className="area-nome">{nome}</span>
    </button>
  );
}

/**
 * Cotação escrita à mão, para os ETF que o serviço automático não encontra. Fica marcada como manual
 * e, como conta como obtida hoje, a atualização automática não gasta pedidos com esse ETF durante um dia.
 */
function CotacaoManual({
  etf,
  onGuardar,
}: {
  etf: { isin: string; codigo: string; cotacao: Cotacao | undefined }[];
  onGuardar: (c: Cotacao) => Promise<void>;
}) {
  const [aEditar, setAEditar] = useState<string | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [dia, setDia] = useState(diaISO(new Date()));
  const [verTodos, setVerTodos] = useState(false);
  // Primeiro os que não têm cotação automática (sem cotação ou indicada à mão).
  const semAutomatica = etf.filter((e) => !e.cotacao || e.cotacao.manual);
  const lista = (verTodos ? etf : semAutomatica).slice().sort((a, b) => a.codigo.localeCompare(b.codigo, "pt", { numeric: true }));
  const emEdicao = etf.find((e) => e.isin === aEditar);

  return (
    <div className="cartao">
      <h3 style={{ margin: 0 }}>Cotação à mão</h3>
      <p className="suave" style={{ margin: 0 }}>
        Para os ETF que o serviço automático não encontra. Veja a cotação na corretora ou no site da bolsa e escreva-a aqui.
      </p>
      {semAutomatica.length === 0 && !verTodos && <Aviso tipo="sucesso">Todos os ETF que tem já têm cotação automática.</Aviso>}
      {lista.length > 0 && (
        <ul className="lista-movimentos">
          {lista.map((e) => (
            <li key={e.isin} style={{ background: "var(--fundo)" }}>
              <div className="mov-topo">
                <strong>{e.codigo}</strong>
                <button
                  type="button"
                  className="botao-ligacao"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setAEditar(e.isin);
                    setPreco(null);
                    setDia(diaISO(new Date()));
                  }}
                >
                  {e.cotacao ? "Atualizar" : "Indicar"}
                </button>
              </div>
              <span className="suave">
                {e.cotacao ? `${euros(e.cotacao.preco)} a ${data(e.cotacao.data)}${e.cotacao.manual ? " · indicada à mão" : " · automática"}` : "Sem cotação"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {emEdicao && (
        <Janela titulo={`Cotação de ${emEdicao.codigo}`} onFechar={() => setAEditar(null)}>
          <div className="cartao grelha">
            <CampoNumero rotulo="Cotação" sufixo="€" valor={preco} onChange={setPreco} ajuda="Preço de uma unidade, em euros, na corretora ou no site da bolsa." />
            <Campo rotulo="Dia da cotação">{(id) => <input id={id} type="date" value={dia} max={diaISO(new Date())} onChange={(x) => setDia(x.target.value)} />}</Campo>
          </div>
          <div className="acoes">
            <button
              type="button"
              className="botao"
              disabled={!preco || preco <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dia)}
              onClick={async () => {
                await onGuardar({ isin: emEdicao.isin, preco: preco!, data: dia, obtidaEm: new Date().toISOString(), manual: true });
                setAEditar(null);
              }}
            >
              Guardar cotação
            </button>
            <button type="button" className="botao botao-secundario" onClick={() => setAEditar(null)}>
              Cancelar
            </button>
          </div>
        </Janela>
      )}
      {etf.length > semAutomatica.length && (
        <button type="button" className="botao-ligacao" onClick={() => setVerTodos(!verTodos)}>
          {verTodos ? "Mostrar só os ETF sem cotação automática" : `Mostrar todos os ${etf.length} ETF`}
        </button>
      )}
    </div>
  );
}
