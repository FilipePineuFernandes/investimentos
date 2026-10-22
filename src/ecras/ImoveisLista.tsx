import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
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
  const carteira = lista?.filter((x) => naCarteira(x.i)) ?? [];

  return (
    <Ecra titulo="Imobiliário" voltar={voltar}>
      <button className="botao" onClick={() => onAbrir(null)}>
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
              ...(resumo.vendidos > 0
                ? [{ rotulo: "Lucro realizado", valor: comSinal(resumo.lucroRealizado), cor: sinal(resumo.lucroRealizado), nota: `${resumo.vendidos} ${resumo.vendidos === 1 ? "vendido" : "vendidos"}` }]
                : []),
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
          {carteira.map(({ i, a }) => (
            <CartaoImovel key={i.id} i={i} a={a} hoje={hoje} onAbrir={onAbrir} />
          ))}
        </>
      )}

      {emAnalise.length > 0 && (
        <>
          <h2>Em análise</h2>
          {emAnalise.map(({ i, a }) => (
            <CartaoImovel key={i.id} i={i} a={a} hoje={hoje} onAbrir={onAbrir} />
          ))}
        </>
      )}

      <p className="suave">Estratégias: revenda, arrendamento, reconstrução e cedência de posição. Para armazéns, escolha o destino comercial ou industrial.</p>
    </Ecra>
  );
}

function CartaoImovel({ i, a, hoje, onAbrir }: { i: Imovel; a: AnaliseImovel; hoje: string; onAbrir: (id: string) => void }) {
  const p = naCarteira(i) && i.estado !== "vendido" ? posicao(i, a, hoje) : null;
  return (
    <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onAbrir(i.id)}>
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
    </button>
  );
}
