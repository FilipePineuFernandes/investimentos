// Secções das estratégias 1A (revenda) e 1B (arrendamento) na ficha do imóvel.

import type { ReactNode } from "react";
import { Aviso, CampoNumero } from "../componentes/ui";
import { calcularArrendamento } from "../calculo/arrendamento";
import type { AnaliseImovel } from "../calculo/imovel";
import { calcularRevenda } from "../calculo/revenda";
import { ARRENDAMENTO_VAZIO, REVENDA_VAZIA, type EstrategiaArrendamento, type EstrategiaRevenda, type Imovel } from "../dados/imoveis";
import type { Perfil } from "../dados/perfil";
import { euros } from "../util/numeros";

const pct = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
const sinal = (n: number) => (n < 0 ? "var(--erro)" : undefined);

function Ativar({ ativo, rotulo, onChange }: { ativo: boolean; rotulo: string; onChange: (ativo: boolean) => void }) {
  return (
    <div className="cartao">
      <label className="caixa">
        <input type="checkbox" checked={ativo} onChange={(e) => onChange(e.target.checked)} />
        <span>{rotulo}</span>
      </label>
    </div>
  );
}

function Linhas({ children }: { children: ReactNode }) {
  return (
    <div className="cartao">
      <dl className="lista">{children}</dl>
    </div>
  );
}

function Linha({ nome, valor, forte, nota, cor }: { nome: string; valor: ReactNode; forte?: boolean; nota?: string; cor?: string }) {
  return (
    <>
      <dt>{nome}</dt>
      <dd style={{ color: cor }}>
        {forte ? <strong>{valor}</strong> : valor}
        {nota && <div className="suave">{nota}</div>}
      </dd>
    </>
  );
}

// --- 1A: revenda ------------------------------------------------------------------------

export function SeccaoRevenda({ i, a, perfil, onChange }: { i: Imovel; a: AnaliseImovel; perfil: Perfil | undefined; onChange: (e: EstrategiaRevenda | null) => void }) {
  const e = i.revenda ?? null;
  const muda = <K extends keyof EstrategiaRevenda>(k: K, v: EstrategiaRevenda[K]) => onChange({ ...e!, [k]: v });

  return (
    <>
      <Ativar ativo={e !== null} rotulo="Analisar como revenda (estratégia 1A)" onChange={(v) => onChange(v ? { ...REVENDA_VAZIA } : null)} />
      {e && (
        <>
          <div className="cartao grelha">
            <CampoNumero rotulo="Preço de venda esperado" sufixo="€" valor={e.precoVenda} onChange={(v) => muda("precoVenda", v)} />
            <CampoNumero rotulo="Prazo até à venda" sufixo="meses" valor={e.mesesAteVenda} onChange={(v) => muda("mesesAteVenda", v)} />
            <CampoNumero rotulo="Pequenas obras de valorização" sufixo="€" valor={e.obras} onChange={(v) => muda("obras", v)} ajuda="Guarde as faturas: são dedutíveis na mais-valia." />
            <CampoNumero rotulo="Condomínio" sufixo="€/mês" valor={e.condominioMensal} onChange={(v) => muda("condominioMensal", v)} />
            <CampoNumero rotulo="Outros seguros" sufixo="€/ano" valor={e.seguroAnual} onChange={(v) => muda("seguroAnual", v)} ajuda="Os seguros exigidos pelo banco já estão no financiamento." />
            <CampoNumero rotulo="Comissão da imobiliária na venda" sufixo="%" valor={e.comissaoVendaPct} onChange={(v) => muda("comissaoVendaPct", v)} ajuda="Sem IVA." />
            <CampoNumero rotulo="Outros custos de venda" sufixo="€" valor={e.outrosCustosVenda} onChange={(v) => muda("outrosCustosVenda", v)} ajuda="Certificado energético, distrate da hipoteca…" />
            {(e.mesesAteVenda ?? 0) > 24 && (
              <CampoNumero
                rotulo="Coeficiente de desvalorização monetária"
                valor={e.coeficiente}
                onChange={(v) => muda("coeficiente", v)}
                ajuda="Da portaria publicada todos os anos, para o ano da compra. Em branco, usa 1."
              />
            )}
          </div>
          <ResultadosRevenda i={i} a={a} e={e} perfil={perfil} />
        </>
      )}
    </>
  );
}

