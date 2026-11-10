import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { diaISO } from "../calculo/carteira";
import { precisaRevisao } from "../calculo/etf";
import { listarETF, type ETF } from "../dados/etf";
import { ConteudoDuvidas } from "./EtfDuvidas";

export function EtfInicio({ chave, voltar, onNavegar }: { chave: CryptoKey; voltar: () => void; onNavegar: (d: "etfCatalogo" | "etfNovo" | "etfCarteira") => void }) {
  const [catalogo, setCatalogo] = useState<ETF[] | null>(null);
  const hoje = diaISO(new Date());

  useEffect(() => {
    listarETF(chave).then(setCatalogo);
  }, [chave]);

  const aRever = catalogo?.filter((e) => precisaRevisao(e, hoje)).length ?? 0;

  return (
    <Ecra titulo="ETF" voltar={voltar}>
      <details className="cartao texto-verde">
        <summary>Sobre esta área</summary>
        <p>Carteira com as compras e vendas, catálogo pessoal de ETF e pesquisa de novos ETF negociados na Xetra.</p>
        <p>No catálogo pode também simular um investimento, com a projeção a 4%, 6%, 8% e 10%, custos e impostos.</p>
      </details>
      <div className="grelha">
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfCarteira")}>
          <h3>Carteira</h3>
          <p className="suave">Compras e valor de compra, unidades, cotação de hoje, ganhos, distribuição e IRS das vendas.</p>
        </button>
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfCatalogo")}>
          <h3>Catálogo</h3>
          <p className="suave">{catalogo === null ? "A carregar…" : `${catalogo.length} ETF no seu catálogo.`}</p>
          {aRever > 0 && <Aviso tipo="atencao">{aRever} com dados a rever.</Aviso>}
        </button>
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfNovo")}>
          <h3>Novo ETF</h3>
          <p className="suave">Procure ETF da Xetra pelo índice, região, setor, código ou ISIN, veja os dados e acrescente-os ao catálogo.</p>
        </button>
      </div>

      <details className="cartao">
        <summary>Zona de dúvidas</summary>
        <p className="suave">Spread, TER, impostos, acumulação ou distribuição, domicílio, KID.</p>
        <ConteudoDuvidas />
      </details>
    </Ecra>
  );
}
