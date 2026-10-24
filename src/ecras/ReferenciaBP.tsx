// Referências do Banco de Portugal ao lado do crédito (5.4): a taxa média dos novos créditos à
// habitação com taxa variável e a TAEG média, comparadas com a proposta do banco.

import { useEffect, useState } from "react";
import { Selo } from "../componentes/Selo";
import type { TipoTaxa } from "../calculo/credito";
import { obterTaxasBP, SERIES_BP, type SerieBP, type ValorBP } from "../dados/bancoPortugal";

const pct = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
const mes = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

function diferenca(sua: number, media: number): string {
  const d = Math.round((sua - media) * 100) / 100;
  if (d === 0) return "igual à média";
  return `${Math.abs(d).toLocaleString("pt-PT")} pontos ${d > 0 ? "acima" : "abaixo"} da média`;
}

export function ReferenciaBP({ chave, tan, taeg, tipoTaxa }: { chave: CryptoKey; tan: number; taeg: number; tipoTaxa: TipoTaxa }) {
  const [taxas, setTaxas] = useState<Partial<Record<SerieBP, ValorBP>> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aBuscar, setABuscar] = useState(false);

  async function carregar(forcar: boolean) {
    setABuscar(true);
    const r = await obterTaxasBP(chave, forcar);
    setTaxas(r.taxas);
    setErro(r.erro);
    setABuscar(false);
  }

  useEffect(() => {
    carregar(false);
  }, [chave]);

  if (!taxas) return <p className="suave">A obter as taxas médias do Banco de Portugal…</p>;
  return <CartaoReferenciaBP taxas={taxas} erro={erro} aBuscar={aBuscar} onAtualizar={() => carregar(true)} tan={tan} taeg={taeg} tipoTaxa={tipoTaxa} />;
}

/** O cartão em si, só a desenhar os valores recebidos. */
export function CartaoReferenciaBP({
  taxas,
  erro,
  aBuscar,
  onAtualizar,
  tan,
  taeg,
  tipoTaxa,
}: {
  taxas: Partial<Record<SerieBP, ValorBP>>;
  erro: string | null;
  aBuscar: boolean;
  onAtualizar: () => void;
  tan: number;
  taeg: number;
  tipoTaxa: TipoTaxa;
}) {
  const linha = (s: SerieBP, sua: number, nomeSua: string) => {
    const v = taxas[s];
    if (!v) return null;
    return (
      <div>
        <div>
          {SERIES_BP[s].nome}: <strong>{pct(v.valor)}</strong>
        </div>
        <div className="suave">
          {nomeSua} desta proposta ({pct(sua)}) está {diferenca(sua, v.valor)}.
        </div>
        <Selo
          fonte="Banco de Portugal"
          periodo={mes(v.data)}
          data={`consultado a ${new Date(v.consultadoEm).toLocaleDateString("pt-PT")}`}
          desatualizado={Date.now() - new Date(v.consultadoEm).getTime() > 40 * 86_400_000}
        />
      </div>
    );
  };

  return (
    <div className="cartao">
      <h3>Comparação com o mercado</h3>
      {tipoTaxa === "variavel" ? linha("taxaVariavel", tan, "A TAN") : <p className="suave">A taxa média de referência do Banco de Portugal é a da taxa variável.</p>}
      {linha("taeg", taeg, "A TAEG")}
      {!taxas.taxaVariavel && !taxas.taeg && <p>Não encontrado.</p>}
      {erro && <small className="erro-texto">{erro} {taxas.taeg || taxas.taxaVariavel ? "Mostram-se os últimos valores guardados." : ""}</small>}
      <button type="button" className="botao-ligacao" style={{ alignSelf: "flex-start" }} onClick={onAtualizar} disabled={aBuscar}>
        {aBuscar ? "A atualizar…" : "Atualizar"}
      </button>
      <small className="ajuda">Médias de todos os bancos no último mês publicado. A proposta concreta vem na ficha do banco (FINE).</small>
    </div>
  );
}
