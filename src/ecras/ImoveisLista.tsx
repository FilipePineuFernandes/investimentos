import { useEffect, useState } from "react";
import { Abrivel } from "../componentes/Abrivel";
import { Aviso, Ecra } from "../componentes/ui";
import { Icone } from "../componentes/Icone";
import { GraficoLinha } from "../componentes/GraficoLinha";
import { Indicadores } from "../componentes/Indicadores";
import { diaISO, evolucaoCarteira, posicao, resumoCarteira } from "../calculo/carteira";
import { analisarImovel, type AnaliseImovel } from "../calculo/imovel";
import { listarImoveis, naCarteira, NOMES_DESTINO, NOMES_ESTADO, type Imovel } from "../dados/imoveis";
import { lerPerfil } from "../dados/perfil";
import { euros } from "../util/numeros";
import { pct, sinal } from "./Estrategias";

const comSinal = (n: number) => `${n >= 0 ? "+" : "−"}${euros(Math.abs(n))}`;

/** Imobiliário: resumo da carteira e lista dos imóveis guardados. */
export function ImoveisLista({ chave, voltar, onAbrir }: { chave: CryptoKey; voltar: () => void; onAbrir: (id: string | null) => void }) {
  const [lista, setLista] = useState<{ i: Imovel; a: AnaliseImovel }[] | null>(null);

  useEffect(() => {
    (async () => {
      const [imoveis, perfil] = await Promise.all([listarImoveis(chave), lerPerfil(chave)]);
      setLista(imoveis.map((i) => ({ i, a: analisarImovel(i, perfil) })));
    })();
  }, [chave]);

  const hoje = diaISO(new Date());
  const resumo = lista ? resumoCarteira(lista, hoje) : null;
  const evolucao = lista ? evolucaoCarteira(lista.map((x) => x.i), hoje) : [];
  const emAnalise = lista?.filter((x) => !naCarteira(x.i)) ?? [];
  const carteira = lista?.filter((x) => naCarteira(x.i) && x.i.estado !== "vendido") ?? [];
  const vendidos = lista?.filter((x) => x.i.estado === "vendido") ?? [];

  return (
    <Ecra titulo="Imobiliário" voltar={voltar}>
      <details className="cartao">
        <summary>Sobre esta área</summary>
        <p className="suave">Revenda, arrendamento, reconstrução, cedência de posição e armazéns.</p>
        <Aviso>Disponível: imóveis, custos de compra, financiamento e as cinco estratégias.</Aviso>
      </details>

      <button className="botao botao-verde" onClick={() => onAbrir(null)}>
        Novo imóvel
      </button>

      {lista === null && <p className="suave">A carregar…</p>}
      {lista?.length === 0 && <Aviso>Ainda não tem imóveis. Comece por registar um que esteja a analisar.</Aviso>}

      {resumo && carteira.length > 0 && (
        <>
          <h2>Carteira</h2>
          <Indicadores
            itens={[
              { rotulo: "Valor atual", valor: euros(resumo.valorAtual), nota: `${resumo.imoveis} ${resumo.imoveis === 1 ? "imóvel" : "imóveis"}` },
              { rotulo: "Mais-valia latente", valor: comSinal(resumo.maisValiaLatente), cor: sinal(resumo.maisValiaLatente), nota: `Sobre ${euros(resumo.custoInvestido)} investidos` },
              { rotulo: "Dívida", valor: euros(resumo.divida) },
              { rotulo: "Capital próprio", valor: euros(resumo.capitalProprio), nota: "Valor atual − dívida" },
            ]}
          />
          {resumo.semDataCompra > 0 && (
            <Aviso tipo="atencao">
              {resumo.semDataCompra} {resumo.semDataCompra === 1 ? "imóvel com crédito não tem" : "imóveis com crédito não têm"} data de compra: a dívida não entra no total.
            </Aviso>
          )}
          {evolucao.length >= 2 && (
            <div className="cartao">
              <h3>Evolução do valor da carteira</h3>
              <GraficoLinha pontos={evolucao} descricao="Evolução do valor da carteira imobiliária" />
              <small className="ajuda">Em cada data, o último valor conhecido de cada imóvel que era seu.</small>
            </div>
          )}
          <div className="duas-areas">
            {carteira.map(({ i }) => (
              <CartaoImovel key={i.id} i={i} onAbrir={onAbrir} />
            ))}
          </div>
        </>
      )}

      {emAnalise.length > 0 && (
        <>
          <h2>Em análise</h2>
          <div className="duas-areas">
            {emAnalise.map(({ i }) => (
              <CartaoImovel key={i.id} i={i} onAbrir={onAbrir} />
            ))}
          </div>
        </>
      )}

      {lista !== null && (
        <Abrivel titulo="Histórico de imóveis">
          {vendidos.length === 0 ? (
            <p className="suave">Ainda não vendeu nenhum imóvel. Os imóveis vendidos ficam aqui, só como informação, e deixam de contar para a carteira.</p>
          ) : (
            <>
              <p className="suave">Imóveis vendidos: ficam aqui só como informação e já não contam para a carteira.</p>
              {resumo && resumo.lucroRealizado !== 0 && (
                <p>
                  <span className="rotulo-verde">Lucro realizado:</span> <strong style={{ color: sinal(resumo.lucroRealizado) }}>{comSinal(resumo.lucroRealizado)}</strong>
                </p>
              )}
              <div className="duas-areas">
                {vendidos.map(({ i }) => (
                  <CartaoImovel key={i.id} i={i} onAbrir={onAbrir} />
                ))}
              </div>
            </>
          )}
        </Abrivel>
      )}

      <p className="suave">Estratégias: revenda, arrendamento, reconstrução e cedência de posição. Para armazéns, escolha o destino comercial ou industrial.</p>
    </Ecra>
  );
}

/** Cada imóvel é só um símbolo com o nome; ao tocar abre a ficha, que começa pela descrição. */
function CartaoImovel({ i, onAbrir }: { i: Imovel; onAbrir: (id: string) => void }) {
  return (
    <button className={`area-botao${i.estado === "vendido" ? " vendido" : ""}`} onClick={() => onAbrir(i.id)}>
      <span className="area-simbolo" aria-hidden="true">
        <Icone nome="imobiliario" />
      </span>
      <span className="area-nome">{i.nome || "Imóvel sem nome"}</span>
      {i.estado === "vendido" && i.carteira?.venda?.data && <span className="area-nota">Vendido a {new Date(`${i.carteira.venda.data}T00:00:00`).toLocaleDateString("pt-PT")}</span>}
    </button>
  );
}

/** A descrição do imóvel (estado, destino, zona e valor), mostrada no topo da ficha. */
export function DescricaoImovel({ i, a, hoje }: { i: Imovel; a: AnaliseImovel; hoje: string }) {
  const p = naCarteira(i) && i.estado !== "vendido" ? posicao(i, a, hoje) : null;
  return (
    <div className="cartao">
      <h3>{i.nome || "Imóvel sem nome"}</h3>
      <p className="suave">
        {NOMES_ESTADO[i.estado]} · {NOMES_DESTINO[i.destino]}
        {i.municipio && ` · ${i.municipio}`}
      </p>
      {p ? (
        <p>
          {euros(p.valorAtual)}{" "}
          <span style={{ color: sinal(p.maisValiaLatente) }}>
            ({comSinal(p.maisValiaLatente)}, {pct(p.maisValiaPct)})
          </span>
        </p>
      ) : (
        <p>{i.preco ? euros(i.preco) : "Sem valor de compra"}</p>
      )}
    </div>
  );
}
