import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { diaISO } from "../calculo/carteira";
import { precisaRevisao } from "../calculo/etf";
import { listarETF, type ETF } from "../dados/etf";

export function EtfInicio({ chave, voltar, onNavegar }: { chave: CryptoKey; voltar: () => void; onNavegar: (d: "etfCatalogo" | "etfSimulacao") => void }) {
  const [catalogo, setCatalogo] = useState<ETF[] | null>(null);
  const hoje = diaISO(new Date());

  useEffect(() => {
    listarETF(chave).then(setCatalogo);
  }, [chave]);

  const aRever = catalogo?.filter((e) => precisaRevisao(e, hoje)).length ?? 0;

  return (
    <Ecra titulo="ETF" voltar={voltar}>
      <div className="grelha">
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfSimulacao")}>
          <h3>Nova simulação</h3>
          <p className="suave">Valor a investir, propostas, escolha e projeção a 4%, 6%, 8% e 10%, com custos e impostos.</p>
        </button>
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etfCatalogo")}>
          <h3>Catálogo</h3>
          <p className="suave">{catalogo === null ? "A carregar…" : `${catalogo.length} ETF no seu catálogo.`}</p>
          {aRever > 0 && <Aviso tipo="atencao">{aRever} com dados a rever.</Aviso>}
        </button>
        <div className="cartao modulo">
          <h3>Carteira</h3>
          <p className="suave">Registo das compras, valor atual e ganhos.</p>
          <Aviso>No próximo passo.</Aviso>
        </div>
        <div className="cartao modulo">
          <h3>Zona de dúvidas</h3>
          <p className="suave">Spread, TER, impostos, acumulação ou distribuição, domicílio, KID.</p>
          <Aviso>No próximo passo.</Aviso>
        </div>
      </div>
    </Ecra>
  );
}
