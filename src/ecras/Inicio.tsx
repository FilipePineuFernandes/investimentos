import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { AvisoInstalacao } from "../componentes/AvisoInstalacao";
import { RodapeLegal } from "../componentes/Legal";
import { diasDesdeUltimaCopia, fazerCopia, lerDefinicoesCopias, type DefinicoesCopias } from "../dados/copias";
import { descricaoDestino } from "./CopiasSeguranca";
import { dataHora, euros } from "../util/numeros";
import { totalCarteira } from "../calculo/patrimonio";
import { carregarCarteiraGlobal, type DadosCarteiraGlobal } from "./CarteiraGlobal";
import { lerNome } from "../dados/utilizador";
import { lerPerfil } from "../dados/perfil";
import { anoDaNotaNecessaria, notaDesatualizada } from "../calculo/notaIrs";
import { hojeLocal } from "../calculo/util";

export type Destino = "definicoes" | "perfil" | "copias" | "imoveis" | "etf" | "carteiraGlobal";

const cor = (n: number) => (n >= 0 ? "var(--sucesso)" : "var(--erro)");
const comSinal = (n: number) => `${n > 0 ? "+" : ""}${euros(n)}`;

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
  const [carteira, setCarteira] = useState<DadosCarteiraGlobal | null>(null);
  const [nome, setNome] = useState("");
  /** Ano da nota de liquidação de IRS que falta, quando a guardada já não serve. */
  const [notaEmFalta, setNotaEmFalta] = useState<number | null>(null);

  useEffect(() => {
    lerNome(chave).then(setNome);
    lerPerfil(chave).then((p) => setNotaEmFalta(notaDesatualizada(p?.nota, hojeLocal()) ? anoDaNotaNecessaria(hojeLocal()) : null));
    lerDefinicoesCopias(chave).then(setDef);
    carregarCarteiraGlobal(chave).then(setCarteira);
  }, [chave]);

  const [aSincronizar, setASincronizar] = useState(false);

  async function sincronizarAgora() {
    setASincronizar(true);
    await fazerCopia(chave, true);
    setDef(await lerDefinicoesCopias(chave));
    setASincronizar(false);
  }

  const total = carteira ? totalCarteira(carteira.imobiliario, carteira.etf) : null;
  const temAtivos = !!carteira && carteira.imobiliario.ativos.length + carteira.etf.ativos.length > 0;

  const dias = diasDesdeUltimaCopia(def);

  return (
    <Ecra
      titulo="Investimentos"
      acoes={
        <>
          <button className="botao-icone" onClick={() => onNavegar("definicoes")} aria-label="Definições e perfil" title="Definições e perfil">
            ⚙
          </button>
          <button
            className="botao-icone"
            onClick={onBloquear}
            aria-label="Bloquear a app"
            title={automatico ? "Bloquear e pedir a palavra-passe da próxima vez" : "Bloquear"}
          >
            🔒
          </button>
        </>
      }
    >
      {nome && <h2 style={{ marginTop: 0 }}>Olá, {nome}</h2>}
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
            <button className="botao" onClick={sincronizarAgora} disabled={aSincronizar}>
              {aSincronizar ? "A sincronizar…" : "Entrar na Google e sincronizar"}
            </button>
          </div>
        </Aviso>
      )}

      {def && (
        <button className="cartao modulo" onClick={() => onNavegar("copias")} style={{ cursor: "pointer" }}>
          <h3>Onde estão os meus dados</h3>
          <p className="suave">
            {def.destino === "googleDrive" ? "Sincronizado com" : "Cópias"}: {descricaoDestino(def)}
            {def.ultimaCopiaComSucesso ? ` · última a ${dataHora(def.ultimaCopiaComSucesso)}` : def.destino === "googleDrive" ? " · ainda sem sincronizar" : " · ainda sem cópias"}
          </p>
          {dias > 7 && def.destino !== "googleDrive" && <Aviso tipo="atencao">{dias === Infinity ? "Faça a primeira cópia dos seus dados." : `A última cópia tem ${Math.floor(dias)} dias.`}</Aviso>}
        </button>
      )}

      <button className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onNavegar("carteiraGlobal")}>
        <h3>Carteira global</h3>
        {temAtivos && total && carteira ? (
          <>
            <p className="suave">Lucro líquido desde a aquisição</p>
            <p style={{ fontSize: "1.6rem", fontWeight: 700, color: cor(total.lucro) }}>{comSinal(total.lucro)}</p>
            <p>
              Imobiliário <strong style={{ color: cor(carteira.imobiliario.lucro) }}>{comSinal(carteira.imobiliario.lucro)}</strong> · ETF{" "}
              <strong style={{ color: cor(carteira.etf.lucro) }}>{comSinal(carteira.etf.lucro)}</strong>
            </p>
          </>
        ) : (
          <p className="suave">Imóveis e ETF em posse, com o lucro líquido de cada um desde a aquisição.</p>
        )}
      </button>

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
      </div>

      <div className="acoes">
        <button className="botao botao-secundario" onClick={() => onNavegar("definicoes")}>
          Definições e perfil
        </button>
      </div>
      <RodapeLegal />
    </Ecra>
  );
}
