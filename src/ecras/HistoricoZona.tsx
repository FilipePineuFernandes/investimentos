// Histórico da carteira, fácil de percorrer:
// - no topo, uma barra por mês (últimos 12 meses) com o que investiu; ao carregar abre o mês;
// - por baixo, os dias, do mais recente para o mais antigo, cada um com linhas curtas; ao carregar abre o dia;
// - «Filtrar» escolhe as áreas e os tipos; «Exportar Excel» descarrega o que aconteceu entre duas datas.

import { useState } from "react";
import { Janela } from "../componentes/Janela";
import { diaISO } from "../calculo/carteira";
import {
  AREAS_HISTORICO,
  NOMES_TIPO_ACONTECIMENTO,
  agruparPorDia,
  entreDatas,
  filtrarHistorico,
  resumoPorMes,
  type Acontecimento,
  type AreaHistorico,
  type Dia,
  type FiltroHistorico,
  type Mes,
  type TipoAcontecimento,
} from "../calculo/historico";
import { descarregar } from "../dados/copias";
import { TIPO_XLSX, livroHistorico, nomeFicheiroHistorico } from "../dados/exportarHistorico";
import { euros } from "../util/numeros";

const TIPOS = Object.keys(NOMES_TIPO_ACONTECIMENTO) as TipoAcontecimento[];
const DIAS_POR_PAGINA = 20;
const dataPT = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
const diaLongo = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
const mesCurto = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("pt-PT", { month: "short" }).replace(".", "");
const mesLongo = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
const unidades = (q: number) => q.toLocaleString("pt-PT", { maximumFractionDigits: 4 });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O filtro fica enquanto a app está aberta. */
let filtroGuardado: FiltroHistorico = { areas: [...AREAS_HISTORICO], tipos: [...TIPOS] };

/** Linha curta: código (ou nome), o que foi feito e o valor. */
function Linha({ a }: { a: Acontecimento }) {
  const verbo = { compra: "Compra", venda: "Venda", dividendo: "Dividendo", avaliacao: "Avaliação", arrendamento: "Arrendamento" }[a.tipo];
  return (
    <li className={`hist-linha hist-${a.tipo}`}>
      <span className="hist-ativo">{a.codigo || a.ativo}</span>
      <span className="hist-o-que suave">
        {verbo}
        {a.quantidade !== null && ` · ${unidades(a.quantidade)} un.`}
      </span>
      <span className="hist-valor">{a.valor !== null ? euros(a.valor) : "—"}</span>
    </li>
  );
}

/** Totais de um dia ou de um mês. */
function Totais({ s }: { s: { investido: number; recebido: number; quantos: number } }) {
  return (
    <span className="hist-totais">
      {plural(s.quantos, "registo", "registos")}
      {s.investido > 0 && <> · investiu {euros(s.investido)}</>}
      {s.recebido > 0 && <> · recebeu {euros(s.recebido)}</>}
    </span>
  );
}

