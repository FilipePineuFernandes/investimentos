// Catálogo pessoal de ETF (ponto 6.2): lista e ficha de cada ETF.

import { useEffect, useState, type ReactNode } from "react";
import { Aviso, Campo, CampoNumero, Ecra } from "../componentes/ui";
import { diaISO } from "../calculo/carteira";
import { precisaRevisao, problemasETF } from "../calculo/etf";
import {
  apagarETF,
  BOLSA,
  guardarETF,
  listarETF,
  MESES_REVISAO,
  NOME_BOLSA,
  NOMES_POLITICA,
  NOMES_REGIAO,
  NOMES_REPLICACAO,
  NOMES_SETOR,
  novoETF,
  type ETF,
} from "../dados/etf";

const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");

export function EtfCatalogo({ chave, voltar, onAbrir }: { chave: CryptoKey; voltar: () => void; onAbrir: (isin: string | null) => void }) {
  const [lista, setLista] = useState<ETF[] | null>(null);
  const hoje = diaISO(new Date());

  useEffect(() => {
    listarETF(chave).then(setLista);
  }, [chave]);

  return (
    <Ecra titulo="Catálogo de ETF" voltar={voltar}>
      <p>
        O seu catálogo pessoal. Os dados vêm da ficha do ETF e do KID publicados pelo emitente (iShares, Vanguard, Xtrackers, Amundi…). A app lembra-o de os
        rever a cada {MESES_REVISAO} meses. Só entram ETF negociados na {NOME_BOLSA}, em euros, com o código dessa bolsa.
      </p>
      <button className="botao" onClick={() => onAbrir(null)}>
        Acrescentar ETF
      </button>
      {lista === null && <p className="suave">A carregar…</p>}
      {lista?.length === 0 && <Aviso>O catálogo está vazio. Acrescente os ETF que lhe interessam: são eles que aparecem nas propostas da simulação.</Aviso>}
      {lista?.map((e) => (
        <button key={e.isin} className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onAbrir(e.isin)}>
          <h3>{e.nome}</h3>
          <p className="suave">
            <strong>{e.ticker || "sem código"}</strong> · {e.isin} · {NOMES_REGIAO[e.regiao]} · {NOMES_SETOR[e.setor]} · TER {e.ter?.toLocaleString("pt-PT")}% ·{" "}
            {NOMES_POLITICA[e.politica]}
          </p>
          {problemasETF(e).length > 0 && <Aviso tipo="atencao">Incompleto: não entra nas propostas. Abra-o para ver o que falta.</Aviso>}
          {precisaRevisao(e, hoje) && <Aviso tipo="atencao">Dados verificados a {data(e.atualizadoEm)}: convém revê-los.</Aviso>}
        </button>
      ))}
    </Ecra>
  );
}

