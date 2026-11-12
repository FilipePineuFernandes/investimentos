// Dados de carteira de um imóvel (data de compra, obras, arrendamento, reavaliações, histórico e venda),
// abertos a partir da Carteira global.

import { useEffect, useMemo, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { analisarImovel } from "../calculo/imovel";
import { guardarImovel, listarImoveis, type DadosCarteira, type Imovel } from "../dados/imoveis";
import { lerPerfil, type Perfil } from "../dados/perfil";
import { CarteiraImovel } from "./CarteiraImovel";

export function CarteiraImovelEcra({ chave, id, voltar }: { chave: CryptoKey; id: string; voltar: () => void }) {
  const [perfil, setPerfil] = useState<Perfil | undefined>();
  const [i, setI] = useState<Imovel | null | undefined>(undefined);
  const [alterado, setAlterado] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    (async () => {
      setPerfil(await lerPerfil(chave));
      setI((await listarImoveis(chave)).find((x) => x.id === id) ?? null);
    })();
  }, [chave, id]);

  const analise = useMemo(() => (i ? analisarImovel(i, perfil) : null), [i, perfil]);

  if (i === undefined) return <Ecra titulo="Imóvel" voltar={voltar}>A carregar…</Ecra>;
  if (i === null || !analise) {
    return (
      <Ecra titulo="Imóvel" voltar={voltar}>
        <Aviso tipo="atencao">Não encontrei este imóvel. Pode ter sido apagado.</Aviso>
      </Ecra>
    );
  }

  const muda = (c: DadosCarteira) => {
    setI({ ...i, carteira: c });
    setAlterado(true);
    setGuardado(false);
  };

  async function guardar() {
    setAGuardar(true);
    await guardarImovel(chave, i!);
    setAGuardar(false);
    setAlterado(false);
    setGuardado(true);
  }

  /** A reavaliação grava logo o imóvel, para o histórico não se perder. */
  async function gravarAvaliacao(c: DadosCarteira) {
    const novo = { ...i!, carteira: c };
    setI(novo);
    await guardarImovel(chave, novo);
    setAlterado(false);
    setGuardado(true);
  }

  function sair() {
    if (alterado && !window.confirm("Tem alterações por guardar. Sair sem guardar?")) return;
    voltar();
  }

  return (
    <Ecra titulo={i.nome || i.morada || "Imóvel"} voltar={sair}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        style={{ display: "contents" }}
      >
        <CarteiraImovel i={i} a={analise} onChange={muda} onGravarAvaliacao={gravarAvaliacao} />

        {guardado && <Aviso tipo="sucesso">Guardado.</Aviso>}
        <div className="acoes">
          <button data-icone="guardar" className="botao" type="submit" disabled={aGuardar}>
            {aGuardar ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </form>
    </Ecra>
  );
}
