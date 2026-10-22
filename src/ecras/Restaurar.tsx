import { useState } from "react";
import { Aviso, Campo, Ecra } from "../componentes/ui";
import { EXTENSAO, restaurarCopia } from "../dados/copias";
import { dataHora } from "../util/numeros";

/** Restaura a partir de um ficheiro de cópia. Substitui tudo o que existe neste aparelho. */
export function Restaurar({ voltar, onRestaurado, substituiDados }: { voltar: () => void; onRestaurado: (info: string) => void; substituiDados: boolean }) {
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [confirmo, setConfirmo] = useState(!substituiDados);
  const [aRestaurar, setARestaurar] = useState(false);
  const [erro, setErro] = useState("");

  async function restaurar() {
    if (!ficheiro) return;
    setARestaurar(true);
    setErro("");
    try {
      const r = await restaurarCopia(await ficheiro.text());
      onRestaurado(`Cópia de ${dataHora(r.criadoEm)} restaurada. Introduza a palavra-passe que usava quando a cópia foi feita.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setARestaurar(false);
    }
  }

  return (
    <Ecra titulo="Restaurar uma cópia" voltar={voltar}>
      <p>
        Escolha um ficheiro de cópia (<code>{EXTENSAO}</code>). Pode estar no Google Drive, no Dropbox, numa pasta do computador ou nas transferências.
      </p>
      <p className="suave">O restauro a partir de uma conta Google Drive ou Dropbox ligada chega com a cópia automática na nuvem (fase 5).</p>
      <div className="cartao">
        <Campo rotulo="Ficheiro de cópia">
          {(id) => <input id={id} type="file" accept={`${EXTENSAO},application/octet-stream,application/json`} onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)} />}
        </Campo>
        {substituiDados && (
          <>
            <Aviso tipo="atencao" titulo="Atenção">
              Restaurar <strong>substitui todos os dados</strong> deste aparelho pelos da cópia. Se quiser guardar os dados atuais, descarregue antes uma cópia.
            </Aviso>
            <label className="caixa">
              <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
              <span>Quero substituir os dados deste aparelho.</span>
            </label>
          </>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <button className="botao" disabled={!ficheiro || !confirmo || aRestaurar} onClick={restaurar}>
          {aRestaurar ? "A restaurar…" : "Restaurar"}
        </button>
      </div>
    </Ecra>
  );
}
