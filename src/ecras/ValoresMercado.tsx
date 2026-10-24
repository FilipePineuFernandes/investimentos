// Valores de mercado do imóvel (5.3, nível 1: dados oficiais do INE) e projeção do valor a
// 1, 2 e 3 anos com cenários a partir do histórico (5.5).

import { Aviso } from "../componentes/ui";
import { Selo } from "../componentes/Selo";
import { cenarios, projetar, valorRenda, valorVenda, type ValorIne } from "../calculo/mercado";
import { diaISO } from "../calculo/carteira";
import type { Imovel } from "../dados/imoveis";
import { nomePeriodo, type DadosIne } from "../dados/ine";
import { euros } from "../util/numeros";

const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
const eurosInteiros = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const onde = (v: ValorIne) => (v.nivel === "freguesia" ? `freguesia de ${v.nome}` : `município de ${v.nome} (a freguesia não tem dados suficientes)`);

export function ValoresMercado({ i, ine }: { i: Imovel; ine: DadosIne | null | undefined }) {
  if (ine === undefined) return null;
  if (ine === null) return <Aviso>Os dados do INE não estão disponíveis neste momento. Volte a abrir a app com internet.</Aviso>;
  const local = { municipio: i.geoMunicipio ?? null, freguesia: i.geoFreguesia ?? null };
  if (!local.municipio && !local.freguesia) return <Aviso>Escolha o município e a freguesia para ver os valores de mercado do INE.</Aviso>;

  const hoje = diaISO(new Date());
  const venda = valorVenda(ine, local, i.area, i.conservacao, hoje);
  const renda = i.destino === "comercial" ? null : valorRenda(ine, local, i.area, hoje);
  const c = cenarios(ine, local);
  const atualizado = (iso: string) => `atualizado pelo INE a ${new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT")}`;
  const diferenca = venda?.total && i.preco ? ((i.preco - venda.total) / venda.total) * 100 : null;

  return (
    <>
      <h2>Valores de mercado</h2>
      <div className="cartao">
        <h3>Venda (preço de transação)</h3>
        {venda ? (
          <>
            <p>
              <strong>{euros(venda.m2)}/m²</strong>
              {venda.total !== null && (
                <>
                  {" "}
                  × {i.area} m² = <strong>{euros(venda.total)}</strong>
                </>
              )}
            </p>
            <p className="suave">
              Mediana dos últimos 12 meses ({venda.categoria === "novos" ? "alojamentos novos" : venda.categoria === "existentes" ? "alojamentos existentes" : "todos os alojamentos"}),{" "}
              {onde(venda)}.
              {diferenca !== null && ` O seu valor de compra está ${pct(Math.round(diferenca * 10) / 10)} face a esta referência.`}
            </p>
            <Selo fonte="INE" periodo={nomePeriodo(venda.periodo)} data={atualizado(ine.vendas.atualizadoEm)} desatualizado={venda.desatualizado} />
          </>
        ) : (
          <p>
            <strong>Não encontrado.</strong> <span className="suave">O INE não publica valores para esta zona (menos de 15 vendas em 12 meses).</span>
          </p>
        )}

        {i.destino !== "comercial" && (
          <>
            <h3>Renda (novos contratos)</h3>
            {renda ? (
              <>
                <p>
                  <strong>{euros(renda.m2)}/m² por mês</strong>
                  {renda.total !== null && (
                    <>
                      {" "}
                      × {i.area} m² = <strong>{euros(renda.total)} por mês</strong>
                    </>
                  )}
                </p>
                <p className="suave">Mediana dos novos contratos nos últimos 12 meses, {onde(renda)}.</p>
                <Selo fonte="INE" periodo={nomePeriodo(renda.periodo)} data={atualizado(ine.rendas.atualizadoEm)} desatualizado={renda.desatualizado} />
              </>
            ) : (
              <p>
                <strong>Não encontrado.</strong> <span className="suave">O INE não publica rendas para esta zona.</span>
              </p>
            )}
          </>
        )}
        {i.destino === "comercial" && <small className="ajuda">Para armazéns e espaços comerciais, o INE não publica valores: use comparáveis.</small>}
      </div>

      {i.destino !== "comercial" && (
        <>
          <h3>Projeção do valor</h3>
          {!i.preco ? (
            <Aviso>Indique o valor de compra para ver a projeção.</Aviso>
          ) : !c ? (
            <Aviso>Não encontrado: a zona não tem 5 anos de histórico no INE.</Aviso>
          ) : (
            <div className="cartao tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Se o mercado…</th>
                    <th style={{ textAlign: "right" }}>1 ano</th>
                    <th style={{ textAlign: "right" }}>2 anos</th>
                    <th style={{ textAlign: "right" }}>3 anos</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      // Os nomes dizem o que cada cenário é. A média de 3 anos pode ser mais baixa do que a de 5,
                      // quando o mercado abrandou, por isso não se lhe chama "otimista".
                      ["repetir o pior ano recente", c.pessimista],
                      ["mantiver a média de 5 anos", c.base],
                      ["mantiver a média de 3 anos", c.otimista],
                    ] as const
                  ).map(([nome, taxa]) => (
                    <tr key={nome}>
                      <td>
                        {nome}
                        <div className="suave">{pct(taxa)} por ano</div>
                      </td>
                      {[1, 2, 3].map((n) => (
                        <td key={n} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {eurosInteiros(projetar(i.preco!, taxa, n))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="suave">
                A partir do valor de compra. Variações anuais da mediana de venda {c.nivel === "freguesia" ? "na freguesia" : "no município"} de {c.nome}:{" "}
                {c.variacoes.map((v) => `${pct(v.taxa)} (${nomePeriodo(v.periodo)})`).join(", ")}.
              </p>
              <Aviso tipo="atencao">Projeção com base em dados históricos, não é uma previsão.</Aviso>
            </div>
          )}
        </>
      )}
    </>
  );
}
