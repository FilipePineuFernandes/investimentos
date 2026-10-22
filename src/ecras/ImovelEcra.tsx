import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Aviso, Campo, CampoNumero, Ecra } from "../componentes/ui";
import { analisarImovel, type AnaliseImovel } from "../calculo/imovel";
import type { Validacao } from "../calculo/credito";
import {
  apagarImovel,
  FINANCIAMENTO_VAZIO,
  guardarImovel,
  listarImoveis,
  NOMES_DESTINO,
  NOMES_ESTADO,
  novoImovel,
  type Financiamento,
  type Imovel,
} from "../dados/imoveis";
import { idade, lerPerfil, type Perfil } from "../dados/perfil";
import { valorParametro } from "../dados/parametros";
import { euros } from "../util/numeros";

const pct = (n: number, casas = 2) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: casas })}%`;

/** Ficha de um imóvel: identificação, custos de aquisição e financiamento (pontos 5.1, 5.2 e 5.4). */
export function ImovelEcra({ chave, id, voltar }: { chave: CryptoKey; id: string | null; voltar: () => void }) {
  const [perfil, setPerfil] = useState<Perfil | undefined>();
  const [i, setI] = useState<Imovel | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await lerPerfil(chave);
      setPerfil(p);
      const existente = id ? (await listarImoveis(chave)).find((x) => x.id === id) : undefined;
      setI(existente ?? novoImovel(p?.residenciaFiscal ?? "continente"));
    })();
  }, [chave, id]);

  const analise = useMemo(() => (i ? analisarImovel(i, perfil) : null), [i, perfil]);

  if (!i || !analise) return <Ecra titulo="Imóvel">A carregar…</Ecra>;

  const muda = <K extends keyof Imovel>(k: K, v: Imovel[K]) => {
    setI({ ...i, [k]: v });
    setAlterado(true);
    setGuardado(false);
  };
  const f = i.financiamento;
  const mudaF = <K extends keyof Financiamento>(k: K, v: Financiamento[K]) => muda("financiamento", { ...f!, [k]: v });
  const anos = perfil ? idade(perfil.dataNascimento) : null;

  async function guardar() {
    setAGuardar(true);
    await guardarImovel(chave, i!);
    setAGuardar(false);
    setAlterado(false);
    setGuardado(true);
  }

  async function apagar() {
    if (!window.confirm(`Apagar "${i!.nome || "este imóvel"}"? Não é possível desfazer.`)) return;
    await apagarImovel(i!.id);
    voltar();
  }

  function sair() {
    if (alterado && !window.confirm("Tem alterações por guardar. Sair sem guardar?")) return;
    voltar();
  }

  return (
    <Ecra titulo={i.nome || "Novo imóvel"} voltar={sair}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        style={{ display: "contents" }}
      >
        <h2>Identificação</h2>
        <div className="cartao grelha">
          <Texto rotulo="Nome" valor={i.nome} onChange={(v) => muda("nome", v)} ajuda="Para o reconhecer na lista, por exemplo «T2 Arroios»." />
          <Escolha rotulo="Estado" valor={i.estado} opcoes={NOMES_ESTADO} onChange={(v) => muda("estado", v)} />
          <Texto rotulo="Morada" valor={i.morada} onChange={(v) => muda("morada", v)} ajuda="O mapa e as coordenadas chegam na fase 2." />
          <Texto rotulo="Município" valor={i.municipio} onChange={(v) => muda("municipio", v)} />
          <Texto rotulo="Freguesia" valor={i.freguesia} onChange={(v) => muda("freguesia", v)} />
          <Escolha
            rotulo="Região"
            valor={i.regiao}
            opcoes={{ continente: "Continente", acores: "Açores", madeira: "Madeira" }}
            onChange={(v) => muda("regiao", v)}
            ajuda="Define a tabela do IMT."
          />
          <Escolha rotulo="Destino" valor={i.destino} opcoes={NOMES_DESTINO} onChange={(v) => muda("destino", v)} ajuda="Define o IMT e os limites do crédito." />
          {i.destino !== "comercial" && (
            <Escolha
              rotulo="Tipologia"
              valor={i.tipologia}
              opcoes={{ T0: "T0", T1: "T1", T2: "T2", T3: "T3", T4: "T4", "T5+": "T5 ou mais" }}
              onChange={(v) => muda("tipologia", v)}
            />
          )}
          <CampoNumero rotulo="Área bruta privativa" sufixo="m²" valor={i.area} onChange={(v) => muda("area", v)} />
          <CampoNumero rotulo="Ano de construção" valor={i.anoConstrucao} onChange={(v) => muda("anoConstrucao", v)} />
          <Escolha
            rotulo="Estado de conservação"
            valor={i.conservacao}
            opcoes={{ novo: "Novo", bom: "Bom", recuperar: "A recuperar", ruina: "Ruína" }}
            onChange={(v) => muda("conservacao", v)}
          />
          <Escolha
            rotulo="Em ARU (área de reabilitação urbana)?"
            valor={i.aru}
            opcoes={{ "nao-sei": "Não sei", sim: "Sim", nao: "Não" }}
            onChange={(v) => muda("aru", v)}
          />
          <Texto rotulo="Certificado energético" valor={i.certificadoEnergetico} onChange={(v) => muda("certificadoEnergetico", v)} ajuda="Classe, por exemplo B ou C." />
        </div>

        <h2>Valores e custos de compra</h2>
        <div className="cartao grelha">
          <CampoNumero rotulo="Valor de compra" sufixo="€" valor={i.preco} onChange={(v) => muda("preco", v)} />
          <CampoNumero
            rotulo="Valor patrimonial tributário (VPT)"
            sufixo="€"
            valor={i.vpt}
            onChange={(v) => muda("vpt", v)}
            ajuda="Está na caderneta predial. Os impostos incidem sobre o maior entre o preço e o VPT."
          />
          <CampoNumero
            rotulo="Taxa de IMI do município"
            sufixo="%"
            valor={i.taxaImi}
            onChange={(v) => muda("taxaImi", v)}
            ajuda={`Entre ${pct(valorParametro("imi.taxa-minima"))} e ${pct(valorParametro("imi.taxa-maxima"))}. Consulte o Portal das Finanças.`}
          />
          <CampoNumero
            rotulo="Escritura e registo"
            sufixo="€"
            valor={i.escrituraRegisto}
            onChange={(v) => muda("escrituraRegisto", v)}
            ajuda="Em branco, usa o valor de referência da Casa Pronta."
          />
          <CampoNumero
            rotulo="Avaliação bancária e comissões de processo"
            sufixo="€"
            valor={i.avaliacaoComissoes}
            onChange={(v) => muda("avaliacaoComissoes", v)}
            ajuda="Da ficha de informação (FINE) do banco."
          />
          <CampoNumero rotulo="Comissão de mediação paga por si" sufixo="%" valor={i.mediacaoPct} onChange={(v) => muda("mediacaoPct", v)} ajuda="Sem IVA. Normalmente é o vendedor quem paga." />
        </div>
        {i.destino === "hpp" && (
          <div className="cartao">
            <label className="caixa">
              <input type="checkbox" checked={i.primeiraHabitacao} onChange={(e) => muda("primeiraHabitacao", e.target.checked)} />
              <span>É a primeira habitação própria (nunca foi proprietário de uma habitação)</span>
            </label>
            <small className="ajuda">
              {anos === null
                ? "Preencha a data de nascimento no perfil para verificar o IMT Jovem."
                : anos <= valorParametro("imt.jovem-idade-maxima")
                  ? `Com ${anos} anos, pode ter direito ao IMT Jovem se for a primeira habitação.`
                  : `Com ${anos} anos, não tem direito ao IMT Jovem (até ${valorParametro("imt.jovem-idade-maxima")} anos).`}
            </small>
          </div>
        )}

        <h2>Financiamento</h2>
        <div className="cartao">
          <label className="caixa">
            <input type="checkbox" checked={f !== null} onChange={(e) => muda("financiamento", e.target.checked ? { ...FINANCIAMENTO_VAZIO } : null)} />
            <span>O investimento é financiado</span>
          </label>
        </div>
        {f && (
          <div className="cartao grelha">
            <CampoNumero rotulo="Montante a financiar" sufixo="€" valor={f.montante} onChange={(v) => mudaF("montante", v)} />
            <CampoNumero rotulo="Prazo" sufixo="anos" valor={f.prazoAnos} onChange={(v) => mudaF("prazoAnos", v)} />
            <Escolha rotulo="Tipo de taxa" valor={f.tipoTaxa} opcoes={{ variavel: "Variável", fixa: "Fixa", mista: "Mista" }} onChange={(v) => mudaF("tipoTaxa", v)} />
            {f.tipoTaxa === "variavel" ? (
              <>
                <Escolha
                  rotulo="Indexante"
                  valor={f.indexante}
                  opcoes={{ euribor3: "Euribor a 3 meses", euribor6: "Euribor a 6 meses", euribor12: "Euribor a 12 meses" }}
                  onChange={(v) => mudaF("indexante", v)}
                />
                <CampoNumero
                  rotulo="Valor atual da Euribor"
                  sufixo="%"
                  valor={f.euribor}
                  onChange={(v) => mudaF("euribor", v)}
                  ajuda="Por agora introduzido à mão. Na fase 2 vem do Banco Central Europeu."
                />
                <CampoNumero rotulo="Spread" sufixo="%" valor={f.spread} onChange={(v) => mudaF("spread", v)} ajuda="Da proposta do banco (FINE)." />
              </>
            ) : (
              <>
                <CampoNumero rotulo={f.tipoTaxa === "mista" ? "Taxa fixa inicial (TAN)" : "Taxa fixa (TAN)"} sufixo="%" valor={f.taxaFixa} onChange={(v) => mudaF("taxaFixa", v)} />
                {f.tipoTaxa === "mista" && <CampoNumero rotulo="Anos de taxa fixa" sufixo="anos" valor={f.periodoFixoAnos} onChange={(v) => mudaF("periodoFixoAnos", v)} />}
              </>
            )}
            <CampoNumero rotulo="Seguros exigidos pelo banco" sufixo="€/mês" valor={f.seguroMensal} onChange={(v) => mudaF("seguroMensal", v)} ajuda="Vida e multirriscos." />
            <CampoNumero rotulo="Comissão de processamento" sufixo="€/mês" valor={f.comissaoMensal} onChange={(v) => mudaF("comissaoMensal", v)} />
            <CampoNumero
              rotulo="Valor da avaliação bancária"
              sufixo="€"
              valor={f.valorAvaliacao}
              onChange={(v) => mudaF("valorAvaliacao", v)}
              ajuda="Se já souber. O banco empresta sobre o menor entre o preço e a avaliação."
            />
          </div>
        )}

        <Resultados i={i} a={analise} perfil={perfil} />

        {guardado && <Aviso tipo="sucesso">Imóvel guardado.</Aviso>}
        <div className="acoes">
          <button className="botao" type="submit" disabled={aGuardar}>
            {aGuardar ? "A guardar…" : "Guardar"}
          </button>
          {id && (
            <button className="botao botao-secundario" type="button" onClick={apagar}>
              Apagar imóvel
            </button>
          )}
        </div>
        <p className="suave">Simulação com valores de referência a confirmar. Não é aconselhamento financeiro nem fiscal.</p>
      </form>
    </Ecra>
  );
}

// --- Resultados ----------------------------------------------------------------------

function Resultados({ i, a, perfil }: { i: Imovel; a: AnaliseImovel; perfil: Perfil | undefined }) {
  if (!a.aquisicao) return <Aviso>Indique o valor de compra para ver os custos.</Aviso>;
  const c = a.credito;
  const falhas = a.validacoes.filter((v) => v.cumpre === false);

  return (
    <>
      <h2>Resultados</h2>
      <div className="cartao">
        <dl className="lista">
          <dt>Custos de compra</dt>
          <dd>{euros(a.aquisicao.total)}</dd>
          <dt>Custo total</dt>
          <dd>
            <strong>{euros(a.aquisicao.custoTotal)}</strong>
          </dd>
          {a.capitalProprio !== null && (
            <>
              <dt>Capital próprio necessário</dt>
              <dd>
                <strong>{euros(a.capitalProprio)}</strong>
              </dd>
            </>
          )}
          {c && (
            <>
              <dt>Prestação mensal</dt>
              <dd>
                <strong>{euros(c.prestacao)}</strong>
              </dd>
            </>
          )}
          {a.precoM2 !== null && (
            <>
              <dt>Preço por m²</dt>
              <dd>{euros(a.precoM2)}</dd>
            </>
          )}
          <dt>IMI anual</dt>
          <dd>{a.imi !== null ? euros(a.imi) : <span className="suave">Falta o VPT ou a taxa do município</span>}</dd>
        </dl>
      </div>

      <h3>Custos de compra</h3>
      <div className="cartao tabela-rolavel">
        <table>
          <tbody>
            {a.aquisicao.linhas.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.descricao}
                  {l.nota && <div className="suave">{l.nota}</div>}
                </td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  {euros(l.valor)}
                  <div className="suave">{l.origem === "utilizador" ? "seu valor" : l.origem}</div>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td style={{ textAlign: "right" }}>
                <strong>{euros(a.aquisicao.total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {i.financiamento && a.faltam.length > 0 && <Aviso>Para calcular o crédito falta: {a.faltam.join(", ")}.</Aviso>}

      {c && a.taxaCredito !== null && (
        <>
          <h3>Crédito</h3>
          <div className="cartao">
            <dl className="lista">
              <dt>TAN</dt>
              <dd>{pct(a.taxaCredito, 3)}</dd>
              <dt>TAEG (aproximada)</dt>
              <dd>{pct(c.taeg)}</dd>
              <dt>Prestação</dt>
              <dd>{euros(c.prestacao)}</dd>
              <dt>Encargo mensal no 1.º mês</dt>
              <dd>
                {euros(c.encargoMensalInicial)}
                <div className="suave">Prestação, Imposto do Selo sobre os juros, seguros e comissão.</div>
              </dd>
              <dt>Total de juros</dt>
              <dd>{euros(c.totalJuros)}</dd>
              <dt>Montante total imputado (MTIC)</dt>
              <dd>{euros(c.mtic)}</dd>
            </dl>
            {i.financiamento?.tipoTaxa === "mista" && (
              <small className="ajuda">Taxa mista: a prestação e a TAEG usam a taxa fixa inicial durante todo o prazo. O teste de stress mostra o que muda se a taxa subir.</small>
            )}
          </div>

          {c.stress.length > 0 && (
            <>
              <h3>Teste de stress</h3>
              <div className="cartao tabela-rolavel">
                <table>
                  <thead>
                    <tr>
                      <th>Se a taxa subir</th>
                      <th>Taxa</th>
                      <th style={{ textAlign: "right" }}>Prestação</th>
                      <th style={{ textAlign: "right" }}>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.stress.map((s) => (
                      <tr key={s.acrescimo}>
                        <td>+{s.acrescimo} ponto{s.acrescimo > 1 ? "s" : ""}</td>
                        <td>{pct(s.taxa, 3)}</td>
                        <td style={{ textAlign: "right" }}>{euros(s.prestacao)}</td>
                        <td style={{ textAlign: "right" }}>+{euros(s.diferenca)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {i.destino === "comercial" ? (
            <Aviso>Crédito comercial: os limites do Banco de Portugal para o crédito à habitação não se aplicam. Confirme as condições com o banco.</Aviso>
          ) : (
            <>
              <h3>Limites do Banco de Portugal</h3>
              {falhas.length > 0 && (
                <Aviso tipo="erro" titulo="Dificilmente aprovado por um banco">
                  {falhas.map((v) => v.nome).join(" e ")} {falhas.length > 1 ? "ultrapassam" : "ultrapassa"} o limite.
                </Aviso>
              )}
              <div className="cartao">
                {a.validacoes.map((v) => (
                  <LinhaValidacao key={v.id} v={v} />
                ))}
                {!perfil && <small className="ajuda">Preencha o perfil do investidor para verificar o prazo e a taxa de esforço.</small>}
              </div>
            </>
          )}

          <details className="cartao">
            <summary>Plano de pagamentos (resumo anual)</summary>
            <PlanoAnual c={c} />
          </details>
        </>
      )}
    </>
  );
}

function LinhaValidacao({ v }: { v: Validacao }) {
  const [simbolo, cor, estado] = v.cumpre === true ? ["✓", "var(--sucesso)", "cumpre"] : v.cumpre === false ? ["✗", "var(--erro)", "ultrapassa"] : ["?", "var(--atencao)", "por verificar"];
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span aria-hidden style={{ color: cor, fontWeight: 700, minWidth: "1.2em" }}>
        {simbolo}
      </span>
      <div>
        <strong>{v.nome}</strong> <span style={{ color: cor }}>({estado})</span>
        <div className="suave">{v.explicacao}</div>
      </div>
    </div>
  );
}

function PlanoAnual({ c }: { c: NonNullable<AnaliseImovel["credito"]> }) {
  const anos: { ano: number; juros: number; capital: number; divida: number }[] = [];
  for (const l of c.plano) {
    const ano = Math.ceil(l.mes / 12);
    if (!anos[ano - 1]) anos[ano - 1] = { ano, juros: 0, capital: 0, divida: 0 };
    anos[ano - 1].juros += l.juros;
    anos[ano - 1].capital += l.capital;
    anos[ano - 1].divida = l.divida;
  }
  return (
    <div className="tabela-rolavel">
      <table>
        <thead>
          <tr>
            <th>Ano</th>
            <th style={{ textAlign: "right" }}>Juros</th>
            <th style={{ textAlign: "right" }}>Capital pago</th>
            <th style={{ textAlign: "right" }}>Dívida no fim</th>
          </tr>
        </thead>
        <tbody>
          {anos.map((x) => (
            <tr key={x.ano}>
              <td>{x.ano}</td>
              <td style={{ textAlign: "right" }}>{euros(x.juros)}</td>
              <td style={{ textAlign: "right" }}>{euros(x.capital)}</td>
              <td style={{ textAlign: "right" }}>{euros(x.divida)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Campos ----------------------------------------------------------------------------

function Texto({ rotulo, valor, onChange, ajuda }: { rotulo: string; valor: string; onChange: (v: string) => void; ajuda?: ReactNode }) {
  return <Campo rotulo={rotulo} ajuda={ajuda}>{(id) => <input id={id} value={valor} onChange={(e) => onChange(e.target.value)} />}</Campo>;
}

function Escolha<T extends string>({ rotulo, valor, opcoes, onChange, ajuda }: { rotulo: string; valor: T; opcoes: Record<T, string>; onChange: (v: T) => void; ajuda?: ReactNode }) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda}>
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
