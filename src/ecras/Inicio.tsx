import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { AvisoInstalacao } from "../componentes/AvisoInstalacao";
import { diasDesdeUltimaCopia, lerDefinicoesCopias, type DefinicoesCopias } from "../dados/copias";
import { descricaoDestino } from "./CopiasSeguranca";
import { dataHora } from "../util/numeros";

export type Destino = "perfil" | "copias" | "parametros" | "imoveis" | "etf";

export function Inicio({ chave, onNavegar, onBloquear }: { chave: CryptoKey; onNavegar: (d: Destino) => void; onBloquear: () => void }) {
  const [def, setDef] = useState<DefinicoesCopias | undefined>();

  useEffect(() => {
    lerDefinicoesCopias(chave).then(setDef);
  }, [chave]);

  const dias = diasDesdeUltimaCopia(def);

  return (
    <Ecra
      titulo="Investimentos"
      acoes={
        <button className="botao-icone" onClick={onBloquear} aria-label="Bloquear a app" title="Bloquear">
          🔒
        </button>
      }
    >
      <AvisoInstalacao />

      {def && (
        <button className="cartao modulo" onClick={() => onNavegar("copias")} style={{ cursor: "pointer" }}>
          <h3>Onde estão os meus dados</h3>
          <p className="suave">
            Cópias: {descricaoDestino(def)}
            {def.ultimaCopiaComSucesso ? ` · última a ${dataHora(def.ultimaCopiaComSucesso)}` : " · ainda sem cópias"}
          </p>
          {dias > 7 && <Aviso tipo="atencao">{dias === Infinity ? "Faça a primeira cópia dos seus dados." : `A última cópia tem ${Math.floor(dias)} dias.`}</Aviso>}
        </button>
      )}

      <h2>Áreas</h2>
      <div className="grelha">
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("imoveis")}>
          <h3>Imobiliário</h3>
          <p className="suave">Revenda, arrendamento, reconstrução, cedência de posição e armazéns.</p>
          <Aviso>Disponível: imóveis, custos de compra, financiamento e as cinco estratégias.</Aviso>
        </button>
        <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("etf")}>
          <h3>ETF</h3>
          <p className="suave">Catálogo, distribuição, carteira, simulação a 4%, 6%, 8% e 10%, comparador e propostas.</p>
          <Aviso>Disponível: catálogo, simulação, carteira e zona de dúvidas.</Aviso>
        </button>
        <div className="cartao modulo">
          <h3>Património consolidado</h3>
          <p className="suave">Total, dívida, património líquido e rendimento passivo.</p>
          <Aviso>Mais tarde.</Aviso>
        </div>
      </div>

      <h2>Definições</h2>
      <div className="acoes">
        <button className="botao botao-secundario" onClick={() => onNavegar("perfil")}>
          Perfil do investidor
        </button>
        <button className="botao botao-secundario" onClick={() => onNavegar("copias")}>
          Onde estão os meus dados
        </button>
        <button className="botao botao-secundario" onClick={() => onNavegar("parametros")}>
          Parâmetros fiscais
        </button>
      </div>
      <p className="suave">Ferramenta de simulação. Não é aconselhamento financeiro nem fiscal.</p>
    </Ecra>
  );
}
