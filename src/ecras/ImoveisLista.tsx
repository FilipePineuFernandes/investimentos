import { useEffect, useState } from "react";
import { Aviso, Ecra } from "../componentes/ui";
import { listarImoveis, NOMES_DESTINO, NOMES_ESTADO, type Imovel } from "../dados/imoveis";
import { euros } from "../util/numeros";

/** Carteira imobiliária: lista dos imóveis guardados. */
export function ImoveisLista({ chave, voltar, onAbrir }: { chave: CryptoKey; voltar: () => void; onAbrir: (id: string | null) => void }) {
  const [imoveis, setImoveis] = useState<Imovel[] | null>(null);

  useEffect(() => {
    listarImoveis(chave).then(setImoveis);
  }, [chave]);

  return (
    <Ecra titulo="Imobiliário" voltar={voltar}>
      <button className="botao" onClick={() => onAbrir(null)}>
        Novo imóvel
      </button>

      {imoveis === null && <p className="suave">A carregar…</p>}
      {imoveis?.length === 0 && <Aviso>Ainda não tem imóveis. Comece por registar um que esteja a analisar.</Aviso>}

      {imoveis?.map((i) => (
        <button key={i.id} className="cartao modulo" style={{ cursor: "pointer" }} onClick={() => onAbrir(i.id)}>
          <h3>{i.nome || "Imóvel sem nome"}</h3>
          <p className="suave">
            {NOMES_ESTADO[i.estado]} · {NOMES_DESTINO[i.destino]}
            {i.municipio && ` · ${i.municipio}`}
          </p>
          <p>{i.preco ? euros(i.preco) : "Sem valor de compra"}</p>
        </button>
      ))}

      <p className="suave">Estratégias: revenda, arrendamento, reconstrução e cedência de posição. Para armazéns, escolha o destino comercial ou industrial.</p>
    </Ecra>
  );
}