export function EtfFicha({ chave, isin, voltar }: { chave: CryptoKey; isin: string | null; voltar: () => void }) {
  const [e, setE] = useState<ETF | null>(null);
  const [existentes, setExistentes] = useState<string[]>([]);
  const [tentou, setTentou] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const hoje = diaISO(new Date());

  useEffect(() => {
    listarETF(chave).then((l) => {
      setExistentes(l.map((x) => x.isin));
      const existente = l.find((x) => x.isin === isin);
      // ETF guardados antes da regra "só Xetra, em euros" passam para a Xetra ao serem abertos.
      setE(existente ? { ...existente, bolsa: BOLSA, moedaNegociacao: "EUR" } : novoETF(hoje));
    });
  }, [chave, isin, hoje]);

  if (!e) return <Ecra titulo="ETF">A carregar…</Ecra>;

  const muda = <K extends keyof ETF>(k: K, v: ETF[K]) => setE({ ...e, [k]: v });
  const problemas = problemasETF(e);
  const duplicado = isin === null && existentes.includes(e.isin);

  async function guardar() {
    setTentou(true);
    if (problemas.length > 0 || duplicado) return;
    setAGuardar(true);
    await guardarETF(chave, e!);
    setAGuardar(false);
    voltar();
  }

  async function apagar() {
    if (!window.confirm(`Retirar "${e!.nome}" do catálogo?`)) return;
    await apagarETF(e!.isin);
    voltar();
  }

  return (
    <Ecra titulo={e.nome || "Novo ETF"} voltar={voltar}>
      <form
        onSubmit={(x) => {
          x.preventDefault();
          guardar();
        }}
        style={{ display: "contents" }}
      >
        <h2>Identificação</h2>
        <div className="cartao grelha">
          <Campo rotulo="ISIN" ajuda={isin ? "O ISIN não se pode alterar. Para outro ETF, acrescente-o de novo." : "12 caracteres, por exemplo IE00B4L5Y983."}>
            {(id) => <input id={id} value={e.isin} readOnly={isin !== null} onChange={(x) => muda("isin", x.target.value.toUpperCase().replace(/\s/g, ""))} />}
          </Campo>
          <Campo rotulo="Código na Xetra" ajuda="O código que aparece na corretora, por exemplo EUNL ou VWCE.">
            {(id) => <input id={id} value={e.ticker} autoCapitalize="characters" onChange={(x) => muda("ticker", x.target.value.toUpperCase().replace(/\s/g, ""))} />}
          </Campo>
          <Texto rotulo="Nome" valor={e.nome} onChange={(v) => muda("nome", v)} />
          <Texto rotulo="Emitente" valor={e.emitente} onChange={(v) => muda("emitente", v)} ajuda="iShares, Vanguard, Xtrackers, Amundi…" />
          <Texto rotulo="Índice replicado" valor={e.indice} onChange={(v) => muda("indice", v)} ajuda="Por exemplo MSCI World ou S&P 500." />
          <Escolha rotulo="Região" valor={e.regiao} opcoes={NOMES_REGIAO} onChange={(v) => muda("regiao", v)} />
          <Escolha rotulo="Setor" valor={e.setor} opcoes={NOMES_SETOR} onChange={(v) => muda("setor", v)} />
        </div>

        <Aviso>
          Bolsa: <strong>{NOME_BOLSA}</strong>, em <strong>euros</strong>. A app usa só esta bolsa para a carteira ficar toda na mesma moeda, sem custos de câmbio.
          Na corretora, escolha a Xetra (ou XETRA/GER) ao comprar.
        </Aviso>

        <h2>Custos e características</h2>
        <div className="cartao grelha">
          <CampoNumero rotulo="TER (custo anual)" sufixo="%" valor={e.ter} onChange={(v) => muda("ter", v)} ajuda="Na ficha do ETF, como «TER» ou «custos correntes»." />
          <CampoNumero rotulo="Tracking difference" sufixo="%" valor={e.trackingDifference} onChange={(v) => muda("trackingDifference", v)} ajuda="Do relatório anual. Opcional." />
          <Texto rotulo="Período da tracking difference" valor={e.trackingPeriodo} onChange={(v) => muda("trackingPeriodo", v)} ajuda="Por exemplo 2025." />
          <Escolha rotulo="Política de rendimentos" valor={e.politica} opcoes={NOMES_POLITICA} onChange={(v) => muda("politica", v)} />
          {e.politica === "distribuicao" && (
            <CampoNumero
              rotulo="Rendimento em dividendos"
              sufixo="%/ano"
              valor={e.dividendosPct}
              onChange={(v) => muda("dividendosPct", v)}
              ajuda="Os dividendos pagam IRS todos os anos, o que reduz a projeção."
            />
          )}
          <Texto rotulo="Domicílio (país)" valor={e.domicilio} onChange={(v) => muda("domicilio", v.toUpperCase())} ajuda="Código do país: IE (Irlanda), LU (Luxemburgo)…" />
          <CampoNumero rotulo="Dimensão do fundo" sufixo="M€" valor={e.dimensao} onChange={(v) => muda("dimensao", v)} />
          <Texto rotulo="Moeda do fundo" valor={e.moedaFundo} onChange={(v) => muda("moedaFundo", v.toUpperCase())} />
          <Escolha rotulo="Replicação" valor={e.replicacao} opcoes={NOMES_REPLICACAO} onChange={(v) => muda("replicacao", v)} />
          <Campo rotulo="Data de lançamento" ajuda="Na ficha do ETF, como «inception date». Opcional.">
            {(id) => <input id={id} type="date" value={e.dataLancamento} onChange={(x) => muda("dataLancamento", x.target.value)} />}
          </Campo>
          <CampoNumero rotulo="Número de posições" valor={e.numeroPosicoes} onChange={(v) => muda("numeroPosicoes", v)} ajuda="Quantas empresas ou títulos o fundo detém («holdings»). Opcional." />
        </div>

        <h2>Fonte</h2>
        <div className="cartao">
          <label className="caixa">
            <input type="checkbox" checked={e.kid} onChange={(x) => muda("kid", x.target.checked)} />
            <span>Confirmei que este ETF tem KID para investidores particulares na UE</span>
          </label>
          <div className="grelha">
            <Texto rotulo="Fonte dos dados" valor={e.fonte} onChange={(v) => muda("fonte", v)} ajuda="Por exemplo: ficha do emitente de setembro de 2026." />
            <Campo rotulo="Dados verificados a">{(id) => <input id={id} type="date" value={e.atualizadoEm} onChange={(x) => muda("atualizadoEm", x.target.value)} />}</Campo>
          </div>
        </div>

        {tentou && (problemas.length > 0 || duplicado) && (
          <Aviso tipo="erro" titulo="Não foi possível guardar">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {duplicado && <li>Este ISIN já está no catálogo.</li>}
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Aviso>
        )}
        <div className="acoes">
          <button className="botao" type="submit" disabled={aGuardar}>
            {aGuardar ? "A guardar…" : "Guardar"}
          </button>
          {isin && (
            <button type="button" className="botao botao-secundario" onClick={apagar}>
              Retirar do catálogo
            </button>
          )}
        </div>
      </form>
    </Ecra>
  );
}

function Texto({ rotulo, valor, onChange, ajuda }: { rotulo: string; valor: string; onChange: (v: string) => void; ajuda?: ReactNode }) {
  return <Campo rotulo={rotulo} ajuda={ajuda}>{(id) => <input id={id} value={valor} onChange={(e) => onChange(e.target.value)} />}</Campo>;
}

function Escolha<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <Campo rotulo={rotulo}>
      {(id) => (
        <select id={id} value={valor} onChange={(e) => onChange(e.target.value as T)}>
          {(Object.entries(opcoes) as [T, string][]).map(([k, nome]) => (
            <option key={k} value={k}>
              {nome}
            </option>
          ))}
        </select>
      )}
    </Campo>
  );
}
