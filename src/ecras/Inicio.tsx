import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { Icone } from "../componentes/Icone";
import { AvisoInstalacao } from "../componentes/AvisoInstalacao";
import { RodapeLegal } from "../componentes/Legal";
import { diasDesdeUltimaCopia, fazerCopia, lerDefinicoesCopias, type DefinicoesCopias } from "../dados/copias";
import { lerNome } from "../dados/utilizador";
import { lerPerfil } from "../dados/perfil";
import { anoDaNotaNecessaria, notaDesatualizada } from "../calculo/notaIrs";
import { hojeLocal } from "../calculo/util";
import { iniciarEntrada } from "../nuvem/googleDrive";
import { useGoogle } from "../nuvem/useGoogle";

export type Destino = "definicoes" | "perfil" | "copias" | "imoveis" | "etf" | "carteiraGlobal";

export function Inicio({
  chave,
  onNavegar,
  onBloquear,
  automatico,
}: {
  chave: CryptoKey;
  onNavegar: (d: Destino) => void;
  onBloquear: () => void;
  /** A app abre sozinha neste aparelho. */
  automatico: boolean;
}) {
  const [def, setDef] = useState<DefinicoesCopias | undefined>();
  const [nome, setNome] = useState("");
  /** Ano da nota de liquidação de IRS que falta, quando a guardada já não serve. */
  const [notaEmFalta, setNotaEmFalta] = useState<number | null>(null);

  useEffect(() => {
    lerNome(chave).then(setNome);
    lerPerfil(chave).then((p) => setNotaEmFalta(notaDesatualizada(p?.nota, hojeLocal()) ? anoDaNotaNecessaria(hojeLocal()) : null));
    lerDefinicoesCopias(chave).then(setDef);
  }, [chave]);

  const [aSincronizar, setASincronizar] = useState(false);

  const google = useGoogle(def?.destino === "googleDrive");

  async function sincronizarAgora() {
    iniciarEntrada();
    setASincronizar(true);
    await fazerCopia(chave, true);
    setDef(await lerDefinicoesCopias(chave));
    setASincronizar(false);
  }

  const dias = diasDesdeUltimaCopia(def);

  return (
    <Ecra
      titulo="Investimentos"
      acoes={
        <>
          <button className="botao-icone" onClick={() => onNavegar("copias")} aria-label="Onde estão os meus dados" title="Onde estão os meus dados">
            <Icone nome="dados" />
          </button>
          <button
            className="botao-icone"
            onClick={onBloquear}
            aria-label="Bloquear a app"
            title={automatico ? "Bloquear e pedir a palavra-passe da próxima vez" : "Bloquear"}
          >
            <Icone nome="bloquear" />
          </button>
        </>
      }
    >
      {nome && (
        <h2 className="saudacao" style={{ marginTop: 0 }}>
          Olá, {nome}
        </h2>
      )}
      <AvisoInstalacao />

      {notaEmFalta !== null && (
        <Aviso tipo="atencao" titulo="Falta a nota de liquidação de IRS">
          A nota guardada já não é a mais recente. Envie a nota de liquidação dos rendimentos de {notaEmFalta} para as contas de IRS usarem os valores certos.
          <div className="acoes">
            <button className="botao" onClick={() => onNavegar("perfil")}>
              Abrir o perfil
            </button>
          </div>
        </Aviso>
      )}

      {def?.destino === "googleDrive" && def.ultimaCopia && !def.ultimaCopia.ok && (
        <Aviso tipo="atencao" titulo="Sem sincronizar com o Google Drive">
          {def.ultimaCopia.erro} Os dados continuam guardados neste aparelho.
          <div className="acoes">
            <button className="botao" onClick={sincronizarAgora} disabled={aSincronizar || google === "a-carregar"}>
              {aSincronizar ? "A sincronizar…" : google === "a-carregar" ? "A preparar a Google…" : "Entrar na Google e sincronizar"}
            </button>
          </div>
        </Aviso>
      )}

      {def && def.destino !== "googleDrive" && dias > 7 && (
        <Aviso tipo="atencao" titulo="Cópia de segurança">
          {dias === Infinity ? "Faça a primeira cópia dos seus dados." : `A última cópia tem ${Math.floor(dias)} dias.`}
          <div className="acoes">
            <button className="botao" onClick={() => onNavegar("copias")}>
              Abrir «Onde estão os meus dados»
            </button>
          </div>
        </Aviso>
      )}

      <h2 className="titulo-verde">Áreas de investimento</h2>
      <div className="duas-areas">
        <button className="area-botao" onClick={() => onNavegar("carteiraGlobal")}>
          <span className="area-simbolo" aria-hidden="true">
            <Icone nome="carteira" />
          </span>
          <span className="area-nome">Carteira global</span>
        </button>
        <button className="area-botao" onClick={() => onNavegar("imoveis")}>
          <span className="area-simbolo" aria-hidden="true">
            <Icone nome="imobiliario" />
          </span>
          <span className="area-nome">Imobiliário</span>
        </button>
        <button className="area-botao" onClick={() => onNavegar("etf")}>
          <span className="area-simbolo" aria-hidden="true">
            <Icone nome="etf" />
          </span>
          <span className="area-nome">ETF</span>
        </button>
        <button className="area-botao" onClick={() => onNavegar("definicoes")}>
          <span className="area-simbolo" aria-hidden="true">
            <Icone nome="definicoes" />
          </span>
          <span className="area-nome">Definições e perfil</span>
        </button>
      </div>

      <RodapeLegal />
    </Ecra>
  );
}