/** Tudo o que aconteceu num dia ou num mês, com o nome completo e a descrição. */
function Detalhe({ itens }: { itens: Acontecimento[] }) {
  return (
    <div className="cartao tabela-rolavel">
      <table>
        <thead>
          <tr>
            <th>O quê</th>
            <th className="num">Valor</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((a, k) => (
            <tr key={k} className={`hist-${a.tipo}`}>
              <td>
                <strong>{a.ativo}</strong>
                <div className="suave">
                  {dataPT(a.data)} · {a.area}
                  {a.codigo && a.codigo !== a.ativo && ` · ${a.codigo}`} · {a.descricao}
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

export function HistoricoZona({ lista }: { lista: Acontecimento[] }) {
  const hoje = diaISO(new Date());
  const [filtro, setFiltroEstado] = useState<FiltroHistorico>(filtroGuardado);
  const setFiltro = (f: FiltroHistorico) => {
    filtroGuardado = f;
    setFiltroEstado(f);
  };
  const [paginas, setPaginas] = useState(1);
  const [mesAberto, setMesAberto] = useState<Mes | null>(null);
  const [diaAberto, setDiaAberto] = useState<Dia | null>(null);
  const [verFiltro, setVerFiltro] = useState(false);
  const [verExportar, setVerExportar] = useState(false);

  if (lista.length === 0) return <p className="suave">Ainda não há nada no histórico. Surge aqui a compra, as avaliações e as vendas de cada imóvel, e os movimentos de ETF e de cripto.</p>;

  const filtrada = filtrarHistorico(lista, filtro);
  const meses = resumoPorMes(filtrada, hoje);
  const maior = Math.max(...meses.map((m) => m.investido), 1);
  const dias = agruparPorDia(filtrada);
  const visiveis = dias.slice(0, paginas * DIAS_POR_PAGINA);
  const tudo = filtro.areas.length === AREAS_HISTORICO.length && filtro.tipos.length === TIPOS.length;
  const ultimos12 = meses.reduce((s, m) => s + m.investido, 0);

  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <>
      <div className="cartao">
        <h3 style={{ margin: 0 }}>Investido por mês</h3>
        <p className="suave" style={{ margin: 0 }}>
          Últimos 12 meses: {euros(ultimos12)}. Carregue num mês para ver o que fez.
        </p>
        <div className="hist-meses" role="group" aria-label="Meses">
          {meses.map((m) => (
            <button
              key={m.mes}
              type="button"
              className="hist-mes"
              disabled={m.quantos === 0}
              aria-haspopup="dialog"
              aria-label={`${mesLongo(m.mes)}: ${m.quantos} registos, investiu ${euros(m.investido)}`}
              title={`${mesLongo(m.mes)} · ${euros(m.investido)}`}
              onClick={() => setMesAberto(m)}
            >
              <span className="hist-barra-zona">
                <span className="hist-barra" style={{ height: `${m.investido > 0 ? Math.max(4, (m.investido / maior) * 100) : 0}%` }} />
                {m.investido === 0 && m.quantos > 0 && <span className="hist-ponto" />}
              </span>
              <span className="hist-mes-nome">{mesCurto(m.mes)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="acoes">
        <button data-icone="filtrar" type="button" className="botao" aria-haspopup="dialog" onClick={() => setVerFiltro(true)}>
          Filtrar{!tudo && " (ativo)"}
        </button>
        <button data-icone="descarregar" type="button" className="botao" aria-haspopup="dialog" onClick={() => setVerExportar(true)}>
          Exportar Excel
        </button>
      </div>

      {dias.length === 0 ? (
        <p className="suave">Nada corresponde ao filtro escolhido.</p>
      ) : (
        <div className="hist-dias">
          {visiveis.map((d) => (
            <button key={d.data} type="button" className="cartao hist-dia" aria-haspopup="dialog" onClick={() => setDiaAberto(d)}>
              <span className="hist-dia-topo">
                <strong>{dataPT(d.data)}</strong>
                <Totais s={d} />
              </span>
              <ul className="hist-linhas">
                {d.itens.map((a, k) => (
                  <Linha key={k} a={a} />
                ))}
              </ul>
            </button>
          ))}
          {visiveis.length < dias.length && (
            <div className="acoes">
              <button data-icone="ver" type="button" className="botao" onClick={() => setPaginas(paginas + 1)}>
                Mostrar mais ({dias.length - visiveis.length} dias)
              </button>
            </div>
          )}
        </div>
      )}

      {mesAberto && (
        <Janela titulo={`Histórico · ${mesLongo(mesAberto.mes)}`} onFechar={() => setMesAberto(null)}>
          <p className="suave" style={{ margin: 0 }}>
            <Totais s={mesAberto} />
          </p>
          <Detalhe itens={mesAberto.itens} />
        </Janela>
      )}

      {diaAberto && (
        <Janela titulo={`Histórico · ${dataPT(diaAberto.data)}`} onFechar={() => setDiaAberto(null)}>
          <p className="suave" style={{ margin: 0 }}>
            {diaLongo(diaAberto.data)} · <Totais s={diaAberto} />
          </p>
          <Detalhe itens={diaAberto.itens} />
        </Janela>
      )}

      {verFiltro && (
        <Janela titulo="Filtrar o histórico" onFechar={() => setVerFiltro(false)}>
          <div className="cartao">
            <h3 style={{ margin: 0 }}>Áreas</h3>
            <div className="regimes" role="group" aria-label="Áreas">
              {AREAS_HISTORICO.map((a: AreaHistorico) => {
                const on = filtro.areas.includes(a);
                return (
                  <button key={a} type="button" className="botao" aria-pressed={on} onClick={() => setFiltro({ ...filtro, areas: alternar(filtro.areas, a) })}>
                    {a}
                  </button>
                );
              })}
            </div>
            <h3 style={{ margin: 0 }}>O que mostrar</h3>
            <div className="regimes regimes-4" role="group" aria-label="O que mostrar">
              {TIPOS.map((t) => {
                const on = filtro.tipos.includes(t);
                return (
                  <button key={t} type="button" className="botao" aria-pressed={on} onClick={() => setFiltro({ ...filtro, tipos: alternar(filtro.tipos, t) })}>
                    {NOMES_TIPO_ACONTECIMENTO[t]}
                  </button>
                );
              })}
            </div>
            <p className="suave" style={{ margin: 0 }}>
              {plural(filtrada.length, "registo corresponde", "registos correspondem")} ao filtro.
            </p>
          </div>
          <div className="acoes">
            <button data-icone="repor" type="button" className="botao" onClick={() => setFiltro({ areas: [...AREAS_HISTORICO], tipos: [...TIPOS] })}>
              Mostrar tudo
            </button>
            <button data-icone="guardar" type="button" className="botao" onClick={() => setVerFiltro(false)}>
              Ver o histórico
            </button>
          </div>
        </Janela>
      )}

      {verExportar && <Exportar lista={filtrada} hoje={hoje} filtrado={!tudo} onFechar={() => setVerExportar(false)} />}
    </>
  );
}

/** Escolher o período e descarregar o Excel. */
function Exportar({ lista, hoje, filtrado, onFechar }: { lista: Acontecimento[]; hoje: string; filtrado: boolean; onFechar: () => void }) {
  const primeira = lista.length > 0 ? lista[lista.length - 1].data : hoje;
  const [de, setDe] = useState(primeira);
  const [ate, setAte] = useState(hoje);
  const [erro, setErro] = useState("");
  const escolhidos = entreDatas(lista, de, ate);
  const invertido = de && ate && de > ate;

  async function exportar() {
    setErro("");
    try {
      await descarregar(nomeFicheiroHistorico(de, ate), livroHistorico(escolhidos), TIPO_XLSX, "Histórico da carteira");
    } catch {
      setErro("Não foi possível criar o ficheiro. Tente outra vez.");
    }
  }

  return (
    <Janela titulo="Exportar o histórico (Excel)" onFechar={onFechar}>
      <div className="cartao">
        <p style={{ margin: 0 }}>Escolha o período. O Excel tem uma linha por registo: data, área, ativo, código, descrição, unidades e valor.</p>
        <div className="regimes regimes-4">
          <div className="campo">
            <label htmlFor="hist-de">De</label>
            <input id="hist-de" type="date" value={de} max={hoje} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="hist-ate">Até</label>
            <input id="hist-ate" type="date" value={ate} max={hoje} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
        {invertido ? (
          <p className="erro" role="alert" style={{ margin: 0 }}>
            A data «De» tem de ser anterior à data «Até».
          </p>
        ) : (
          <p className="suave" style={{ margin: 0 }}>
            {plural(escolhidos.length, "registo", "registos")} neste período{filtrado && " (com o filtro escolhido)"}.
          </p>
        )}
        {erro && (
          <p className="erro" role="alert" style={{ margin: 0 }}>
            {erro}
          </p>
        )}
      </div>
      <div className="acoes">
        <button data-icone="fechar" type="button" className="botao" onClick={onFechar}>
          Cancelar
        </button>
        <button data-icone="descarregar" type="button" className="botao" disabled={!!invertido || escolhidos.length === 0} onClick={exportar}>
          Descarregar Excel
        </button>
      </div>
    </Janela>
  );
}
