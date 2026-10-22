// Secção da estratégia 2 (reconstrução) na ficha do imóvel.

import { Aviso, Campo, CampoNumero } from "../componentes/ui";
import type { AnaliseImovel } from "../calculo/imovel";
import { calcularReconstrucao } from "../calculo/reconstrucao";
import type { TabelaCustosObra, ValorRevisto } from "../dados/custosObra";
import { NOMES_ACABAMENTO, RECONSTRUCAO_VAZIA, TRABALHOS, type Acabamento, type EstrategiaReconstrucao, type Imovel, type TipoTrabalho, type Trabalho } from "../dados/imoveis";
import { euros } from "../util/numeros";
import { Ativar, Linha, Linhas, pct, sinal } from "./Estrategias";

const revisto = (v: ValorRevisto | undefined) =>
  v ? `Último valor que usou: ${euros(v.valor)}, a ${new Date(v.revistoEm).toLocaleDateString("pt-PT")}.` : "Sem valor guardado. Use um orçamento ou a sua tabela.";

export function SeccaoReconstrucao({
  i,
  a,
  tabela,
  onChange,
}: {
  i: Imovel;
  a: AnaliseImovel;
  tabela: TabelaCustosObra;
  onChange: (e: EstrategiaReconstrucao | null) => void;
}) {
  const e = i.reconstrucao ?? null;
  const muda = <K extends keyof EstrategiaReconstrucao>(k: K, v: EstrategiaReconstrucao[K]) => onChange({ ...e!, [k]: v });
  const mudaTrabalho = (id: string, t: Partial<Trabalho>) => muda("trabalhos", e!.trabalhos.map((x) => (x.id === id ? { ...x, ...t } : x)));

  function acrescentar(tipo: TipoTrabalho) {
    muda("trabalhos", [...e!.trabalhos, { id: crypto.randomUUID(), tipo, descricao: "", quantidade: null, custoUnitario: tabela.trabalhos[tipo]?.valor ?? null }]);
  }

  function mudaAcabamento(acabamento: Acabamento) {
    onChange({ ...e!, acabamento, custoM2: tabela.integral[acabamento]?.valor ?? e!.custoM2 });
  }

  return (
    <>
      <Ativar ativo={e !== null} rotulo="Analisar como reconstrução (estratégia 2)" onChange={(v) => onChange(v ? { ...RECONSTRUCAO_VAZIA } : null)} />
      {e && (
        <>
          <Aviso>O custo da obra entra também na revenda e no arrendamento, se os ativar.</Aviso>
          <div className="cartao">
            <Campo rotulo="Tem áreas para reconstruir?">
              {(id) => (
                <select id={id} value={e.modo} onChange={(x) => muda("modo", x.target.value as EstrategiaReconstrucao["modo"])}>
                  <option value="integral">Obra integral (custo por m² de todo o imóvel)</option>
                  <option value="zonas">Obra por zonas (lista de trabalhos)</option>
                </select>
              )}
            </Campo>
            <small className="ajuda">Um modo ou o outro, para não contar a mesma obra duas vezes.</small>
          </div>

          {e.modo === "integral" ? (
            <div className="cartao grelha">
              <Campo rotulo="Nível de acabamento">
                {(id) => (
                  <select id={id} value={e.acabamento} onChange={(x) => mudaAcabamento(x.target.value as Acabamento)}>
                    {(Object.keys(NOMES_ACABAMENTO) as Acabamento[]).map((k) => (
                      <option key={k} value={k}>
                        {NOMES_ACABAMENTO[k]}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <CampoNumero
                key={e.acabamento}
                rotulo="Custo da obra por m²"
                sufixo="€/m²"
                valor={e.custoM2}
                onChange={(v) => muda("custoM2", v)}
                ajuda={`Com IVA, sobre ${i.area ? `${i.area} m²` : "a área bruta (preencha-a na identificação)"}. ${revisto(tabela.integral[e.acabamento])}`}
              />
            </div>
          ) : (
            <div className="cartao">
              {e.trabalhos.length === 0 && <p className="suave">Ainda sem trabalhos. Acrescente o primeiro em baixo.</p>}
              {e.trabalhos.map((t) => (
                <div key={t.id} className="grelha" style={{ borderBottom: "1px solid var(--borda)", paddingBottom: 12 }}>
                  <Campo rotulo="Trabalho" ajuda={TRABALHOS[t.tipo].nota}>
                    {(id) =>
                      t.tipo === "outro" ? (
                        <input id={id} value={t.descricao} placeholder="Descrição" onChange={(x) => mudaTrabalho(t.id, { descricao: x.target.value })} />
                      ) : (
                        <input id={id} value={TRABALHOS[t.tipo].nome} readOnly />
                      )
                    }
                  </Campo>
                  <CampoNumero rotulo="Quantidade" sufixo={TRABALHOS[t.tipo].unidade} valor={t.quantidade} onChange={(v) => mudaTrabalho(t.id, { quantidade: v })} />
                  <CampoNumero
                    rotulo="Custo por unidade"
                    sufixo={`€/${TRABALHOS[t.tipo].unidade}`}
                    valor={t.custoUnitario}
                    onChange={(v) => mudaTrabalho(t.id, { custoUnitario: v })}
                    ajuda={t.tipo === "outro" ? "Com IVA." : `Com IVA. ${revisto(tabela.trabalhos[t.tipo])}`}
                  />
                  <div style={{ alignSelf: "end" }}>
                    <button type="button" className="botao botao-secundario" onClick={() => muda("trabalhos", e.trabalhos.filter((x) => x.id !== t.id))}>
                      Retirar
                    </button>
                  </div>
                </div>
              ))}
              <Campo rotulo="Acrescentar trabalho">
                {(id) => (
                  <select
                    id={id}
                    value=""
                    onChange={(x) => {
                      if (x.target.value) acrescentar(x.target.value as TipoTrabalho);
                    }}
                  >
                    <option value="">Escolha o tipo de trabalho…</option>
                    {(Object.keys(TRABALHOS) as TipoTrabalho[]).map((k) => (
                      <option key={k} value={k}>
                        {TRABALHOS[k].nome} ({TRABALHOS[k].unidade})
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
          )}

          <div className="cartao grelha">
            <CampoNumero rotulo="Coeficiente regional" valor={e.coeficienteRegional} onChange={(v) => muda("coeficienteRegional", v)} ajuda="Ajusta os custos à localização. Em branco, 1." />
            <CampoNumero rotulo="Margem de imprevistos" sufixo="%" valor={e.imprevistosPct} onChange={(v) => muda("imprevistosPct", v)} ajuda="Habitualmente entre 10% e 15%." />
            <CampoNumero
              rotulo="Projeto e licenciamento"
              sufixo="€"
              valor={e.projetoLicenciamento}
              onChange={(v) => muda("projetoLicenciamento", v)}
              ajuda="Arquitetura, especialidades e taxas municipais."
            />
            <CampoNumero rotulo="Prazo da obra" sufixo="meses" valor={e.prazoObraMeses} onChange={(v) => muda("prazoObraMeses", v)} ajuda="Para os juros e o IMI durante a obra." />
            <CampoNumero
              rotulo="Valor depois da obra"
              sufixo="€"
              valor={e.valorDepoisObra}
              onChange={(v) => muda("valorDepoisObra", v)}
              ajuda="De comparáveis renovados. A referência do INE chega na fase 2."
            />
          </div>
          <ResultadosReconstrucao i={i} a={a} e={e} />
        </>
      )}
    </>
  );
}

function ResultadosReconstrucao({ i, a, e }: { i: Imovel; a: AnaliseImovel; e: EstrategiaReconstrucao }) {
  const r = calcularReconstrucao(i, a, e);
  if (!("totalObra" in r)) return <Aviso>Para calcular a obra falta: {r.faltam.join(", ")}.</Aviso>;

  return (
    <>
      <Linhas>
        <Linha nome="Total da obra" valor={euros(r.totalObra)} forte nota={`Com ${euros(r.imprevistos)} de imprevistos${r.coeficiente !== 1 ? ` e coeficiente regional de ${r.coeficiente.toLocaleString("pt-PT")}` : ""}.`} />
        <Linha nome="Custo global" valor={euros(r.custoGlobal)} nota="Imóvel, custos de compra, obra, licenciamento, e juros e IMI durante a obra." />
        <Linha nome="Margem" valor={r.margem === null ? "Falta o valor depois da obra" : euros(r.margem)} forte cor={sinal(r.margem ?? 0)} nota="Antes dos custos de venda e do IRS." />
        {r.roi !== null && <Linha nome="ROI" valor={pct(r.roi)} cor={sinal(r.roi)} nota="Margem ÷ custo global." />}
      </Linhas>

      <details className="cartao">
        <summary>Custos por trabalho</summary>
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Trabalho</th>
                <th style={{ textAlign: "right" }}>Quantidade</th>
                <th style={{ textAlign: "right" }}>Por unidade</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {r.linhas.map((l, k) => (
                <tr key={k}>
                  <td>{l.descricao}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {l.quantidade.toLocaleString("pt-PT")} {l.unidade}
                  </td>
                  <td style={{ textAlign: "right" }}>{euros(l.custoUnitario)}</td>
                  <td style={{ textAlign: "right" }}>{euros(l.total)}</td>
                </tr>
              ))}
              {r.coeficiente !== 1 && (
                <tr>
                  <td colSpan={3}>Ajuste regional (× {r.coeficiente.toLocaleString("pt-PT")})</td>
                  <td style={{ textAlign: "right" }}>{euros(r.subtotal * (r.coeficiente - 1))}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3}>Imprevistos ({pct(e.imprevistosPct ?? 0)})</td>
                <td style={{ textAlign: "right" }}>{euros(r.imprevistos)}</td>
              </tr>
              <tr>
                <td colSpan={3}>Projeto e licenciamento</td>
                <td style={{ textAlign: "right" }}>{euros(r.licenciamento)}</td>
              </tr>
              <tr>
                <td colSpan={3}>Juros e IMI durante a obra</td>
                <td style={{ textAlign: "right" }}>{euros(r.detencao)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      {r.notas.map((n) => (
        <Aviso key={n} tipo="atencao">
          {n}
        </Aviso>
      ))}
    </>
  );
}
