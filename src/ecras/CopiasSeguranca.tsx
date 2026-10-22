import { useEffect, useState } from "react";
import { Aviso, CampoNumero, Ecra } from "../componentes/ui";
import {
  autorizacaoPasta,
  DEFINICOES_PADRAO,
  descarregar,
  diasDesdeUltimaCopia,
  fazerCopia,
  gerarFicheiroCopia,
  guardarDefinicoesCopias,
  lerDefinicoesCopias,
  nomeFicheiroCopia,
  pastaGuardada,
  type DefinicoesCopias,
} from "../dados/copias";
import { dataHora, tamanho } from "../util/numeros";

export function descricaoDestino(d: DefinicoesCopias): string {
  switch (d.destino) {
    case "pasta":
      return `pasta "${d.nomePasta ?? "?"}" neste computador`;
    case "aparelho":
      return "só neste aparelho, com cópias descarregadas";
    case "googleDrive":
      return "Google Drive";
    case "dropbox":
      return "Dropbox";
  }
}

const NOMES: Record<DefinicoesCopias["destino"], string> = {
  pasta: "Pasta no computador",
  aparelho: "Só neste aparelho (cópias descarregadas)",
  googleDrive: "Google Drive",
  dropbox: "Dropbox",
};

/** Ecrã "Onde estão os meus dados" (ponto 9.4 da especificação). */
export function CopiasSeguranca({
  chave,
  voltar,
  onAlterarLocal,
  onRestaurar,
}: {
  chave: CryptoKey;
  voltar: () => void;
  onAlterarLocal: () => void;
  onRestaurar: () => void;
}) {
  const [def, setDef] = useState<DefinicoesCopias | null>(null);
  const [pastaLigada, setPastaLigada] = useState<boolean | null>(null);
  const [persistente, setPersistente] = useState<boolean | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [aCopiar, setACopiar] = useState(false);

  async function recarregar() {
    const d = (await lerDefinicoesCopias(chave)) ?? DEFINICOES_PADRAO;
    setDef(d);
    if (d.destino === "pasta") {
      const p = await pastaGuardada();
      setPastaLigada(p ? await autorizacaoPasta(p, false) : false);
    }
  }

  useEffect(() => {
    recarregar();
    navigator.storage?.persisted?.().then(setPersistente).catch(() => setPersistente(null));
  }, []);

  async function copiarAgora() {
    setACopiar(true);
    setMensagem(null);
    const r = await fazerCopia(chave, true);
    setMensagem(r.ok ? { tipo: "sucesso", texto: `Cópia feita: ${r.nomeFicheiro}` } : { tipo: "erro", texto: r.erro });
    await recarregar();
    setACopiar(false);
  }

  async function descarregarAgora() {
    setMensagem(null);
    try {
      await descarregar(nomeFicheiroCopia(), await gerarFicheiroCopia());
      setMensagem({ tipo: "sucesso", texto: "Ficheiro de cópia descarregado." });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  }

  async function mudarVersoes(n: number | null) {
    if (!def || n === null || n < 1 || n > 100 || !Number.isInteger(n)) return;
    const nova = { ...def, versoesAGuardar: n };
    await guardarDefinicoesCopias(chave, nova);
    setDef(nova);
  }

  if (!def) return <Ecra titulo="Onde estão os meus dados" voltar={voltar}>A carregar…</Ecra>;

  const dias = diasDesdeUltimaCopia(def);

  return (
    <Ecra titulo="Onde estão os meus dados" voltar={voltar}>
      <div className="cartao">
        <dl className="lista">
          <dt>Dados de trabalho</dt>
          <dd>Neste aparelho, cifrados{persistente === true ? " (armazenamento protegido)" : ""}</dd>
          <dt>Destino das cópias</dt>
          <dd>{NOMES[def.destino]}</dd>
          {def.destino === "pasta" && (
            <>
              <dt>Pasta</dt>
              <dd>
                {def.nomePasta ?? "?"} <span className="suave">(pasta escolhida neste computador)</span>
                {pastaLigada === false && <div className="erro-texto">Precisa de nova autorização ou de ser escolhida de novo.</div>}
              </dd>
              <dt>Cópias guardadas</dt>
              <dd>Últimas {def.versoesAGuardar} versões</dd>
            </>
          )}
          <dt>Última cópia</dt>
          <dd>
            {def.ultimaCopia ? (
              def.ultimaCopia.ok ? (
                <>
                  {dataHora(def.ultimaCopia.em)} · {tamanho(def.ultimaCopia.bytes)} · <span style={{ color: "var(--sucesso)" }}>correu bem</span>
                </>
              ) : (
                <>
                  {dataHora(def.ultimaCopia.em)} · <span className="erro-texto">falhou: {def.ultimaCopia.erro}</span>
                </>
              )
            ) : (
              "Ainda não foi feita nenhuma cópia"
            )}
          </dd>
        </dl>
      </div>

      {dias > 7 && (
        <Aviso tipo="atencao" titulo={dias === Infinity ? "Ainda não tem nenhuma cópia" : `A última cópia tem ${Math.floor(dias)} dias`}>
          Se perder ou trocar de aparelho, só consegue recuperar os dados a partir de uma cópia.
        </Aviso>
      )}
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <div className="acoes">
        <button className="botao" onClick={copiarAgora} disabled={aCopiar}>
          {aCopiar ? "A copiar…" : def.destino === "aparelho" ? "Descarregar cópia agora" : "Fazer cópia agora"}
        </button>
        <button className="botao botao-secundario" onClick={onAlterarLocal}>
          Alterar local
        </button>
      </div>

      {def.destino === "pasta" && <CampoNumero rotulo="Número de cópias a guardar na pasta" valor={def.versoesAGuardar} onChange={mudarVersoes} ajuda="As mais antigas são apagadas automaticamente." />}

      <h2>Outras ações</h2>
      <div className="acoes">
        {def.destino !== "aparelho" && (
          <button className="botao botao-secundario" onClick={descarregarAgora}>
            Descarregar cópia
          </button>
        )}
        {def.destino !== "aparelho" && (
          <button
            className="botao botao-secundario"
            onClick={async () => {
              await guardarDefinicoesCopias(chave, { ...def, destino: "aparelho", nomePasta: undefined });
              await recarregar();
              setMensagem({ tipo: "sucesso", texto: "Destino desligado. As cópias já feitas continuam lá. A partir de agora, descarregue cópias manualmente." });
            }}
          >
            Desligar este destino
          </button>
        )}
        <button className="botao botao-secundario" onClick={onRestaurar}>
          Restaurar de uma cópia
        </button>
      </div>
      <p className="suave">As cópias estão sempre cifradas. Sem a palavra-passe ou o código de recuperação, o ficheiro é ilegível.</p>
    </Ecra>
  );
}
