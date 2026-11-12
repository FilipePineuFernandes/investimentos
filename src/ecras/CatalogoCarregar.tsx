// Carregar o catálogo de ETF a partir de um Excel: mostra o que é novo, o que muda e o que tem
// erros, e só grava depois de a pessoa confirmar. Nenhum ETF é apagado.

import { useRef, useState } from "react";
import { Aviso } from "../componentes/ui";
import { lerLivroCatalogo, type ResultadoCatalogo } from "../dados/catalogoExcel";
import { guardarETF, type ETF } from "../dados/etf";

export function CatalogoCarregar({
  chave,
  catalogo,
  hoje,
  onConcluido,
  onFechar,
}: {
  chave: CryptoKey;
  catalogo: ETF[];
  hoje: string;
  onConcluido: (n: number) => void;
  onFechar: () => void;
}) {
  const ficheiro = useRef<HTMLInputElement>(null);
  const [resultado, setResultado] = useState<ResultadoCatalogo | null>(null);
  const [aGravar, setAGravar] = useState(false);

  async function aoEscolher(f: File | undefined) {
    if (!f) return;
    setResultado(lerLivroCatalogo(new Uint8Array(await f.arrayBuffer()), catalogo, hoje));
  }

  const linhas = resultado?.linhas ?? [];
  const aGuardar = linhas.filter((l) => l.estado === "novo" || l.estado === "alterado");
  const conta = (e: string) => linhas.filter((l) => l.estado === e).length;

  async function gravar() {
    setAGravar(true);
    for (const l of aGuardar) await guardarETF(chave, l.etf!);
    setAGravar(false);
    onConcluido(aGuardar.length);
  }

  return (
    <>
      <input ref={ficheiro} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => aoEscolher(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
      {!resultado && (
        <div className="cartao">
          <p style={{ margin: 0 }}>
            Escolha o Excel do catálogo (o ficheiro descarregado em «Descarregar em Excel», com as alterações que fez). Cada linha é um ETF, identificado pelo ISIN.
          </p>
          <ul className="suave">
            <li>Os ETF com um ISIN que já está no catálogo são atualizados; os outros são acrescentados.</li>
            <li>Nenhum ETF é apagado do catálogo.</li>
            <li>Antes de gravar, a app mostra o que leu.</li>
          </ul>
        </div>
      )}
      {resultado?.erro && (
        <p className="erro" role="alert">
          {resultado.erro}
        </p>
      )}
      {resultado && !resultado.erro && (
        <>
          <div className="cartao">
            <p style={{ margin: 0 }}>
              <strong>{conta("novo")}</strong> novos · <strong>{conta("alterado")}</strong> com alterações · {conta("igual")} sem alterações
              {conta("erro") > 0 && (
                <>
                  {" "}
                  · <strong className="erro-texto">{conta("erro")} com erros</strong> (não entram)
                </>
              )}
            </p>
          </div>
          <div className="cartao tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>ETF</th>
                  <th>O que acontece</th>
                </tr>
              </thead>
              <tbody>
                {linhas
                  .filter((l) => l.estado !== "igual")
                  .map((l) => (
                    <tr key={l.linha}>
                      <td>{l.linha}</td>
                      <td>
                        <strong>{l.etf?.ticker ?? ""}</strong>
                        <div className="suave">{l.etf?.nome ?? ""}</div>
                      </td>
                      <td>
                        {l.estado === "novo" && "Acrescentado ao catálogo"}
                        {l.estado === "alterado" && `Atualizado: ${l.mudancas.join(", ")}`}
                        {l.estado === "erro" && <span className="erro-texto">{l.erros.join(" ")}</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {aGuardar.length === 0 && conta("erro") === 0 && <p className="suave">O ficheiro é igual ao catálogo: não há nada para gravar.</p>}
          </div>
        </>
      )}
      {resultado && aGuardar.length > 0 && <Aviso>Confirme antes de gravar. Os ETF com erros ficam de fora: corrija-os no Excel e carregue o ficheiro outra vez.</Aviso>}
      <div className="acoes">
        <button data-icone="fechar" type="button" className="botao" onClick={onFechar}>
          Cancelar
        </button>
        <button data-icone="importar" type="button" className="botao" onClick={() => ficheiro.current?.click()}>
          {resultado ? "Escolher outro ficheiro" : "Escolher o ficheiro"}
        </button>
        {aGuardar.length > 0 && (
          <button data-icone="guardar" type="button" className="botao" disabled={aGravar} onClick={gravar}>
            {aGravar ? "A gravar…" : `Gravar ${aGuardar.length} ETF`}
          </button>
        )}
      </div>
    </>
  );
}
