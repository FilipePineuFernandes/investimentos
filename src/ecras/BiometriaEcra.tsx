// Definições → Abertura da app: nome do utilizador, abertura automática neste aparelho e
// desbloqueio com o rosto ou a impressão digital.

import { useEffect, useState } from "react";
import { Aviso, Campo, CampoPalavraPasse, Ecra } from "../componentes/ui";
import { aparelhoLembrado, ativarBiometria, dataBiometria, desativarBiometria, esquecerAparelho, lembrarAparelho } from "../dados/cofre";
import { guardarNome, lerNome } from "../dados/utilizador";
import { biometriaDisponivel } from "../seguranca/biometria";
import { dataHora } from "../util/numeros";

export function BiometriaEcra({
  chave,
  automatico,
  onAutomatico,
  voltar,
}: {
  chave: CryptoKey;
  automatico: boolean;
  onAutomatico: (ligado: boolean) => void;
  voltar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [nomeGuardado, setNomeGuardado] = useState("");
  const [automaticoDesde, setAutomaticoDesde] = useState<string | null>(null);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [ativaDesde, setAtivaDesde] = useState<string | null>(null);
  const [pp, setPp] = useState("");
  const [aTrabalhar, setATrabalhar] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function recarregar() {
    const [d, desde, n, auto] = await Promise.all([biometriaDisponivel(), dataBiometria(), lerNome(chave), aparelhoLembrado()]);
    setDisponivel(d);
    setAtivaDesde(desde);
    setNome(n);
    setNomeGuardado(n);
    setAutomaticoDesde(auto);
  }

  async function mudarAutomatico(ligar: boolean) {
    if (ligar) await lembrarAparelho(chave);
    else await esquecerAparelho();
    onAutomatico(ligar);
    await recarregar();
  }

  useEffect(() => {
    recarregar();
  }, []);

  async function ativar() {
    setATrabalhar(true);
    setMensagem(null);
    try {
      const ok = await ativarBiometria(pp);
      if (!ok) setMensagem({ tipo: "erro", texto: "Palavra-passe errada." });
      else {
        setPp("");
        setMensagem({ tipo: "sucesso", texto: "Ativado. Da próxima vez que abrir a app, use o botão «Abrir com o rosto ou a impressão digital»." });
        await recarregar();
      }
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setATrabalhar(false);
    }
  }

  async function desativar() {
    await desativarBiometria();
    setMensagem({
      tipo: "sucesso",
      texto: "Desativado neste aparelho. A chave de acesso pode continuar na lista de chaves de acesso do aparelho; pode apagá-la nas definições do sistema.",
    });
    await recarregar();
  }

  return (
    <Ecra titulo="Abertura da app" voltar={voltar}>
      <h2>Nome</h2>
      <form
        className="cartao"
        onSubmit={async (e) => {
          e.preventDefault();
          await guardarNome(chave, nome);
          setNomeGuardado(nome.trim());
        }}
      >
        <Campo rotulo="O seu nome" ajuda="Aparece na saudação do ecrã inicial.">
          {(id) => <input id={id} value={nome} autoComplete="given-name" onChange={(e) => setNome(e.target.value)} />}
        </Campo>
        <button className="botao botao-secundario" type="submit" disabled={nome.trim() === nomeGuardado}>
          Guardar o nome
        </button>
      </form>

      <h2>Abrir automaticamente neste aparelho</h2>
      <div className="cartao">
        {automatico ? (
          <>
            <Aviso tipo="sucesso" titulo="Ligado">
              A app abre sozinha neste aparelho{automaticoDesde ? ` desde ${dataHora(automaticoDesde)}` : ""}, sem pedir a palavra-passe.
            </Aviso>
            <button type="button" className="botao botao-secundario" onClick={() => mudarAutomatico(false)}>
              Desligar: pedir sempre a palavra-passe
            </button>
          </>
        ) : (
          <>
            <p>A app pede a palavra-passe (ou o rosto) sempre que abre.</p>
            <button type="button" className="botao" onClick={() => mudarAutomatico(true)}>
              Ligar: abrir sem palavra-passe neste aparelho
            </button>
          </>
        )}
        <p className="suave">
          Com esta opção ligada, quem tiver o aparelho desbloqueado na mão consegue abrir a app: use bloqueio de ecrã no telemóvel e no computador. A app não
          guarda a palavra-passe: guarda uma chave que o navegador não deixa copiar e que só serve neste aparelho. As cópias de segurança continuam a precisar
          da palavra-passe.
        </p>
      </div>

      <h2>Rosto ou impressão digital</h2>
      <p>
        Abra a app com o <strong>reconhecimento facial</strong>, a <strong>impressão digital</strong> ou o Windows Hello, sem escrever a palavra-passe. O rosto
        e a impressão digital nunca saem do aparelho: o sistema confirma que é o utilizador e só então liberta a chave que abre os dados.
      </p>

      {disponivel === null ? (
        <p className="suave">A verificar o aparelho…</p>
      ) : ativaDesde ? (
        <div className="cartao">
          <Aviso tipo="sucesso" titulo="Ativo neste aparelho">
            Desde {dataHora(ativaDesde)}.
          </Aviso>
          <button type="button" className="botao botao-secundario" onClick={desativar}>
            Desativar neste aparelho
          </button>
        </div>
      ) : !disponivel ? (
        <Aviso tipo="atencao" titulo="Não disponível neste aparelho ou navegador">
          É preciso um aparelho com reconhecimento facial, impressão digital ou Windows Hello configurados, e a app aberta no Chrome, Edge ou Safari atualizados
          (por exemplo instalada no ecrã inicial). Continua a poder abrir a app com a palavra-passe.
        </Aviso>
      ) : (
        <form
          className="cartao"
          onSubmit={(e) => {
            e.preventDefault();
            if (pp) ativar();
          }}
        >
          <p>Para ativar, confirme a palavra-passe. A seguir, o aparelho pede o rosto ou o dedo (às vezes duas vezes).</p>
          <CampoPalavraPasse rotulo="Palavra-passe" valor={pp} onChange={setPp} autoComplete="current-password" />
          <button className="botao" type="submit" disabled={!pp || aTrabalhar}>
            {aTrabalhar ? "A aguardar o reconhecimento…" : "Ativar"}
          </button>
        </form>
      )}

      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <Aviso>
        <strong>A palavra-passe continua a ser precisa</strong> noutros aparelhos, para restaurar cópias e se a biometria falhar. O desbloqueio por biometria
        fica só neste aparelho e não vai nas cópias de segurança: em cada aparelho novo, ative-o de novo.
      </Aviso>
    </Ecra>
  );
}
