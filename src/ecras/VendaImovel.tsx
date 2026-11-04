// Venda de um imóvel: valor de venda, mediação imobiliária (com IVA), declaração de condomínio,
// certificado energético e outras despesas. Mostra o lucro realizado, que entra no resultado da carteira global:
// lucro = valor de venda − despesas da venda − IRS + rendas líquidas − custo global do imóvel.

import { Campo, CampoNumero } from "../componentes/ui";
import { diaISO, posicao, resultadoVenda } from "../calculo/carteira";
import type { AnaliseImovel } from "../calculo/imovel";
import { despesasVenda } from "../calculo/venda";
import type { Imovel, VendaRealizada } from "../dados/imoveis";
import { euros } from "../util/numeros";

const comSinal = (n: number) => `${n >= 0 ? "+" : "−"}${euros(Math.abs(n))}`;
const corLucro = (n: number) => (n >= 0 ? "var(--sucesso)" : "var(--erro)");

export function VendaFormulario({
  i,
  a,
  venda,
  dataCompra,
  onChange,
  onDataCompra,
}: {
  i: Imovel;
  a: AnaliseImovel;
  venda: VendaRealizada;
  dataCompra: string;
  onChange: (v: VendaRealizada) => void;
  onDataCompra: (d: string) => void;
}) {
  /** Cada alteração recalcula o total das despesas, que é o que a carteira usa. */
  const muda = (patch: Partial<VendaRealizada>) => {
    const novo = { ...venda, ...patch };
    onChange({ ...novo, custos: despesasVenda(novo).total });
  };
  const d = despesasVenda(venda);
  const mediacao = !!venda.mediacao;

  // O resultado, como ficará na carteira
  const temporario: Imovel = { ...i, carteira: { ...(i.carteira ?? { dataCompra: "", obrasRealizadas: null, avaliacoes: [], venda: null }), dataCompra, venda } };
  const p = posicao(temporario, a, diaISO(new Date()));
  const r = p ? resultadoVenda(temporario, p) : null;

  return (
    <div className="cartao">
      <div className="grelha">
        <Campo rotulo="Data da venda">{(id) => <input id={id} type="date" value={venda.data} onChange={(e) => muda({ data: e.target.value })} />}</Campo>
        <CampoNumero rotulo="Qual o valor de venda?" sufixo="€" valor={venda.valor} onChange={(v) => muda({ valor: v })} />
      </div>

      <div>
        <span className="rotulo-campo">Teve mediação imobiliária?</span>
        <div className="estrategias" role="group" aria-label="Teve mediação imobiliária?" style={{ marginTop: 6 }}>
          {[
            { v: true, nome: "Sim" },
            { v: false, nome: "Não" },
          ].map((o) => (
            <button key={o.nome} type="button" className={`botao ${mediacao === o.v ? "botao-verde" : ""}`} aria-pressed={mediacao === o.v} onClick={() => muda({ mediacao: o.v })}>
              {o.nome}
            </button>
          ))}
        </div>
      </div>
      {mediacao && (
        <CampoNumero
          rotulo="Comissão de mediação"
          sufixo="% do valor de venda"
          valor={venda.mediacaoPct ?? null}
          onChange={(v) => muda({ mediacaoPct: v })}
          ajuda={d.mediacao > 0 ? `${euros(d.mediacao)} + IVA a ${d.taxaIva}% (${euros(d.iva)}) = ${euros(d.mediacao + d.iva)}` : `Mais o IVA em vigor (${d.taxaIva}%).`}
        />
      )}

      <div className="grelha">
        <CampoNumero rotulo="Declaração de condomínio" sufixo="€" valor={venda.declaracaoCondominio ?? null} onChange={(v) => muda({ declaracaoCondominio: v })} />
        <CampoNumero rotulo="Certificado energético" sufixo="€" valor={venda.certificadoEnergetico ?? null} onChange={(v) => muda({ certificadoEnergetico: v })} />
        <CampoNumero rotulo="Outras despesas" sufixo="€" valor={venda.outrasDespesas ?? null} onChange={(v) => muda({ outrasDespesas: v })} ajuda="Por exemplo: distrate da hipoteca, advogado, obras de última hora." />
        <CampoNumero
          rotulo="Rendas líquidas recebidas"
          sufixo="€"
          valor={venda.rendimentoLiquido}
          onChange={(v) => muda({ rendimentoLiquido: v })}
          ajuda="Se o imóvel esteve arrendado. Vem estimado pelas rendas do contrato; corrija se souber o valor."
        />
        <CampoNumero rotulo="IRS pago sobre a mais-valia" sufixo="€" valor={venda.irs} onChange={(v) => muda({ irs: v })} ajuda="Opcional, se já souber." />
        <Campo rotulo="Data de compra (escritura)" ajuda="Para calcular a TIR.">
          {(id) => <input id={id} type="date" value={dataCompra} onChange={(e) => onDataCompra(e.target.value)} />}
        </Campo>
      </div>

      <h3>Lucro realizado</h3>
      {p && venda.valor ? (
        <dl className="lista lista-direita">
          <dt>Valor de venda</dt>
          <dd>{euros(venda.valor)}</dd>
          <dt>Despesas da venda</dt>
          <dd>−{euros(d.total)}</dd>
          {(venda.irs ?? 0) > 0 && (
            <>
              <dt>IRS da mais-valia</dt>
              <dd>−{euros(venda.irs!)}</dd>
            </>
          )}
          <dt>Rendas líquidas</dt>
          <dd>+{euros(venda.rendimentoLiquido ?? 0)}</dd>
          <dt>Custo global do imóvel</dt>
          <dd>−{euros(p.custoInvestido)}</dd>
          <dt>Lucro</dt>
          <dd>
            <strong style={{ color: r ? corLucro(r.lucro) : undefined }}>
              {r ? `${comSinal(r.lucro)} (${r.roi >= 0 ? "+" : "−"}${Math.abs(r.roi).toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%)` : "—"}
            </strong>
          </dd>
        </dl>
      ) : (
        <p className="suave">Indique o valor de venda{p ? "" : " (e o valor de compra do imóvel)"} para ver o lucro.</p>
      )}
      <small className="ajuda">
        O custo global é o preço de compra, os custos de compra (IMT, imposto do selo, escritura…) e as obras já realizadas. O lucro entra no resultado da carteira global.
      </small>
    </div>
  );
}
