// Definições → Rosto ou impressão digital: ativar e desativar o desbloqueio por biometria
// neste aparelho.

import { useEffect, useState } from "react";
import { Aviso, CampoPalavraPasse, Ecra } from "../componentes/ui";
import { ativarBiometria, dataBiometria, desativarBiometria } from "../dados/cofre";
import { biometriaDisponivel } from "../seguranca/biometria";
import { dataHora } from "../util/numeros";

export function BiometriaEcra({ voltar }: { voltar: () => void }) {
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [ativaDesde, setAtivaDesde] = useState<string | null>(null);
  const [pp, setPp] = useState("");
  const [aTrabalhar, setATrabalhar] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function recarregar() {
    const [d, desde] = await Promise.all([biometriaDisponivel(), dataBiometria()]);
    setDisponivel(d);
    setAtivaDesde(desde);
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
    <Ecra titulo="Rosto ou impressão digital" voltar={voltar}>
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
