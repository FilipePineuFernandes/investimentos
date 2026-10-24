import { useState } from "react";
import { Aviso, CampoPalavraPasse, Ecra, Passos } from "../componentes/ui";
import { criarCofre, MIN_PALAVRA_PASSE } from "../dados/cofre";
import { LigacaoLegal } from "../componentes/Legal";

export function CriarCofre({ voltar, onCriado }: { voltar: () => void; onCriado: (chave: CryptoKey) => void }) {
  const [pp, setPp] = useState("");
  const [pp2, setPp2] = useState("");
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{ chave: CryptoKey; codigo: string } | null>(null);
  const [guardei, setGuardei] = useState(false);
  const [aceito, setAceito] = useState(false);

  const curta = pp.length > 0 && pp.length < MIN_PALAVRA_PASSE;
  const diferentes = pp2.length > 0 && pp !== pp2;
  const valida = pp.length >= MIN_PALAVRA_PASSE && pp === pp2 && aceito;

  async function criar() {
    setACriar(true);
    setErro("");
    try {
      const { chave, codigoRecuperacao } = await criarCofre(pp);
      // Pede ao navegador para não apagar os dados quando precisar de espaço.
      await navigator.storage?.persist?.().catch(() => false);
      setResultado({ chave, codigo: codigoRecuperacao });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACriar(false);
    }
  }

  if (resultado) {
    return (
      <Ecra titulo="Código de recuperação">
        <Passos atual={2} total={4} />
        <p>
          Este código é a <strong>única forma</strong> de recuperar os seus dados se se esquecer da palavra-passe. Escreva-o em papel ou imprima-o, e guarde-o
          num local seguro. Não volta a ser mostrado.
        </p>
        <div className="codigo" aria-label="Código de recuperação">
          {resultado.codigo}
        </div>
        <div className="acoes nao-imprimir">
          <button className="botao botao-secundario" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
        <Aviso tipo="atencao" titulo="Importante">
          Sem a palavra-passe e sem este código, ninguém consegue recuperar os dados: nem o criador da app, nem a Google, nem a Dropbox.
        </Aviso>
        <label className="caixa">
          <input type="checkbox" checked={guardei} onChange={(e) => setGuardei(e.target.checked)} />
          <span>Guardei o código de recuperação num local seguro.</span>
        </label>
        <button className="botao" disabled={!guardei} onClick={() => onCriado(resultado.chave)}>
          Continuar
        </button>
      </Ecra>
    );
  }

  return (
    <Ecra titulo="Proteger os seus dados" voltar={aCriar ? undefined : voltar}>
      <Passos atual={1} total={4} />
      <p>Escolha uma palavra-passe. Ela cifra todos os dados guardados neste aparelho e nas cópias. A palavra-passe nunca é guardada nem enviada.</p>
      <form
        className="cartao"
        onSubmit={(e) => {
          e.preventDefault();
          if (valida) criar();
        }}
      >
        <CampoPalavraPasse
          rotulo="Palavra-passe"
          valor={pp}
          onChange={setPp}
          autoComplete="new-password"
          ajuda={curta ? <span className="erro-texto">Pelo menos {MIN_PALAVRA_PASSE} caracteres.</span> : `Pelo menos ${MIN_PALAVRA_PASSE} caracteres. Uma frase fácil de lembrar é boa opção.`}
        />
        <CampoPalavraPasse
          rotulo="Repetir a palavra-passe"
          valor={pp2}
          onChange={setPp2}
          autoComplete="new-password"
          ajuda={diferentes ? <span className="erro-texto">As palavras-passe não coincidem.</span> : undefined}
        />
        <label className="caixa">
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
          <span>
            Li a <LigacaoLegal texto="política de privacidade" seccao="privacidade" /> e os <LigacaoLegal texto="avisos legais" seccao="avisos" />, e
            compreendo que a app é uma ferramenta de simulação, não aconselhamento financeiro nem fiscal.
          </span>
        </label>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <button className="botao" type="submit" disabled={!valida || aCriar}>
          {aCriar ? "A proteger os dados…" : "Continuar"}
        </button>
      </form>
    </Ecra>
  );
}
