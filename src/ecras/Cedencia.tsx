// Secção da estratégia 3 (cedência de posição) na ficha do imóvel.

import { Aviso, Campo, CampoNumero } from "../componentes/ui";
import { calcularCedencia } from "../calculo/cedencia";
import { CEDENCIA_VAZIA, type EstrategiaCedencia, type Imovel, type Pagamento } from "../dados/imoveis";
import type { Perfil } from "../dados/perfil";
import { euros } from "../util/numeros";
import { Ativar, Linha, Linhas, pct, sinal } from "./Estrategias";

const VERIFICACOES: { k: keyof EstrategiaCedencia["verificacoes"]; texto: string }[] = [
  { k: "licenca", texto: "O promotor tem licença de construção emitida" },
  { k: "garantiaSinal", texto: "O sinal tem garantia bancária (ou seguro-caução)" },
  { k: "historico", texto: "O promotor tem histórico de obras concluídas" },
  { k: "semAtrasos", texto: "A obra está dentro do prazo" },
];

export function SeccaoCedencia({ i, perfil, onChange }: { i: Imovel; perfil: Perfil | undefined; onChange: (e: EstrategiaCedencia | null) => void }) {
  const e = i.cedencia ?? null;
  const muda = <K extends keyof EstrategiaCedencia>(k: K, v: EstrategiaCedencia[K]) => onChange({ ...e!, [k]: v });
  const mudaPagamento = (id: string, p: Partial<Pagamento>) => muda("pagamentos", e!.pagamentos.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <>
      <Ativar
        ativo={e !== null}
        rotulo="Analisar como cedência de posição (estratégia 3)"
        onChange={(v) => onChange(v ? { ...CEDENCIA_VAZIA, pagamentos: [{ id: crypto.randomUUID(), data: "", valor: null, descricao: "Sinal" }] } : null)}
      />
      {e && (
        <>
          <Aviso>O valor de compra do imóvel é o preço no contrato-promessa (CPCV). Os custos de compra e o crédito em cima não se aplicam se ceder a posição antes da escritura.</Aviso>
          <h3>Sinal e reforços</h3>
          <div className="cartao">
            {e.pagamentos.map((p) => (
              <div key={p.id} className="grelha" style={{ borderBottom: "1px solid var(--borda)", paddingBottom: 12 }}>
                <Campo rotulo="Descrição">{(id) => <input id={id} value={p.descricao} onChange={(x) => mudaPagamento(p.id, { descricao: x.target.value })} />}</Campo>
                <Campo rotulo="Data">{(id) => <input id={id} type="date" value={p.data} onChange={(x) => mudaPagamento(p.id, { data: x.target.value })} />}</Campo>
                <CampoNumero rotulo="Valor" sufixo="€" valor={p.valor} onChange={(v) => mudaPagamento(p.id, { valor: v })} />
                <div style={{ alignSelf: "end" }}>
                  <button type="button" className="botao botao-secundario" onClick={() => muda("pagamentos", e.pagamentos.filter((x) => x.id !== p.id))}>
                    Retirar
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => muda("pagamentos", [...e.pagamentos, { id: crypto.randomUUID(), data: "", valor: null, descricao: "Reforço" }])}
            >
              Acrescentar reforço
            </button>
          </div>

          <div className="cartao grelha">
            <Campo rotulo="Data prevista da escritura">{(id) => <input id={id} type="date" value={e.dataEscritura} onChange={(x) => muda("dataEscritura", x.target.value)} />}</Campo>
            <Campo rotulo="Data prevista da cedência">{(id) => <input id={id} type="date" value={e.dataCedencia} onChange={(x) => muda("dataCedencia", x.target.value)} />}</Campo>
            <CampoNumero
              rotulo="Valor esperado da cedência"
              sufixo="€"
              valor={e.valorCedencia}
              onChange={(v) => muda("valorCedencia", v)}
              ajuda="Tudo o que recebe de quem fica com a posição: o reembolso do que pagou mais o ganho."
            />
            <CampoNumero rotulo="Custos da cedência" sufixo="€" valor={e.custos} onChange={(v) => muda("custos", v)} ajuda="Comissões, advogado…" />
            <CampoNumero rotulo="IMT da cedência" sufixo="€" valor={e.imt} onChange={(v) => muda("imt", v)} ajuda="Se o contabilista confirmar que há IMT a pagar." />
          </div>

          <h3>Promotor</h3>
          <div className="cartao">
            <Campo rotulo="Nome do promotor">{(id) => <input id={id} value={e.promotor} onChange={(x) => muda("promotor", x.target.value)} />}</Campo>
            {VERIFICACOES.map(({ k, texto }) => (
              <label key={k} className="caixa">
                <input type="checkbox" checked={e.verificacoes[k]} onChange={(x) => muda("verificacoes", { ...e.verificacoes, [k]: x.target.checked })} />
                <span>{texto}</span>
              </label>
            ))}
            <small className="ajuda">Os comparáveis de construção nova da mesma tipologia chegam na fase 2.</small>
          </div>

          <ResultadosCedencia e={e} perfil={perfil} />
        </>
      )}
    </>
  );
}

function ResultadosCedencia({ e, perfil }: { e: EstrategiaCedencia; perfil: Perfil | undefined }) {
  const r = calcularCedencia(e, perfil?.rendimentoColetavelAnual ?? null);
  if (!("ganho" in r)) return <Aviso>Para calcular a cedência falta: {r.faltam.join(", ")}.</Aviso>;

  return (
    <>
      {r.riscos.length > 0 && (
        <Aviso tipo="erro" titulo={`Risco do promotor: ${r.riscos.length} ${r.riscos.length === 1 ? "verificação por fazer" : "verificações por fazer"}`}>
          Falta confirmar: {r.riscos.join(", ")}.
        </Aviso>
      )}
      <Linhas>
        <Linha nome="Ganho líquido" valor={euros(r.ganhoLiquido)} forte cor={sinal(r.ganhoLiquido)} nota="Depois dos custos, do IMT e do IRS." />
        <Linha nome="Capital adiantado" valor={euros(r.totalPago)} nota={`Durante ${r.meses.toLocaleString("pt-PT")} meses.`} />
        <Linha nome="ROI" valor={pct(r.roi)} cor={sinal(r.roi)} nota="Ganho líquido ÷ capital adiantado." />
        <Linha nome="TIR anual" valor={r.tir === null ? "Não calculável" : pct(r.tir)} cor={sinal(r.tir ?? 0)} nota="Com as datas reais de cada pagamento." />
      </Linhas>
      <details className="cartao">
        <summary>Detalhe fiscal</summary>
        <dl className="lista">
          <Linha nome="Ganho antes de impostos" valor={euros(r.ganho)} />
          <Linha nome="Parte englobada no IRS" valor={euros(r.tributavel)} nota="50% do ganho, somada aos outros rendimentos." />
          <Linha nome="IRS" valor={euros(r.irs)} forte />
        </dl>
      </details>
      {r.notas.map((n) => (
        <Aviso key={n} tipo="atencao">
          {n}
        </Aviso>
      ))}
    </>
  );
}
