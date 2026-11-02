import { useEffect, useState } from "react";
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
import { desligarDrive, lerMarcador, sincronizar } from "../nuvem/sincronizar";
import { enderecoPasta, iniciarEntrada } from "../nuvem/googleDrive";
import { useGoogle } from "../nuvem/useGoogle";

/**
 * "Onde quer guardar as cópias dos seus dados?" (ponto 9.3 da especificação).
 * Usado no assistente inicial e para alterar o local nas definições.
 */
export function EscolherLocal({
  chave,
  assistente,
  voltar,
  onConcluido,
  onSubstituido,
  retomar,
}: {
  chave: CryptoKey;
  assistente: boolean;
  voltar?: () => void;
  onConcluido: () => void;
  /** Os dados deste aparelho foram trocados pelos do Google Drive: é preciso abrir de novo com a palavra-passe desses dados. */
  onSubstituido: (mensagem: string) => void;
  /** Voltou da Google (iPhone): continua a ligação sozinho, sem pedir outro toque. */
  retomar?: boolean;
}) {
  const [aTrabalhar, setATrabalhar] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<DefinicoesCopias | null>(null);
  const [conta, setConta] = useState<string | undefined>();
  const [pastaDrive, setPastaDrive] = useState<string | undefined>();
  /** O Google Drive já tem dados de outro cofre: a pessoa tem de escolher qual fica. */
  const [conflito, setConflito] = useState(false);
  const pastaDisponivel = suportaPasta();

  const google = useGoogle();

  useEffect(() => {
    if (retomar && google === "pronto") void ligarDrive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retomar, google]);

  async function ligarDrive(forcar?: "enviar" | "receber") {
    iniciarEntrada("ligar", true); // primeiro de tudo: a janela da Google tem de abrir no instante do toque
    setATrabalhar(true);
    setErro("");
    try {
      const r = await sincronizar({ interativo: true, escolherConta: true, forcar });
      if (!r.ok) {
        if (r.cofreDiferente) setConflito(true);
        else setErro(r.erro);
        return;
      }
      if (r.acao === "substituiu") {
        onSubstituido(`Dados trazidos do Google Drive${r.conta ? ` (${r.conta})` : ""}. Introduza a palavra-passe que usa nesses dados.`);
        return;
      }
      const atual = (await lerDefinicoesCopias(chave)) ?? DEFINICOES_PADRAO;
      const agora = new Date().toISOString();
      await guardarDefinicoesCopias(chave, {
        ...atual,
        destino: "googleDrive",
        nomePasta: undefined,
        ultimaCopiaComSucesso: agora,
        ultimaCopia: { em: agora, bytes: r.bytes, ok: true, nomeFicheiro: "Google Drive" },
      });
      setConflito(false);
      setConta(r.conta);
      setPastaDrive((await lerMarcador())?.pastaId);
      setFeito((await lerDefinicoesCopias(chave)) ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setATrabalhar(false);
    }
  }

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
      if (atual.destino === "googleDrive") await desligarDrive();
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
        {feito.destino === "googleDrive" && (
          <p>
            Os dados ficam sincronizados, cifrados, com o Google Drive{conta ? ` (${conta})` : ""}. Noutro aparelho, escolha <strong>Já tenho dados no Google
            Drive</strong> no início: só precisa da palavra-passe, e a app não volta a pedir o que já tem.
            {pastaDrive && (
              <>
                {" "}
                <a href={enderecoPasta(pastaDrive)} target="_blank" rel="noopener noreferrer">
                  Abrir a pasta «Investimentos» no Google Drive
                </a>
              </>
            )}
          </p>
        )}
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
      {conflito && (
        <Aviso tipo="atencao" titulo="Já há outros dados neste Google Drive">
          A conta Google que escolheu já tem dados desta app, de um cofre diferente do deste aparelho. Escolha quais ficam. Só se pode manter um dos dois.
          <div className="acoes">
            <button
              className="botao"
              disabled={aTrabalhar}
              onClick={() => window.confirm("Os dados deste aparelho vão ser apagados e substituídos pelos do Google Drive. Continuar?") && ligarDrive("receber")}
            >
              Usar os dados do Google Drive
            </button>
            <button
              className="botao botao-secundario"
              disabled={aTrabalhar}
              onClick={() => window.confirm("Os dados que estão no Google Drive vão ser substituídos pelos deste aparelho. Continuar?") && ligarDrive("enviar")}
            >
              Usar os dados deste aparelho
            </button>
          </div>
        </Aviso>
      )}
      <Opcao
        titulo="Google Drive"
        etiqueta={google === "a-carregar" ? "A preparar…" : google === "falhou" ? "Sem ligação à Google" : undefined}
        desativada={aTrabalhar || google !== "pronto"}
        onClick={() => ligarDrive()}
        descricao="Entra na sua conta Google. Os dados ficam sincronizados, cifrados, em todos os aparelhos onde entrar, e a app só pede o que ainda não tem."
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
      {aTrabalhar && <Aviso>A preparar… se abrir uma janela da Google, termine lá a entrada.</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <p className="suave">O Dropbox fica disponível numa fase seguinte.</p>
    </Ecra>
  );
}
