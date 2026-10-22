import { Ecra } from "../componentes/ui";
import { AvisoInstalacao } from "../componentes/AvisoInstalacao";

export function BoasVindas({ onComecar, onRestaurar }: { onComecar: () => void; onRestaurar: () => void }) {
  return (
    <Ecra titulo="Investimentos">
      <h2>Bem-vindo</h2>
      <p>
        Simule e acompanhe investimentos em <strong>imobiliário</strong> e <strong>ETF</strong>. Os seus dados ficam guardados e cifrados neste aparelho, e
        as cópias vão para o local que escolher.
      </p>
      <AvisoInstalacao />
      <div className="acoes">
        <button className="botao" onClick={onComecar}>
          Começar do zero
        </button>
        <button className="botao botao-secundario" onClick={onRestaurar}>
          Já tenho dados: restaurar uma cópia
        </button>
      </div>
      <p className="suave">
        Esta app é uma ferramenta de simulação. Não é aconselhamento financeiro nem fiscal.
      </p>
    </Ecra>
  );
}
