import { Ecra } from "../componentes/ui";
import { AvisoInstalacao } from "../componentes/AvisoInstalacao";
import { RodapeLegal } from "../componentes/Legal";
import { Logotipo } from "../componentes/Logotipo";

export function BoasVindas({ onComecar, onRestaurar, onDrive }: { onComecar: () => void; onRestaurar: () => void; onDrive: () => void }) {
  return (
    <Ecra titulo="Investimentos">
      <Logotipo />
      <h2>Bem-vindo</h2>
      <p>
        Simule e acompanhe investimentos em <strong>imobiliário</strong> e <strong>ETF</strong>. Os seus dados ficam guardados e cifrados neste aparelho, e
        as cópias vão para o local que escolher.
      </p>
      <AvisoInstalacao />
      <div className="acoes">
        <button data-icone="seguinte" className="botao" onClick={onComecar}>
          Começar do zero
        </button>
        <button data-icone="nuvem" className="botao botao-secundario" onClick={onDrive}>
          Já tenho dados no Google Drive
        </button>
        <button data-icone="restaurar" className="botao botao-secundario" onClick={onRestaurar}>
          Já tenho dados: restaurar uma cópia
        </button>
      </div>
      <RodapeLegal />
    </Ecra>
  );
}
