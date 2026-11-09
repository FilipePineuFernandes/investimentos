// Importar vários movimentos da carteira de ETF de uma só vez, a partir de um livro de Excel
// preenchido com o modelo da app. Nada é gravado antes de a pessoa ver o que foi lido e confirmar.

import { useRef, useState } from "react";
import { Aviso } from "../componentes/ui";
import { posicaoEtf } from "../calculo/carteiraEtf";
import { descarregar } from "../dados/copias";
import type { ETF } from "../dados/etf";
import { criarModelo, interpretarFicheiro, NOME_MODELO, type ResultadoImportacao } from "../dados/importarMovimentos";
import { guardarMovimento, NOMES_TIPO, type Movimento } from "../dados/movimentosEtf";
import { euros } from "../util/numeros";

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const data = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-PT");
const ordemTipo = (m: Movimento) => (m.tipo === "compra" ? 0 : m.tipo === "venda" ? 1 : 2);

export function EtfImportar({
  chave,
  catalogo,
  movimentos,
  corretora,
  onFechar,
  onImportado,
}: {
  chave: CryptoKey;
  catalogo: ETF[];
  movimentos: Movimento[];
  corretora: string;
  onFechar: () => void;
  onImportado: (quantos: number) => Promise<void>;
}) {
  const [ficheiro, setFicheiro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erroModelo, setErroModelo] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function descarregarModelo() {
    setErroModelo(null);
    try {
      await descarregar(NOME_MODELO, criarModelo(catalogo), TIPO_XLSX, "Modelo de movimentos de ETF");
    } catch (e) {
      setErroModelo((e as Error).message);
    }
  }

  async function escolher(f: File | undefined) {
    if (!f) return;
    setFicheiro(f.name);
    setResultado(interpretarFicheiro(new Uint8Array(await f.arrayBuffer()), catalogo, movimentos, { corretora }));
    if (entrada.current) entrada.current.value = "";
  }

  const novos = resultado?.linhas.filter((l) => l.movimento && !l.repetido).map((l) => l.movimento!) ?? [];
  const repetidos = resultado?.linhas.filter((l) => l.repetido).length ?? 0;
  const comErros = resultado?.linhas.filter((l) => l.erros.length > 0) ?? [];

  // Vendas de mais unidades do que as que teria, juntando o que já está registado com o que vai entrar.
  const todos = [...movimentos, ...novos].sort((a, b) => a.data.localeCompare(b.data) || ordemTipo(a) - ordemTipo(b));
  const avisosVendas = [...new Set(novos.filter((m) => m.tipo === "venda").map((m) => m.isin))].flatMap((isin) => {
    const codigo = catalogo.find((e) => e.isin === isin)?.ticker || isin;
    return posicaoEtf(isin, todos, null).erros.map((e) => `${codigo}: ${e}`);
  });

  async function gravar() {
    setAGravar(true);
    try {
      for (const m of novos) await guardarMovimento(chave, m);
      await onImportado(novos.length);
    } finally {
      setAGravar(false);
    }
  }

  return (
    <div className="cartao">
      <h3 style={{ marginTop: 0 }}>Importar do Excel</h3>
      {catalogo.length === 0 ? (
        <Aviso>Acrescente primeiro os ETF ao catálogo: só entram movimentos de ETF que estejam lá.</Aviso>
      ) : (
        <>
          <ol className="suave" style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>Descarregue o modelo e abra-o no Excel ou no Numbers.</li>
            <li>Na folha «Movimentos», escreva um movimento por linha: data, tipo (Compra, Venda ou Dividendo), código Xetra ou ISIN e os valores. As instruções estão na folha «Instruções».</li>
            <li>Grave em formato .xlsx e escolha aqui o ficheiro. A app mostra o que leu antes de gravar.</li>
          </ol>
          <div className="acoes">
            <button type="button" className="botao botao-secundario" onClick={descarregarModelo}>
              Descarregar o modelo
            </button>
            <button type="button" className="botao" onClick={() => entrada.current?.click()}>
              {resultado ? "Escolher outro ficheiro" : "Escolher o ficheiro preenchido"}
            </button>
            <input
              ref={entrada}
              type="file"
              accept={`.xlsx,${TIPO_XLSX}`}
              style={{ display: "none" }}
              onChange={(e) => escolher(e.target.files?.[0])}
            />
          </div>
          {erroModelo && <Aviso tipo="atencao">{erroModelo}</Aviso>}
        </>
      )}

      {resultado?.erro && (
        <Aviso tipo="erro" titulo={ficheiro ?? undefined}>
          {resultado.erro}
        </Aviso>
      )}

      {resultado && !resultado.erro && (
        <>
          <Aviso tipo={novos.length > 0 && comErros.length === 0 ? "sucesso" : "atencao"} titulo={ficheiro ?? undefined}>
            {[
              `${novos.length} ${novos.length === 1 ? "movimento pronto" : "movimentos prontos"} a registar`,
              repetidos > 0 ? `${repetidos} já ${repetidos === 1 ? "estava registado" : "estavam registados"} (não ${repetidos === 1 ? "entra" : "entram"} outra vez)` : "",
              comErros.length > 0 ? `${comErros.length} com erros (não ${comErros.length === 1 ? "entra" : "entram"})` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
            .
          </Aviso>

          {comErros.length > 0 && (
            <details className="cartao" open>
              <summary>Linhas com erros</summary>
              <p className="suave">Corrija-as no Excel e envie de novo o ficheiro: os movimentos que já tiver registado não entram outra vez.</p>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                {comErros.map((l) => (
                  <li key={l.linha}>
                    <strong>Linha {l.linha}</strong>
                    {l.codigo && ` (${l.codigo})`}: {l.erros.join(" ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {avisosVendas.length > 0 && (
            <Aviso tipo="atencao" titulo="Vendas a confirmar">
              {avisosVendas.join(" ")} Verifique se falta alguma compra no ficheiro.
            </Aviso>
          )}

          {resultado.linhas.some((l) => l.movimento) && (
            <div className="tabela-rolavel">
              <table>
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Data</th>
                    <th>Movimento</th>
                    <th style={{ textAlign: "right" }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.linhas
                    .filter((l) => l.movimento)
                    .map((l) => {
                      const m = l.movimento!;
                      return (
                        <tr key={l.linha} style={l.repetido ? { opacity: 0.55 } : undefined}>
                          <td>{l.linha}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{data(m.data)}</td>
                          <td>
                            {NOMES_TIPO[m.tipo]} · <strong>{l.codigo}</strong>
                            <div className="suave">
                              {m.tipo === "dividendo"
                                ? `Imposto retido ${euros(m.imposto)}`
                                : `${m.quantidade.toLocaleString("pt-PT", { maximumFractionDigits: 6 })} × ${euros(m.preco)} · comissão ${euros(m.comissao)}`}
                              {l.repetido && " · já registado"}
                            </div>
                          </td>
                          <td style={{ textAlign: "right" }}>{euros(m.tipo === "dividendo" ? m.valor : m.quantidade * m.preco)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="acoes">
        {novos.length > 0 && (
          <button type="button" className="botao" disabled={aGravar} onClick={gravar}>
            {aGravar ? "A registar…" : `Registar ${novos.length} ${novos.length === 1 ? "movimento" : "movimentos"}`}
          </button>
        )}
        <button type="button" className="botao botao-secundario" disabled={aGravar} onClick={onFechar}>
          {resultado ? "Cancelar" : "Fechar"}
        </button>
      </div>
    </div>
  );
}
