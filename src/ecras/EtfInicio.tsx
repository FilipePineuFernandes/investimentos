// Área de ETF: botões com símbolo e nome, como no ecrã inicial.

import { useEffect, useState } from "react";
import { Ecra } from "../componentes/ui";
import { Icone, type NomeIcone } from "../componentes/Icone";
import { Janela } from "../componentes/Janela";
import { diaISO } from "../calculo/carteira";
import { precisaRevisao } from "../calculo/etf";
import { listarETF, type ETF } from "../dados/etf";

type Destino = "etfCatalogo" | "etfNovo" | "etfCarteira" | "etfDuvidas";

export function EtfInicio({ chave, voltar, onNavegar }: { chave: CryptoKey; voltar: () => void; onNavegar: (d: Destino) => void }) {
  const [catalogo, setCatalogo] = useState<ETF[] | null>(null);
  const [sobre, setSobre] = useState(false);
  const hoje = diaISO(new Date());

  useEffect(() => {
    listarETF(chave).then(setCatalogo);
  }, [chave]);

  const aRever = catalogo?.filter((e) => precisaRevisao(e, hoje)).length ?? 0;

  const Botao = ({ icone, nome, nota, aviso, onClick, ativo }: { icone: NomeIcone; nome: string; nota?: string; aviso?: string; onClick: () => void; ativo?: boolean }) => (
    <button className="area-botao" onClick={onClick} aria-expanded={ativo}>
      <span className="area-simbolo" aria-hidden="true">
        <Icone nome={icone} />
      </span>
      <span className="area-nome">{nome}</span>
      {nota && <span className="area-nota">{nota}</span>}
      {aviso && <span className="area-nota" style={{ color: "var(--atencao)" }}>{aviso}</span>}
    </button>
  );

  return (
    <Ecra titulo="ETF" voltar={voltar}>
      <div className="duas-areas">
        <Botao icone="informacao" nome="Sobre esta área" onClick={() => setSobre(true)} />
        <Botao icone="carteira" nome="Carteira" onClick={() => onNavegar("etfCarteira")} />
        <Botao
          icone="catalogo"
          nome="Catálogo"
          nota={catalogo === null ? undefined : `${catalogo.length} ETF`}
          aviso={aRever > 0 ? `${aRever} a rever` : undefined}
          onClick={() => onNavegar("etfCatalogo")}
        />
        <Botao icone="procurar" nome="Novo ETF" onClick={() => onNavegar("etfNovo")} />
        <Botao icone="duvidas" nome="Zona de dúvidas" onClick={() => onNavegar("etfDuvidas")} />
      </div>

      {sobre && (
        <Janela titulo="Sobre a área de ETF" onFechar={() => setSobre(false)}>
        <div className="cartao texto-verde">
          <p style={{ margin: 0 }}>
            <strong>Carteira:</strong> as suas compras e vendas, o valor de hoje, os ganhos e o IRS das vendas.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Catálogo:</strong> os ETF que acompanha. Daí pode também simular um investimento, com a projeção a 4%, 6%, 8% e 10%, custos e impostos.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Novo ETF:</strong> procure ETF da Xetra pelo índice, região, setor, código ou ISIN e acrescente-os ao catálogo.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Zona de dúvidas:</strong> spread, TER, impostos, acumulação ou distribuição, domicílio e KID.
          </p>
        </div>
        </Janela>
      )}
    </Ecra>
  );
}
