import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { diaISO } from "../calculo/carteira";
import { precisaRevisao } from "../calculo/etf";
import { listarETF, type ETF } from "../dados/etf";

export function EtfInicio({ chave, voltar, onNavegar }: { chave: CryptoKey; voltar: () => void; onNavegar: (d: "etfCatalogo" | "etfSimulacao" | "etfCarteira" | "etfDuvidas") => void }) {
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
        <p>Catálogo, distribuição, carteira, simulação a 4%, 6%, 8% e 10%, comparador e propostas.</p>
        <p>Disponível: catálogo, novo ETF, carteira e zona de dúvidas.</p>
      </details>
      <div className="grelha">
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfSimulacao")}>
          <h3>Novo ETF</h3>
          <p className="suave">Escolha o setor e a região, depois o ETF e só então o montante, com a projeção a 4%, 6%, 8% e 10%, custos e impostos.</p>
        </button>
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfCatalogo")}>
          <h3>Catálogo</h3>
          <p className="suave">{catalogo === null ? "A carregar…" : `${catalogo.length} ETF no seu catálogo.`}</p>
          {aRever > 0 && <Aviso tipo="atencao">{aRever} com dados a rever.</Aviso>}
        </button>
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfCarteira")}>
          <h3>Carteira</h3>
          <p className="suave">Compras, vendas e dividendos, valor atual, ganhos, distribuição e IRS das vendas.</p>
        </button>
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfDuvidas")}>
          <h3>Zona de dúvidas</h3>
          <p className="suave">Spread, TER, impostos, acumulação ou distribuição, domicílio, KID.</p>
        </button>
      </div>
    </Ecra>
  );
}
