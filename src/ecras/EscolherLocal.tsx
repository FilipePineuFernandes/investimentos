import { useState } from "react";
import { Aviso, Ecra, Opcao, Passos } from "../componentes/ui";
import {
  DEFINICOES_PADRAO,
  escolherPasta,
  fazerCopia,
  guardarDefinicoesCopias,
  lerDefinicoesCopias,
  suportaPasta,
  type DefinicoesCopias,
} from "../dados/copias";
import { descricaoDestino } from "./CopiasSeguranca";

/**
 * "Onde quer guardar as cópias dos seus dados?" (ponto 9.3 da especificação).
 * Usado no assistente inicial e para alterar o local nas definições.
 */
export function EscolherLocal({ chave, assistente, voltar, onConcluido }: { chave: CryptoKey; assistente: boolean; voltar?: () => void; onConcluido: () => void }) {
  const [aTrabalhar, setATrabalhar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<DefinicoesCopias | null>(null);
  const pastaDisponivel = suportaPasta();

  async function definir(destino: DefinicoesCopias["destino"]) {
    setATrabalhar(true);
    setErro("");
    try {
      const atual = (await lerDefinicoesCopias(chave)) ?? DEFINICOES_PADRAO;
      let nova: DefinicoesCopias = { ...atual, destino, nomePasta: undefined };
      if (destino === "pasta") {
        const pasta = await escolherPasta();
        nova = { ...nova, nomePasta: pasta.name };
      }
      await guardarDefinicoesCopias(chave, nova);
      if (destino === "pasta") {
        const r = await fazerCopia(chave, true);
        if (!r.ok) throw new Error(`A pasta foi ligada, mas a primeira cópia falhou: ${r.erro}`);
      }
      setFeito((await lerDefinicoesCopias(chave)) ?? nova);
    } catch (e) {
      // Fechar a janela de escolha de pasta não é um erro.
      if ((e as DOMException)?.name !== "AbortError") setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setATrabalhar(false);
    }
  }

  if (feito) {
    return (
      <Ecra titulo="Local das cópias">
        {assistente && <Passos atual={3} total={4} />}
        <Aviso tipo="sucesso" titulo="Tudo pronto">
          As cópias dos seus dados estão a ser guardadas em: <strong>{descricaoDestino(feito)}</strong>.
        </Aviso>
        {feito.destino === "pasta" && <p>A primeira cópia já foi gravada. A app volta a copiar ao fechar, no máximo uma vez por dia, e guarda as últimas {feito.versoesAGuardar} versões.</p>}
        {feito.destino === "aparelho" && (
          <p>
            Os dados ficam só neste aparelho. Use <strong>Descarregar cópia</strong> com regularidade e guarde o ficheiro onde quiser (OneDrive, Dropbox, iCloud,
            e-mail, pen USB). A app lembra-o quando a última cópia tiver mais de 7 dias.
          </p>
        )}
        <p className="suave">Pode alterar o local a qualquer momento em Definições → Onde estão os meus dados.</p>
        <button className="botao" onClick={onConcluido}>
          Continuar
        </button>
      </Ecra>
    );
  }

  return (
    <Ecra titulo={assistente ? "Onde guardar as cópias" : "Alterar local das cópias"} voltar={aTrabalhar ? undefined : voltar}>
      {assistente && <Passos atual={3} total={4} />}
      <p>
        Os dados com que a app trabalha ficam sempre neste aparelho, cifrados. <strong>Onde quer guardar as cópias</strong>, para os recuperar noutro aparelho
        ou se perder este?
      </p>
      <Opcao
        titulo="Google Drive"
        etiqueta="Em breve"
        desativada
        descricao="Inicia sessão na sua conta Google e escolhe uma pasta. Cópias automáticas em todos os aparelhos."
      />
      <Opcao titulo="Dropbox" etiqueta="Em breve" desativada descricao="Inicia sessão na sua conta Dropbox. Cópias automáticas na pasta Aplicações." />
      <Opcao
        titulo="Pasta no computador"
        etiqueta={pastaDisponivel ? undefined : "Só no Chrome e Edge do computador"}
        desativada={!pastaDisponivel || aTrabalhar}
        onClick={() => definir("pasta")}
        descricao="Escolhe uma pasta do computador. Pode ser uma pasta sincronizada pelo OneDrive, Google Drive ou Dropbox. Cópias automáticas."
      />
      <Opcao
        titulo="Só neste aparelho, com cópias descarregadas"
        desativada={aTrabalhar}
        onClick={() => definir("aparelho")}
        descricao="Sem ligações. Descarrega um ficheiro de cópia quando quiser e guarda-o onde preferir. A app lembra-o de o fazer."
      />
      {aTrabalhar && <Aviso>A preparar…</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <p className="suave">O Google Drive e o Dropbox ficam disponíveis com a cópia automática na nuvem (fase 5 do plano).</p>
    </Ecra>
  );
}