function ResultadosRevenda({ i, a, e, perfil }: { i: Imovel; a: AnaliseImovel; e: EstrategiaRevenda; perfil: Perfil | undefined }) {
  const r = calcularRevenda(i, a, e, perfil?.rendimentoColetavelAnual ?? null);
  if (!("lucro" in r)) return <Aviso>Para calcular a revenda falta: {r.faltam.join(", ")}.</Aviso>;
  const mv = r.maisValia!;

  return (
    <>
      <Linhas>
        <Linha nome="Lucro líquido" valor={euros(r.lucro)} forte cor={sinal(r.lucro)} nota="Depois de todos os custos e do IRS." />
        <Linha nome="ROI" valor={pct(r.roi)} cor={sinal(r.roi)} nota={`Sobre ${euros(r.capitalInvestido)} de dinheiro próprio aplicado.`} />
        <Linha nome="TIR anual" valor={r.tir === null ? "Não calculável" : pct(r.tir)} cor={sinal(r.tir ?? 0)} />
        <Linha nome="Lucro por mês" valor={euros(r.lucroPorMes)} cor={sinal(r.lucroPorMes)} />
        <Linha nome="Preço mínimo de venda" valor={r.precoMinimo === null ? "Não encontrado" : euros(r.precoMinimo)} forte nota="Abaixo deste preço, tem prejuízo." />
      </Linhas>

      <details className="cartao">
        <summary>Detalhe dos custos e da mais-valia</summary>
        <dl className="lista">
          <Linha nome="Compra" valor={euros(i.preco!)} />
          <Linha nome="Custos de compra" valor={euros(a.aquisicao!.total)} />
          <Linha nome="Obras" valor={euros(e.obras ?? 0)} />
          <Linha
            nome="Custos de detenção"
            valor={euros(r.detencao!.total)}
            nota={`IMI ${euros(r.detencao!.imi)} · condomínio ${euros(r.detencao!.condominio)} · seguros ${euros(r.detencao!.seguros)} · juros e encargos do crédito ${euros(r.detencao!.credito)}`}
          />
          <Linha nome="Custos de venda" valor={euros(r.custosVenda)} />
          {r.dividaNaVenda > 0 && <Linha nome="Dívida paga ao banco na venda" valor={euros(r.dividaNaVenda)} nota="Não é custo: é o capital que falta amortizar." />}
          <Linha
            nome="Mais-valia fiscal"
            valor={euros(mv.ganho)}
            nota={`Venda ${euros(mv.valorRealizacao)} − aquisição ${euros(mv.valorAquisicao)}${mv.coeficiente !== 1 ? ` (× ${mv.coeficiente})` : ""} − obras ${euros(mv.encargosValorizacao)} − despesas ${euros(mv.despesas)}`}
          />
          <Linha nome="Parte englobada no IRS" valor={euros(mv.tributavel)} nota="50% da mais-valia, somada aos outros rendimentos." />
          <Linha nome="IRS da mais-valia" valor={euros(r.irs)} forte />
        </dl>
      </details>

      {r.notas.map((n) => (
        <Aviso key={n} tipo="atencao">
          {n}
        </Aviso>
      ))}
      <small className="ajuda">Não inclui a exclusão da mais-valia por reinvestimento na habitação própria nem a taxa adicional de solidariedade.</small>
    </>
  );
}

// --- 1B: arrendamento ---------------------------------------------------------------------

