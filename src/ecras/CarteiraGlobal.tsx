// Carteira global: imóveis em posse (incluindo os arrendados) e ETF em posse, com o lucro
// líquido desde a aquisição até hoje, separado entre imobiliário e ETF.

import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { Abrivel } from "../componentes/Abrivel";
import { Icone } from "../componentes/Icone";
import { diaISO } from "../calculo/carteira";
import { posicaoEtf } from "../calculo/carteiraEtf";
import { analisarImovel } from "../calculo/imovel";
import { acontecimentos, historicoCarteira, type Acontecimento, type HistoricoCarteira } from "../calculo/historico";
import { grupoEtf, grupoImobiliario, grupoVendidos, totalCarteira, type Ativo, type Grupo, type GrupoVendidos } from "../calculo/patrimonio";
import { listarETF } from "../dados/etf";
import { listarImoveis, naCarteira } from "../dados/imoveis";
import { listarCotacoes, listarMovimentos } from "../dados/movimentosEtf";
import { lerPerfil } from "../dados/perfil";
import { euros } from "../util/numeros";
import { GraficosCarteira } from "./GraficosCarteira";
import "./CarteiraGlobal.css";

const corLucro = (n: number) => (n >= 0 ? "var(--sucesso)" : "var(--erro)");
const sinal = (n: number) => (n > 0 ? "+" : "");
const pct = (n: number | null) => (n === null ? "" : `${sinal(n)}${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`);
const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");

/** Lucro em euros e em percentagem: verde se ganhou, vermelho se perdeu. */
function Lucro({ valor, percentagem, grande }: { valor: number; percentagem: number | null; grande?: boolean }) {
  return (
    <span className={`lucro${grande ? " lucro-grande" : ""}`} style={{ color: corLucro(valor) }}>
      <span className="lucro-euros">
        {sinal(valor)}
        {euros(valor)}
      </span>
      {percentagem !== null && <span className="lucro-pct">{pct(percentagem)}</span>}
    </span>
  );
}

export interface DadosCarteiraGlobal {
  imobiliario: Grupo;
  etf: Grupo;
  /** Imóveis vendidos: já não estão na carteira, mas o lucro realizado conta para o resultado. */
  vendidos: GrupoVendidos;
  /** Os imóveis que já são seus (ou foram), para abrir os dados de cada um. */
  imoveis: { id: string; nome: string }[];
  historico: HistoricoCarteira;
  acontecimentos: Acontecimento[];
}

/** Junta os imóveis e os ETF guardados. Também usado no resumo do ecrã inicial. */
export async function carregarCarteiraGlobal(chave: CryptoKey): Promise<DadosCarteiraGlobal> {
  const hoje = diaISO(new Date());
  const [imoveis, perfil, catalogo, movimentos, cotacoes] = await Promise.all([
    listarImoveis(chave),
    lerPerfil(chave),
    listarETF(chave),
    listarMovimentos(chave),
    listarCotacoes(chave),
  ]);
  const isins = [...new Set(movimentos.map((m) => m.isin))];
  const posicoes = isins.map((isin) => posicaoEtf(isin, movimentos, cotacoes.find((c) => c.isin === isin)?.preco ?? null));
  const nomes = Object.fromEntries(catalogo.map((e) => [e.isin, { nome: e.nome, ticker: e.ticker }]));
  const analisados = imoveis.map((i) => ({ i, a: analisarImovel(i, perfil) }));
  const nomesEtf = Object.fromEntries(Object.entries(nomes).map(([isin, n]) => [isin, n.nome]));
  return {
    imobiliario: grupoImobiliario(analisados, hoje),
    etf: grupoEtf(posicoes, movimentos, nomes),
    vendidos: grupoVendidos(analisados, hoje),
    imoveis: imoveis.filter((i) => naCarteira(i) && i.estado !== "vendido").map((i) => ({ id: i.id, nome: i.nome || i.morada || "Imóvel sem nome" })),
    historico: historicoCarteira(
      analisados,
      movimentos,
      Object.fromEntries(cotacoes.map((c) => [c.isin, c.preco])),
      nomesEtf,
      hoje,
    ),
    acontecimentos: acontecimentos(imoveis, movimentos, nomesEtf),
  };
}

