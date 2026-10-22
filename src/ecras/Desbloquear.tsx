import { useState } from "react";
import { Aviso, Campo, CampoPalavraPasse, Ecra } from "../componentes/ui";
import { abrirComPalavraPasse, MIN_PALAVRA_PASSE, recuperarComCodigo } from "../dados/cofre";
import { codigoRecuperacaoValido } from "../seguranca/cripto";

export function Desbloquear({ onAberto, mensagem }: { onAberto: (chave: CryptoKey) => void; mensagem?: string }) {
  const [modo, setModo] = useState<"palavra-passe" | "recuperacao">("palavra-passe");
  const [pp, setPp] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const [aAbrir, setAAbrir] = useState(false);
  const [erro, setErro] = useState("");

  async function abrir() {
    setAAbrir(true);
    setErro("");
    const chave = await abrirComPalavraPasse(pp);
    setAAbrir(false);
    if (chave) onAberto(chave);
    else setErro("Palavra-passe errada.");
  }

  async function recuperar() {
    setAAbrir(true);
    setErro("");
    try {
      const chave = await recuperarComCodigo(codigo, nova);
      if (chave) onAberto(chave);
      else setErro("O código de recuperação está errado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setAAbrir(false);
    }
  }

  if (modo === "recuperacao") {
    const valida = codigoRecuperacaoValido(codigo) && nova.length >= MIN_PALAVRA_PASSE && nova === nova2;
    return (
      <Ecra titulo="Recuperar o acesso" voltar={() => setModo("palavra-passe")}>
        <p>Introduza o código de recuperação que guardou quando criou a app, e escolha uma palavra-passe nova.</p>
        <form
          className="cartao"
          onSubmit={(e) => {
            e.preventDefault();
            if (valida) recuperar();
          }}
        >
          <Campo rotulo="Código de recuperação" ajuda="30 caracteres, com ou sem hífenes.">
            {(id) => <input id={id} value={codigo} autoComplete="off" spellCheck={false} onChange={(e) => setCodigo(e.target.value)} />}
          </Campo>
          <CampoPalavraPasse rotulo="Palavra-passe nova" valor={nova} onChange={setNova} autoComplete="new-password" ajuda={`Pelo menos ${MIN_PALAVRA_PASSE} caracteres.`} />
          <CampoPalavraPasse
            rotulo="Repetir a palavra-passe nova"
            valor={nova2}
            onChange={setNova2}
            autoComplete="new-password"
            ajuda={nova2 && nova !== nova2 ? <span className="erro-texto">As palavras-passe não coincidem.</span> : undefined}
          />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <button className="botao" type="submit" disabled={!valida || aAbrir}>
            {aAbrir ? "A verificar…" : "Recuperar e definir palavra-passe"}
          </button>
        </form>
      </Ecra>
    );
  }

  return (
    <Ecra titulo="Desbloquear">
      {mensagem && <Aviso tipo="info">{mensagem}</Aviso>}
      <form
        className="cartao"
        onSubmit={(e) => {
          e.preventDefault();
          if (pp) abrir();
        }}
      >
        <CampoPalavraPasse rotulo="Palavra-passe" valor={pp} onChange={setPp} autoComplete="current-password" />
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <button className="botao" type="submit" disabled={!pp || aAbrir}>
          {aAbrir ? "A abrir…" : "Abrir"}
        </button>
      </form>
      <button className="botao-ligacao" onClick={() => setModo("recuperacao")}>
        Esqueci-me da palavra-passe
      </button>
      <p className="suave">O desbloqueio com impressão digital ou rosto chega numa próxima versão.</p>
    </Ecra>
  );
}
