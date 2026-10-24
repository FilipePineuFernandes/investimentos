// Carteira global: imóveis em posse (incluindo os arrendados) e ETF em posse, com o lucro
// líquido desde a aquisição até hoje, separado entre imobiliário e ETF.

import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { diaISO } from "../calculo/carteira";
import { posicaoEtf } from "../calculo/carteiraEtf";
import { analisarImovel } from "../calculo/imovel";
import { grupoEtf, grupoImobiliario, totalCarteira, type Ativo, type Grupo } from "../calculo/patrimonio";
import { listarETF } from "../dados/etf";
import { listarImoveis } from "../dados/imoveis";
import { listarCotacoes, listarMovimentos } from "../dados/movimentosEtf";
import { lerPerfil } from "../dados/perfil";
import { euros } from "../util/numeros";
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
  return {
    imobiliario: grupoImobiliario(
      imoveis.map((i) => ({ i, a: analisarImovel(i, perfil) })),
      hoje,
      perfil,
    ),
    etf: grupoEtf(posicoes, movimentos, nomes),
  };
}

export function CarteiraGlobal({ chave, voltar, onImoveis, onEtf }: { chave: CryptoKey; voltar: () => void; onImoveis: () => void; onEtf: () => void }) {
  const [dados, setDados] = useState<DadosCarteiraGlobal | null>(null);

  useEffect(() => {
    carregarCarteiraGlobal(chave).then(setDados);
  }, [chave]);

  if (!dados) return <Ecra titulo="Carteira global" voltar={voltar}>A carregar…</Ecra>;

  const { imobiliario, etf } = dados;
  const total = totalCarteira(imobiliario, etf);
  const vazia = imobiliario.ativos.length === 0 && etf.ativos.length === 0;

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
            <div className="suave">Lucro líquido total</div>
            <Lucro valor={total.lucro} percentagem={total.lucroPct} grande />
            <div className="suave">
              Valor de hoje {euros(total.valorAtual)} · pagou {euros(total.custo)}
            </div>
            <div className="lucro-partes">
              <div>
                <div className="suave">Imobiliário</div>
                <Lucro valor={imobiliario.lucro} percentagem={imobiliario.lucroPct} />
              </div>
              <div>
                <div className="suave">ETF</div>
                <Lucro valor={etf.lucro} percentagem={etf.lucroPct} />
              </div>
            </div>
          </div>

          <Seccao titulo="Imobiliário" comRendas grupo={imobiliario} vazio="Não tem imóveis em carteira." onAbrir={onImoveis} rotuloAbrir="Abrir os imóveis" />
          <Seccao titulo="ETF" grupo={etf} vazio="Não tem ETF em carteira." onAbrir={onEtf} rotuloAbrir="Abrir a carteira de ETF" />
        </>
      )}

      <Aviso>
        <strong>Como se calcula o lucro líquido:</strong> valorização (valor de hoje menos tudo o que pagou na aquisição) mais, nos imóveis arrendados, as
        rendas líquidas recebidas. Nos imóveis, o que pagou inclui o preço, os impostos e custos de compra e as obras feitas, e o valor de hoje é a última
        avaliação que registou (ou o preço, se ainda não avaliou). As rendas líquidas são a renda do contrato menos condomínio, seguros, manutenção, gestão,
        IMI e IRS, desde o início do contrato, ou o valor exato que indicar na ficha do imóvel. Nos ETF, o que pagou é o custo das unidades que tem, com as
        comissões, e o valor de hoje usa a cotação que indicou na carteira de ETF. Não desconta o IRS que pagaria se vendesse hoje, nem os juros do crédito.
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
            <p className="suave">
              Valorização numa possível venda <strong style={{ color: corLucro(grupo.valorizacao) }}>{sinal(grupo.valorizacao)}{euros(grupo.valorizacao)}</strong> + rendas
              líquidas recebidas <strong style={{ color: corLucro(grupo.rendas) }}>{sinal(grupo.rendas)}{euros(grupo.rendas)}</strong>
            </p>
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