export function CarteiraGlobal({
  chave,
  voltar,
  onImoveis,
  onEtf,
  onImovel,
}: {
  chave: CryptoKey;
  voltar: () => void;
  onImoveis: () => void;
  onEtf: () => void;
  onImovel: (id: string) => void;
}) {
  const [dados, setDados] = useState<DadosCarteiraGlobal | null>(null);

  useEffect(() => {
    carregarCarteiraGlobal(chave).then(setDados);
  }, [chave]);

  if (!dados) return <Ecra titulo="Carteira global" voltar={voltar}>A carregar…</Ecra>;

  const { imobiliario, etf, imoveis, historico, vendidos } = dados;
  const total = totalCarteira(imobiliario, etf, vendidos);
  const vazia = imobiliario.ativos.length === 0 && etf.ativos.length === 0 && vendidos.ativos.length === 0;
  /** O imobiliário inclui o lucro já realizado nas vendas. */
  const lucroImobiliario = imobiliario.lucro + vendidos.lucro;
  const baseImobiliario = imobiliario.custo + vendidos.custo;
  const pctImobiliario = baseImobiliario > 0 ? Math.round((lucroImobiliario / baseImobiliario) * 10000) / 100 : null;

  return (
    <Ecra titulo="Carteira global" voltar={voltar}>
      <p>
        Os imóveis que tem (comprados, em obra, arrendados ou à venda) e os ETF que detém, com o <strong>lucro líquido</strong> de cada um desde a aquisição até
        hoje, {data(diaISO(new Date()))}.
      </p>

      {vazia ? (
        <Aviso>
          Ainda não tem ativos em carteira. Os imóveis entram quando passam de «em análise» para «comprado», e os ETF quando regista uma compra.
        </Aviso>
      ) : (
        <>
          <div className="cartao lucro-total">
            <div className="lucro-painel">
              <div className="lucro-centro">
                <div className="suave">Lucro líquido total</div>
                <Lucro valor={total.lucro} percentagem={total.lucroPct} grande />
              </div>
              <div className="lucro-lados">
                <div>
                  <div className="suave">Valor de hoje</div>
                  <strong>{euros(total.valorAtual)}</strong>
                </div>
                <div>
                  <div className="suave">Pagou</div>
                  <strong>{euros(total.custo)}</strong>
                </div>
              </div>
            </div>
            {vendidos.ativos.length > 0 && (
              <p className="suave" style={{ textAlign: "center", margin: 0 }}>
                Inclui <strong style={{ color: corLucro(total.lucroRealizado) }}>{sinal(total.lucroRealizado)}{euros(total.lucroRealizado)}</strong> de lucro realizado em imóveis vendidos.
              </p>
            )}
            <div className="lucro-partes">
              <div>
                <div className="suave">
                  <Icone nome="imobiliario" /> Imobiliário
                </div>
                <Lucro valor={lucroImobiliario} percentagem={pctImobiliario} />
              </div>
              <div>
                <div className="suave">
                  <Icone nome="etf" /> ETF
                </div>
                <Lucro valor={etf.lucro} percentagem={etf.lucroPct} />
              </div>
            </div>
          </div>

          <Seccao titulo="Imobiliário" comRendas grupo={imobiliario} vazio="Não tem imóveis em carteira." onAbrir={onImoveis} rotuloAbrir="Abrir os imóveis" />
          {vendidos.ativos.length > 0 || vendidos.incompletos.length > 0 ? <VendidosSeccao vendidos={vendidos} /> : null}
          <Seccao titulo="ETF" grupo={etf} vazio="Não tem ETF em carteira." onAbrir={onEtf} rotuloAbrir="Abrir a carteira de ETF" />
        </>
      )}

      {imoveis.length > 0 && (
        <>
          <h2>Dados de cada imóvel</h2>
          <p className="suave">Data de compra, obras, arrendamento, reavaliações e venda de cada imóvel.</p>
          <div className="duas-areas">
            {imoveis.map((m) => (
              <button key={m.id} type="button" className="area-botao" onClick={() => onImovel(m.id)}>
                <span className="area-simbolo" aria-hidden="true">
                  <Icone nome="imobiliario" />
                </span>
                <span className="area-nome">{m.nome}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Abrivel titulo="Histórico">
        <HistoricoLista lista={dados.acontecimentos} />
      </Abrivel>
      <Abrivel titulo="Gráficos">
        <GraficosCarteira historico={historico} />
      </Abrivel>

      <Aviso>
        <strong>Como se calcula o lucro líquido:</strong> nos imóveis vendidos, o lucro realizado é o valor de venda menos as despesas da venda (mediação com IVA, declaração de condomínio, certificado energético e outras), mais as rendas líquidas recebidas, menos o custo global do imóvel (preço, custos de compra e obras). Nos que ainda tem, valorização (valor de hoje menos tudo o que pagou na aquisição) mais, nos imóveis arrendados, as
        rendas recebidas. Nos imóveis, o que pagou inclui o preço, os impostos e custos de compra e as obras feitas, e o valor de hoje é a última
        avaliação que registou (ou o preço, se ainda não avaliou). As rendas contam a renda do contrato registada nos dados do imóvel, somada em cada dia 8 desde o início
        do contrato, ou o valor exato que indicar nos dados do imóvel (não se descontam condomínio, seguros, manutenção, gestão, IMI nem IRS das rendas). Nos ETF, o que pagou é o custo das unidades que tem, com as
        comissões, e o valor de hoje usa a cotação que indicou na carteira de ETF. Também não desconta o IRS que pagaria se vendesse hoje, nem os juros do crédito.
      </Aviso>
    </Ecra>
  );
}

function Seccao({
  titulo,
  grupo,
  vazio,
  onAbrir,
  rotuloAbrir,
  comRendas,
}: {
  titulo: string;
  grupo: Grupo;
  vazio: string;
  onAbrir: () => void;
  rotuloAbrir: string;
  comRendas?: boolean;
}) {
  return (
    <>
      <h2>{titulo}</h2>
      {grupo.ativos.length === 0 ? (
        <p className="suave">{vazio}</p>
      ) : (
        <div className="cartao">
          <div className="lucro-cabecalho">
            <span>
              Lucro líquido: <Lucro valor={grupo.lucro} percentagem={grupo.lucroPct} />
            </span>
            <span className="suave">
              Valor de hoje {euros(grupo.valorAtual)} · pagou {euros(grupo.custo)}
            </span>
          </div>
          <ContagemSubidas ativos={grupo.ativos} />
          {comRendas && (
            <div className="linhas-valor">
              <p>
                <span className="rotulo-verde">Valorização numa possível venda:</span>{" "}
                <strong style={{ color: corLucro(grupo.valorizacao) }}>
                  {sinal(grupo.valorizacao)}
                  {euros(grupo.valorizacao)}
                </strong>
              </p>
              <p>
                <span className="rotulo-verde">Rendas líquidas recebidas:</span>{" "}
                <strong style={{ color: corLucro(grupo.rendas) }}>
                  {sinal(grupo.rendas)}
                  {euros(grupo.rendas)}
                </strong>
              </p>
            </div>
          )}
          {grupo.incompletos > 0 && (
            <Aviso tipo="atencao">
              {grupo.incompletos === 1 ? "1 ativo fica" : `${grupo.incompletos} ativos ficam`} fora das somas por faltarem dados (ver abaixo).
            </Aviso>
          )}
          <div className="tabela-rolavel">
            <table className="tabela-carteira">
              <thead>
                <tr>
                  <th>{titulo === "ETF" ? "ETF" : "Imóvel"}</th>
                  <th>Desde</th>
                  <th className="num">Pagou</th>
                  <th className="num">Valor hoje</th>
                  {comRendas && <th className="num">Valorização</th>}
                  {comRendas && <th className="num">Rendas líquidas</th>}
                  <th className="num">Lucro líquido</th>
                </tr>
              </thead>
              <tbody>
                {grupo.ativos.map((a) => (
                  <Linha key={a.id} a={a} comRendas={comRendas} />
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="botao botao-secundario" onClick={onAbrir}>
            {rotuloAbrir}
          </button>
        </div>
      )}
    </>
  );
}

/** "2 a valorizar · 1 a desvalorizar": o total soma as subidas e as descidas. */
function ContagemSubidas({ ativos }: { ativos: Ativo[] }) {
  const sobem = ativos.filter((a) => a.lucro !== null && a.lucro > 0).length;
  const descem = ativos.filter((a) => a.lucro !== null && a.lucro < 0).length;
  if (sobem + descem < 2) return null;
  return (
    <p className="suave">
      <strong style={{ color: "var(--sucesso)" }}>▲ {sobem} a valorizar</strong> · <strong style={{ color: "var(--erro)" }}>▼ {descem} a desvalorizar</strong>. O
      lucro líquido acima já soma as subidas e desconta as descidas.
    </p>
  );
}

function Linha({ a, comRendas }: { a: Ativo; comRendas?: boolean }) {
  return (
    <tr>
      <td>
        <strong>{a.nome}</strong>
        <div className="suave">{a.detalhe}</div>
      </td>
      <td>{a.desde ? data(a.desde) : <span className="suave">—</span>}</td>
      <td className="num">{a.custo !== null ? euros(a.custo) : "—"}</td>
      <td className="num">{a.valorAtual !== null ? euros(a.valorAtual) : "—"}</td>
      {comRendas && (
        <td className="num" style={{ color: a.valorizacao !== null ? corLucro(a.valorizacao) : undefined }}>
          {a.valorizacao !== null ? `${sinal(a.valorizacao)}${euros(a.valorizacao)}` : "—"}
        </td>
      )}
      {comRendas && (
        <td className="num">
          {a.rendas !== null ? (
            <>
              <span style={{ color: corLucro(a.rendas) }}>
                {sinal(a.rendas)}
                {euros(a.rendas)}
              </span>
              <div className="suave">{a.rendasNota}</div>
            </>
          ) : (
            <span className="suave">—</span>
          )}
        </td>
      )}
      <td className="num">{a.lucro !== null ? <Lucro valor={a.lucro} percentagem={a.lucroPct} /> : <span className="suave">{a.falta}</span>}</td>
    </tr>
  );
}

/** Tudo o que aconteceu na carteira: compras, avaliações, arrendamentos, vendas e movimentos de ETF. */
function HistoricoLista({ lista }: { lista: Acontecimento[] }) {
  if (lista.length === 0) return <p className="suave">Ainda não há nada no histórico. Surge aqui a compra, as avaliações e as vendas de cada imóvel, e os movimentos de ETF.</p>;
  return (
    <div className="cartao tabela-rolavel">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>O quê</th>
            <th className="num">Valor</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((a, k) => (
            <tr key={k}>
              <td style={{ whiteSpace: "nowrap" }}>{data(a.data)}</td>
              <td>
                <strong>{a.ativo}</strong>
                <div className="suave">
                  {a.area} · {a.descricao}
                </div>
              </td>
              <td className="num" style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                {a.valor !== null ? euros(a.valor) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/** Imóveis vendidos: já não contam como ativos, mas o lucro realizado soma ao resultado. */
function VendidosSeccao({ vendidos }: { vendidos: GrupoVendidos }) {
  return (
    <>
      <h2>Imóveis vendidos</h2>
      <div className="cartao">
        {vendidos.ativos.length > 0 && (
          <>
            <div className="lucro-cabecalho">
              <span>
                Lucro realizado: <Lucro valor={vendidos.lucro} percentagem={vendidos.custo > 0 ? Math.round((vendidos.lucro / vendidos.custo) * 10000) / 100 : null} />
              </span>
              <span className="suave">Pagou {euros(vendidos.custo)}</span>
            </div>
            <div className="tabela-rolavel">
              <table className="tabela-carteira">
                <thead>
                  <tr>
                    <th>Imóvel</th>
                    <th>Vendido a</th>
                    <th className="num">Custo global</th>
                    <th className="num">Lucro realizado</th>
                  </tr>
                </thead>
                <tbody>
                  {vendidos.ativos.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.nome}</strong>
                      </td>
                      <td>{data(v.dataVenda)}</td>
                      <td className="num">{euros(v.custo)}</td>
                      <td className="num">
                        <Lucro valor={v.lucro} percentagem={v.lucroPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {vendidos.incompletos.length > 0 && (
          <Aviso tipo="atencao">Ficam fora das somas por faltarem dados da venda (valor, data de venda ou data de compra): {vendidos.incompletos.join(", ")}.</Aviso>
        )}
      </div>
    </>
  );
}
