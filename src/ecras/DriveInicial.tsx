import { useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { trazerDoDrive } from "../nuvem/sincronizar";
import { iniciarEntrada } from "../nuvem/googleDrive";
import { useGoogle } from "../nuvem/useGoogle";

/** Aparelho novo: traz os dados que já estão no Google Drive. Depois só falta a palavra-passe. */
export function DriveInicial({ voltar, onTrazido }: { voltar: () => void; onTrazido: (mensagem: string) => void }) {
  const [aTrabalhar, setATrabalhar] = useState(false);
  const [erro, setErro] = useState("");

  const google = useGoogle();

  async function entrar() {
    iniciarEntrada(true); // a janela da Google tem de abrir no instante do toque
    setATrabalhar(true);
    setErro("");
    const r = await trazerDoDrive();
    if (r.ok) {
      onTrazido(`Dados trazidos do Google Drive${r.conta ? ` (${r.conta})` : ""}. Introduza a palavra-passe que usa nesses dados. Não será preciso preencher mais nada.`);
    } else {
      setErro(r.erro);
      setATrabalhar(false);
    }
  }

  return (
    <Ecra titulo="Entrar com o Google Drive" voltar={aTrabalhar ? undefined : voltar}>
      <p>
        Entre na conta Google onde guardou os dados. A app traz tudo o que lá está (perfil, imóveis, ETF, nota de IRS e corretora) e pede <strong>apenas a
        palavra-passe</strong>.
      </p>
      <p className="suave">
        A janela de entrada é da própria Google: a app nunca vê a sua palavra-passe da Google. Só acede ao ficheiro que ela própria criou, e esse ficheiro
        está cifrado.
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <button className="botao" onClick={entrar} disabled={aTrabalhar || google !== "pronto"}>
        {aTrabalhar ? "A trazer os dados…" : google === "a-carregar" ? "A preparar a Google…" : google === "falhou" ? "Sem ligação à Google" : "Entrar com a Google"}
      </button>
    </Ecra>
  );
}

export function ASincronizar() {
  return (
    <Ecra titulo="Investimentos">
      <p>A sincronizar com o Google Drive…</p>
    </Ecra>
  );
}
