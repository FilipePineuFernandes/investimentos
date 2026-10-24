// Comparáveis (ponto 5.3, nível 2): pesquisa nos portais com um toque, registo dos anúncios
// que interessam e comparação por tipologia, por portal e com o INE.

import { useState } from "react";
import { Aviso, Campo, CampoNumero } from "../componentes/ui";
import { comparar, type Estatistica } from "../calculo/comparaveis";
import { diaISO } from "../calculo/carteira";
import { valorRenda, valorVenda } from "../calculo/mercado";
import { distritoDe, linkPesquisa, NOMES_SEGMENTO, PORTAIS, portalDoLink, type Operacao, type Pesquisa, type Segmento } from "../calculo/portais";
import type { Comparavel, Imovel } from "../dados/imoveis";
import type { DadosIne } from "../dados/ine";
import { euros } from "../util/numeros";

const TIPOLOGIAS = ["T0", "T1", "T2", "T3", "T4", "T5+"];
const eurosInteiros = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nomePortal = (id: string | null) => PORTAIS.find((p) => p.id === id)?.nome ?? "Outro site";
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;

export function Comparaveis({ i, ine, onChange }: { i: Imovel; ine: DadosIne | null | undefined; onChange: (c: Comparavel[]) => void }) {
  const lista = i.comparaveis ?? [];
  const [operacao, setOperacao] = useState<Operacao>(i.destino === "arrendamento" || i.arrendamento ? "arrendamento" : "venda");
  const [margem, setMargem] = useState<number | null>(20);
  const [registar, setRegistar] = useState(false);

  const tipologia = i.destino === "comercial" ? null : i.tipologia;
  const valor = operacao === "venda" ? i.preco : (i.arrendamento?.rendaMensal ?? null);
  const m = (margem ?? 0) / 100;
  const pesquisa: Pesquisa = {
    operacao,
    tipologia,
    moradia: i.moradia ?? false,
    distrito: i.geoMunicipio ? distritoDe(i.geoMunicipio) : null,
    municipio: i.municipio || null,
    freguesia: i.freguesia || null,
    precoMin: valor && m ? valor * (1 - m) : null,
    precoMax: valor && m ? valor * (1 + m) : null,
    areaMin: i.area && m ? i.area * (1 - m) : null,
  };
  const portais = PORTAIS.filter((p) => p.operacoes.includes(operacao));
  const r = comparar(lista, operacao, tipologia, valor, i.area);
  const hoje = diaISO(new Date());
  const local = { municipio: i.geoMunicipio ?? null, freguesia: i.geoFreguesia ?? null };
  const ref = ine ? (operacao === "venda" ? valorVenda(ine, local, i.area, i.conservacao, hoje) : valorRenda(ine, local, i.area, hoje)) : null;
  const daOperacao = lista.filter((c) => c.operacao === operacao);

  return (
    <>
      <h2>Comparáveis nos portais</h2>
      <div className="acoes" role="group" aria-label="Operação">
        {(["venda", "arrendamento"] as const).map((o) => (
          <button
            key={o}
            type="button"
            className={`botao ${o === operacao ? "" : "botao-secundario"}`}
            style={{ flex: "1 1 120px" }}
            aria-pressed={o === operacao}
            onClick={() => setOperacao(o)}
          >
            {o === "venda" ? "Venda" : "Arrendamento"}
          </button>
        ))}
      </div>

      <div className="cartao">
        <h3>Procurar</h3>
        {!i.municipio ? (
          <Aviso>Escolha primeiro o município (e a freguesia) na identificação do imóvel.</Aviso>
        ) : (
          <>
            <p className="suave">
              {tipologia ?? "Imóveis"} {operacao === "venda" ? "para comprar" : "para arrendar"} em {[i.freguesia, i.municipio].filter(Boolean).join(", ")}
              {pesquisa.precoMin && pesquisa.precoMax
                ? `, entre ${eurosInteiros(pesquisa.precoMin)} e ${eurosInteiros(pesquisa.precoMax)}${operacao === "arrendamento" ? " por mês" : ""}`
                : ""}
              . Abre-se no portal, no navegador.
            </p>
            <div className="grelha">
              <CampoNumero
                rotulo="Margem de preço e área"
                sufixo="%"
                valor={margem}
                onChange={setMargem}
                ajuda={valor ? "À volta do seu valor. Só se aplica nos portais com pesquisa direta." : `Indique ${operacao === "venda" ? "o valor de compra" : "a renda na estratégia de arrendamento"} para filtrar por preço.`}
              />
            </div>
            <div className="lista-portais">
              {portais.map((p) => {
                const l = linkPesquisa(p, pesquisa);
                return (
                  <a key={p.id} className="portal" href={l.url} target="_blank" rel="noopener noreferrer">
                    <strong>{p.nome}</strong>
                    <span className="suave">
                      {l.direto ? "Pesquisa direta" : "Pesquisa no portal via Google"}
                      {p.segmento !== "mercado" && ` · ${NOMES_SEGMENTO[p.segmento]}`}
                    </span>
                    {p.nota && <span className="suave">{p.nota}</span>}
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>

      {registar ? (
        <NovoComparavel
          operacao={operacao}
          tipologia={tipologia ?? "T2"}
          onCancelar={() => setRegistar(false)}
          onGuardar={(c) => {
            onChange([...lista, c]);
            setRegistar(false);
          }}
        />
      ) : (
        <button type="button" className="botao botao-secundario" onClick={() => setRegistar(true)}>
          Registar um anúncio
        </button>
      )}

      {daOperacao.length > 0 && (
        <>
          <div className="cartao">
            <h3>
              Comparação: {tipologia ?? "todos"}, {operacao === "venda" ? "venda" : "arrendamento"}
            </h3>
            {r.mesmaTipologia ? (
              <dl className="lista">
                <dt>Anúncios</dt>
                <dd>{r.mesmaTipologia.n}</dd>
                <dt>Preço pedido</dt>
                <dd>
                  <Intervalo e={r.mesmaTipologia} />
                </dd>
                <dt>Por m²</dt>
                <dd>{r.mesmaTipologia.m2 ? <IntervaloM2 m2={r.mesmaTipologia.m2} /> : "Sem área nos anúncios"}</dd>
                {r.posicao !== null && (
                  <>
                    <dt>O seu imóvel</dt>
                    <dd>
                      <strong>{pct(r.posicao)}</strong> face à mediana por m² dos anúncios
                    </dd>
                  </>
                )}
                {ref && r.mesmaTipologia.m2 && (
                  <>
                    <dt>INE</dt>
                    <dd>
                      {euros(ref.m2)}/m² · os anúncios estão {pct(Math.round(((r.mesmaTipologia.m2.mediana - ref.m2) / ref.m2) * 1000) / 10)}
                      <div className="suave">Os anúncios são preços pedidos; o INE são valores de {operacao === "venda" ? "venda" : "contratos"} reais. É normal haver diferença.</div>
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="suave">Ainda não há anúncios de mercado {tipologia ? `${tipologia} ` : ""}registados.</p>
            )}
          </div>

          {r.porPortal.length > 1 && (
            <Tabela
              titulo="Por portal"
              linhas={r.porPortal.map((x) => ({ nome: nomePortal(x.portal), e: x.e }))}
              nota="Mesma tipologia, só anúncios de mercado."
            />
          )}
          {r.porTipologia.length > 1 && <Tabela titulo="Por tipologia" linhas={r.porTipologia.map((x) => ({ nome: x.tipologia, e: x.e }))} />}
          {r.aParte.length > 0 && (
            <Tabela
              titulo="À parte"
              linhas={r.aParte.map((x) => ({ nome: NOMES_SEGMENTO[x.segmento], e: x.e }))}
              nota="Leilões, arrendamento temporário e quartos: mercados diferentes, não entram nas medianas acima."
            />
          )}

          <details className="cartao">
            <summary>Anúncios registados ({daOperacao.length})</summary>
            <div className="tabela-rolavel">
              <table>
                <tbody>
                  {daOperacao.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <a href={c.link} target="_blank" rel="noopener noreferrer">
                          {nomePortal(c.portal)}
                        </a>{" "}
                        · {c.tipologia}
                        {c.segmento !== "mercado" && ` · ${NOMES_SEGMENTO[c.segmento]}`}
                        <div className="suave">
                          registado a {new Date(`${c.registadoEm}T00:00:00`).toLocaleDateString("pt-PT")}
                          {c.nota && ` · ${c.nota}`}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {eurosInteiros(c.preco)}
                        {c.area ? <div className="suave">{eurosInteiros(c.preco / c.area)}/m²</div> : null}
                      </td>
                      <td>
                        <button type="button" className="botao-ligacao" onClick={() => onChange(lista.filter((x) => x.id !== c.id))}>
                          Retirar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}

function Intervalo({ e }: { e: Estatistica }) {
  return (
    <>
      mediana <strong>{eurosInteiros(e.mediana)}</strong>
      <div className="suave">
        de {eurosInteiros(e.min)} a {eurosInteiros(e.max)}
      </div>
    </>
  );
}

function IntervaloM2({ m2 }: { m2: NonNullable<Estatistica["m2"]> }) {
  return (
    <>
      mediana <strong>{eurosInteiros(m2.mediana)}/m²</strong>
      <div className="suave">
        de {eurosInteiros(m2.min)} a {eurosInteiros(m2.max)}/m²{m2.n > 0 ? ` (${m2.n} com área)` : ""}
      </div>
    </>
  );
}

function Tabela({ titulo, linhas, nota }: { titulo: string; linhas: { nome: string; e: Estatistica }[]; nota?: string }) {
  return (
    <div className="cartao tabela-rolavel">
      <h3>{titulo}</h3>
      <table>
        <thead>
          <tr>
            <th />
            <th style={{ textAlign: "right" }}>Anúncios</th>
            <th style={{ textAlign: "right" }}>Mediana</th>
            <th style={{ textAlign: "right" }}>Por m²</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td>{l.nome}</td>
              <td style={{ textAlign: "right" }}>{l.e.n}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{eurosInteiros(l.e.mediana)}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{l.e.m2 ? eurosInteiros(l.e.m2.mediana) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {nota && <small className="ajuda">{nota}</small>}
    </div>
  );
}

function NovoComparavel({ operacao, tipologia, onGuardar, onCancelar }: { operacao: Operacao; tipologia: string; onGuardar: (c: Comparavel) => void; onCancelar: () => void }) {
  const [link, setLink] = useState("");
  const [tip, setTip] = useState(tipologia);
  const [preco, setPreco] = useState<number | null>(null);
  const [area, setArea] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const portal = portalDoLink(link);
  const [segmento, setSegmento] = useState<Segmento | null>(null);
  const seg = segmento ?? portal?.segmento ?? "mercado";
  const linkValido = /^https?:\/\/\S+\.\S+/.test(link.trim());

  return (
    <div className="cartao">
      <h3>Registar um anúncio</h3>
      <div className="grelha">
        <Campo
          rotulo="Link do anúncio"
          ajuda={link.trim() === "" ? "Copie o endereço do anúncio no portal e cole-o aqui." : portal ? `Portal: ${portal.nome}` : linkValido ? "Outro site" : "Não parece um link."}
        >
          {(id) => <input id={id} value={link} inputMode="url" placeholder="https://…" onChange={(e) => setLink(e.target.value)} />}
        </Campo>
        <Campo rotulo="Tipologia">
          {(id) => (
            <select id={id} value={tip} onChange={(e) => setTip(e.target.value)}>
              {TIPOLOGIAS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </Campo>
        <CampoNumero rotulo={operacao === "venda" ? "Preço pedido" : "Renda pedida"} sufixo={operacao === "venda" ? "€" : "€/mês"} valor={preco} onChange={setPreco} />
        <CampoNumero rotulo="Área" sufixo="m²" valor={area} onChange={setArea} ajuda="A que vem no anúncio. Sem área, não entra no €/m²." />
        <Campo rotulo="Tipo de anúncio">
          {(id) => (
            <select id={id} value={seg} onChange={(e) => setSegmento(e.target.value as Segmento)}>
              {(Object.keys(NOMES_SEGMENTO) as Segmento[]).map((s) => (
                <option key={s} value={s}>
                  {NOMES_SEGMENTO[s]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Nota" ajuda="Opcional: estado, andar, garagem…">
          {(id) => <input id={id} value={nota} onChange={(e) => setNota(e.target.value)} />}
        </Campo>
      </div>
      <div className="acoes">
        <button
          type="button"
          className="botao"
          disabled={!linkValido || !preco}
          onClick={() =>
            onGuardar({
              id: crypto.randomUUID(),
              link: link.trim(),
              portal: portal?.id ?? null,
              operacao,
              segmento: seg,
              tipologia: tip,
              preco: preco!,
              area,
              nota: nota.trim(),
              registadoEm: diaISO(new Date()),
            })
          }
        >
          Guardar anúncio
        </button>
        <button type="button" className="botao botao-secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
      <small className="ajuda">O preço e a área são escritos por si: a app não lê os anúncios dos portais.</small>
    </div>
  );
}
