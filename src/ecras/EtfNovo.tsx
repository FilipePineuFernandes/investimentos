// «Novo ETF»: pesquisa nos ETF negociados na Xetra (lista oficial da Deutsche Börse, publicada com
// a app) pelo índice, região, setor, código ou ISIN. Ao tocar num ETF abre-se a ficha com o que se
// sabe dele; a pessoa confirma os dados na ficha do emitente e acrescenta-o ao catálogo ou descarta-o.

import { Fragment, useEffect, useMemo, useState } from "react";
import { Aviso, Campo, Ecra } from "../componentes/ui";
import { Janela } from "../componentes/Janela";
import {
  classificar,
  fichaJustEtf,
  NOMES_TIPO_XETRA,
  paraCatalogo,
  pesquisar,
  type EtfXetra,
  type FiltrosPesquisa,
  type ListaXetra,
  type TipoXetra,
} from "../calculo/pesquisaEtf";
import { listarETF, NOMES_POLITICA, NOMES_REGIAO, NOMES_SETOR, type ETF, type Politica, type RegiaoETF, type SetorETF } from "../dados/etf";

/** Resultados mostrados de cada vez (a lista tem perto de 3000 ETF). */
const POR_PAGINA = 40;
const data = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT") : "—");

let lista: Promise<ListaXetra> | null = null;
/** Os filtros ficam enquanto a app está aberta: ao voltar da ficha do catálogo, a pesquisa continua igual. */
let ultimosFiltros: FiltrosPesquisa = { texto: "", regiao: "todas", setor: "todos", tipo: "todos", politica: "todas" };
const carregarLista = () => (lista ??= fetch(`${import.meta.env.BASE_URL}dados/xetra-etf.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))));

export function EtfNovo({ chave, voltar, onAcrescentar }: { chave: CryptoKey; voltar: () => void; onAcrescentar: (inicial: Partial<ETF>) => void }) {
  const [dados, setDados] = useState<{ etf: EtfXetra[]; atualizado: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [noCatalogo, setNoCatalogo] = useState<Set<string>>(new Set());
  const [filtros, setFiltros] = useState<FiltrosPesquisa>(ultimosFiltros);
  const [aberto, setAberto] = useState<string | null>(null);
  const [descartados, setDescartados] = useState<Set<string>>(new Set());
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  useEffect(() => {
    carregarLista()
      .then((l) => setDados({ etf: l.etf.map(classificar), atualizado: l.atualizado }))
      .catch(() => setErro("Não foi possível carregar a lista dos ETF da Xetra. Verifique a internet e volte a abrir este ecrã."));
    listarETF(chave).then((l) => setNoCatalogo(new Set(l.map((e) => e.isin))));
  }, [chave]);

  const resultados = useMemo(() => (dados ? pesquisar(dados.etf, filtros).filter((e) => !descartados.has(e.isin)) : []), [dados, filtros, descartados]);
  const muda = <K extends keyof FiltrosPesquisa>(k: K, v: FiltrosPesquisa[K]) => {
    ultimosFiltros = { ...filtros, [k]: v };
    setFiltros(ultimosFiltros);
    setMostrar(POR_PAGINA);
    setAberto(null);
  };
  const fichaAberta = dados?.etf.find((e) => e.isin === aberto) ?? null;
  const semFiltros = !filtros.texto.trim() && filtros.regiao === "todas" && filtros.setor === "todos" && filtros.tipo === "todos" && filtros.politica === "todas";
  /** Com a política escolhida: quantos ETF cumprem o resto mas o nome não diz se acumulam ou distribuem. */
  const semPolitica = useMemo(
    () => (dados && filtros.politica !== "todas" ? pesquisar(dados.etf, { ...filtros, politica: "todas" }).filter((e) => e.politica === null && !descartados.has(e.isin)).length : 0),
    [dados, filtros, descartados],
  );

  return (
    <Ecra titulo="Novo ETF" voltar={voltar}>
      <p className="suave">
        Procure ETF negociados na Xetra, em euros, para acrescentar ao seu catálogo. A lista vem da Deutsche Börse
        {dados?.atualizado && ` (atualizada a ${data(dados.atualizado)})`}.
      </p>

      <h2>1. O que procura</h2>
      <div className="cartao grelha">
        <Campo rotulo="Índice, nome, código ou ISIN" ajuda="Por exemplo «MSCI World», «S&P 500», «Nasdaq» ou «EUNL».">
          {(id) => <input id={id} type="search" value={filtros.texto} onChange={(e) => muda("texto", e.target.value)} placeholder="MSCI World" autoCorrect="off" spellCheck={false} />}
        </Campo>
        <Campo rotulo="Região">
          {(id) => (
            <select id={id} value={filtros.regiao} onChange={(e) => muda("regiao", e.target.value as RegiaoETF | "todas")}>
              <option value="todas">Todas</option>
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
            <select id={id} value={filtros.setor} onChange={(e) => muda("setor", e.target.value as SetorETF | "todos")}>
              <option value="todos">Todos</option>
              {(Object.keys(NOMES_SETOR) as SetorETF[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_SETOR[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Acumulação ou distribuição" ajuda="Acumulação: os dividendos ficam no fundo. Distribuição: são pagos (e tributados) todos os anos.">
          {(id) => (
            <select id={id} value={filtros.politica} onChange={(e) => muda("politica", e.target.value as Politica | "todas")}>
              <option value="todas">Todas</option>
              {(Object.keys(NOMES_POLITICA) as Politica[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_POLITICA[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Tipo de ETF">
          {(id) => (
            <select id={id} value={filtros.tipo} onChange={(e) => muda("tipo", e.target.value as TipoXetra | "todos")}>
              <option value="todos">Todos</option>
              {(Object.keys(NOMES_TIPO_XETRA) as TipoXetra[]).map((k) => (
                <option key={k} value={k}>
                  {NOMES_TIPO_XETRA[k]}
                </option>
              ))}
            </select>
          )}
        </Campo>
      </div>
      <small className="ajuda">
        A região, o setor e a política são deduzidos do nome abreviado que a Xetra usa: alguns ETF podem ficar de fora ou na região «Outra». Se não encontrar um ETF, procure pelo código
        ou pelo ISIN.
      </small>

      <h2>2. Resultados</h2>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!dados && !erro && <p className="suave">A carregar a lista da Xetra…</p>}
      {dados && semFiltros && <Aviso>Escolha uma região, um setor ou escreva o índice, o nome, o código ou o ISIN.</Aviso>}
      {dados && !semFiltros && resultados.length === 0 && <Aviso>Nenhum ETF da Xetra cumpre tudo o que escolheu. Experimente tirar algum filtro ou escrever menos palavras.</Aviso>}

      {semPolitica > 0 && (
        <Aviso>
          {semPolitica} {semPolitica === 1 ? "ETF cumpre" : "ETF cumprem"} o resto da pesquisa, mas o nome na Xetra não diz se acumula ou distribui. Escolha «Todas» para os ver e
          confirme na ficha do ETF.
        </Aviso>
      )}
      {resultados.length > 0 && (
        <div className="cartao tabela-rolavel">
          <p className="suave" style={{ margin: 0 }}>
            {resultados.length} {resultados.length === 1 ? "ETF encontrado" : "ETF encontrados"}. Toque num para ver os dados.
          </p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome na Xetra</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resultados.slice(0, mostrar).map((e) => {
                const abrir = () => setAberto(e.isin);
                return (
                  <Fragment key={e.isin}>
                    <tr
                      className="linha-movimento"
                      onClick={abrir}
                      onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), abrir())}
                      tabIndex={0}
                      aria-haspopup="dialog"
                    >
                      <td>
                        <strong>{e.codigo}</strong>
                      </td>
                      <td>
                        {e.nomeXetra}
                        {noCatalogo.has(e.isin) && <div className="suave">✓ Já está no catálogo</div>}
                      </td>
                      <td className="seta-grupo" aria-hidden="true">
                        ›
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {resultados.length > mostrar && (
            <button type="button" className="botao botao-secundario" onClick={() => setMostrar(mostrar + POR_PAGINA)}>
              Mostrar mais ({resultados.length - mostrar})
            </button>
          )}
        </div>
      )}
      {fichaAberta && (
        <Janela titulo={fichaAberta.codigo} onFechar={() => setAberto(null)}>
          <FichaXetra
            e={fichaAberta}
            jaNoCatalogo={noCatalogo.has(fichaAberta.isin)}
            onAcrescentar={() => onAcrescentar(paraCatalogo(fichaAberta))}
            onDescartar={() => {
              setDescartados(new Set([...descartados, fichaAberta.isin]));
              setAberto(null);
            }}
          />
        </Janela>
      )}
    </Ecra>
  );
}

function FichaXetra({ e, jaNoCatalogo, onAcrescentar, onDescartar }: { e: EtfXetra; jaNoCatalogo: boolean; onAcrescentar: () => void; onDescartar: () => void }) {
  return (
    <div className="cartao">
      <dl className="lista">
        <dt>ISIN</dt>
        <dd>{e.isin}</dd>
        <dt>Código Xetra</dt>
        <dd>{e.codigo}</dd>
        <dt>Nome na Xetra</dt>
        <dd>{e.nomeXetra}</dd>
        <dt>Tipo</dt>
        <dd>{NOMES_TIPO_XETRA[e.tipo]}</dd>
        <dt>Emitente</dt>
        <dd>{e.emitente || "—"}</dd>
        <dt>Domicílio</dt>
        <dd>{e.domicilio}</dd>
        <dt>Política</dt>
        <dd>{e.politica ? NOMES_POLITICA[e.politica] : "Por confirmar (o nome não o diz)"}</dd>
        <dt>Região</dt>
        <dd>{NOMES_REGIAO[e.regiao]}</dd>
        <dt>Setor</dt>
        <dd>{NOMES_SETOR[e.setor]}</dd>
        <dt>Na Xetra desde</dt>
        <dd>{data(e.desde)}</dd>
      </dl>
      <small className="ajuda">
        O emitente, a política, a região e o setor são deduzidos do nome. O TER, o índice e a dimensão do fundo não vêm na lista da Xetra: veja-os na ficha do ETF e
        confirme tudo antes de guardar.
      </small>
      <a className="botao botao-secundario" href={fichaJustEtf(e.isin)} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", textDecoration: "none" }}>
        Ver a ficha do ETF (TER, índice, dimensão)
      </a>
      {jaNoCatalogo ? (
        <Aviso tipo="sucesso">Este ETF já está no seu catálogo.</Aviso>
      ) : (
        <div className="acoes">
          <button type="button" className="botao" onClick={onAcrescentar}>
            Acrescentar ao catálogo
          </button>
          <button type="button" className="botao botao-secundario" onClick={onDescartar}>
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}