export function SeccaoArrendamento({ i, a, perfil, onChange }: { i: Imovel; a: AnaliseImovel; perfil: Perfil | undefined; onChange: (e: EstrategiaArrendamento | null) => void }) {
  const e = i.arrendamento ?? null;
  const muda = <K extends keyof EstrategiaArrendamento>(k: K, v: EstrategiaArrendamento[K]) => onChange({ ...e!, [k]: v });

  return (
    <>
      <Ativar ativo={e !== null} rotulo="Analisar como arrendamento (estratégia 1B)" onChange={(v) => onChange(v ? { ...ARRENDAMENTO_VAZIO } : null)} />
      {e && (
        <>
          <div className="cartao grelha">
            <CampoNumero rotulo="Renda mensal esperada" sufixo="€" valor={e.rendaMensal} onChange={(v) => muda("rendaMensal", v)} ajuda="A renda mediana do INE como referência chega na fase 2." />
            <CampoNumero rotulo="Meses sem inquilino por ano" sufixo="meses" valor={e.mesesVazioAno} onChange={(v) => muda("mesesVazioAno", v)} />
            <CampoNumero rotulo="Manutenção" sufixo="€/ano" valor={e.manutencaoAnual} onChange={(v) => muda("manutencaoAnual", v)} />
            <CampoNumero rotulo="Gestão do arrendamento" sufixo="%" valor={e.gestaoPct} onChange={(v) => muda("gestaoPct", v)} ajuda="Da renda recebida. Em branco se for o próprio a gerir." />
            <CampoNumero rotulo="Condomínio" sufixo="€/mês" valor={e.condominioMensal} onChange={(v) => muda("condominioMensal", v)} />
            <CampoNumero rotulo="Outros seguros" sufixo="€/ano" valor={e.seguroAnual} onChange={(v) => muda("seguroAnual", v)} ajuda="Multirriscos e seguro de renda, se não forem exigidos pelo banco." />
            <CampoNumero rotulo="Duração do contrato" sufixo="anos" valor={e.duracaoContratoAnos} onChange={(v) => muda("duracaoContratoAnos", v)} ajuda="A partir de 5 anos, a taxa de IRS é mais baixa." />
          </div>
          <ResultadosArrendamento i={i} a={a} e={e} perfil={perfil} />
        </>
      )}
    </>
  );
}

function ResultadosArrendamento({ i, a, e, perfil }: { i: Imovel; a: AnaliseImovel; e: EstrategiaArrendamento; perfil: Perfil | undefined }) {
  const r = calcularArrendamento(i, a, e, perfil);
  if (!("yieldBruta" in r)) return <Aviso>Para calcular o arrendamento falta: {r.faltam.join(", ")}.</Aviso>;

  return (
    <>
      <Linhas>
        <Linha nome="Cash-flow mensal" valor={euros(r.cashFlowMensal)} forte cor={sinal(r.cashFlowMensal)} nota="Renda − custos − IRS − crédito, no 1.º ano." />
        <Linha nome="Yield bruta" valor={pct(r.yieldBruta)} nota="Renda anual ÷ preço de compra." />
        <Linha nome="Yield líquida" valor={pct(r.yieldLiquida)} cor={sinal(r.yieldLiquida)} nota="Antes de IRS e do crédito, sobre o preço mais os custos de compra." />
        <Linha nome="ROI sobre o capital próprio" valor={pct(r.roi)} cor={sinal(r.roi)} nota={`Cash-flow anual ÷ ${euros(r.capitalProprio)}.`} />
        <Linha nome="Payback" valor={r.payback === null ? "Mais de 100 anos" : `${r.payback.toLocaleString("pt-PT")} anos`} nota="Anos até o cash-flow acumulado igualar o capital próprio." />
      </Linhas>

      <details className="cartao">
        <summary>Detalhe anual</summary>
        <dl className="lista">
          <Linha nome="Renda anual" valor={euros(r.rendaAnualBruta)} />
          <Linha nome="Renda recebida" valor={euros(r.rendaEfetiva)} nota="Descontados os meses sem inquilino." />
          <Linha
            nome="Custos"
            valor={euros(r.totalCustos)}
            nota={`Condomínio ${euros(r.custos.condominio)} · seguros ${euros(r.custos.seguros)} · manutenção ${euros(r.custos.manutencao)} · gestão ${euros(r.custos.gestao)} · IMI ${euros(r.custos.imi)}`}
          />
          <Linha nome="Rendimento predial" valor={euros(r.rendimentoPredial)} nota="Base do IRS. Os juros do crédito não são dedutíveis." />
          <Linha nome="IRS" valor={euros(r.irs)} nota={r.taxaIRS === null ? "Englobamento, pelos escalões do IRS." : `Taxa autónoma de ${r.taxaIRS}%.`} />
          {i.financiamento && <Linha nome="Crédito no 1.º ano" valor={euros(r.creditoAnual)} nota={`Inclui ${euros(r.amortizacaoAnual)} de capital amortizado, que fica no seu património.`} />}
          <Linha nome="Cash-flow anual" valor={euros(r.cashFlowAnual)} forte cor={sinal(r.cashFlowAnual)} />
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
