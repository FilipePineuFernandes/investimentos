// Preenche a identificação do imóvel a partir da caderneta predial urbana (PDF do Portal das
// Finanças). A leitura corre no aparelho: o PDF não é enviado nem guardado, e os titulares não são lidos.

import { useRef, useState } from "react";
import { Aviso } from "../componentes/ui";
import { lerCaderneta, type LeituraCaderneta } from "../calculo/caderneta";
import type { DadosIne } from "../dados/ine";
import type { Imovel } from "../dados/imoveis";
import { euros } from "../util/numeros";

type Fase = { nome: "inicio" } | { nome: "a-ler"; mensagem: string } | { nome: "rever"; l: LeituraCaderneta } | { nome: "erro"; mensagem: string };

const NOME_REGIAO = { continente: "Continente", acores: "Açores", madeira: "Madeira" } as const;
const area = (n: number) => `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} m²`;

/** O código do INE (com a região à frente) que acaba no código do concelho ou da freguesia. */
function codigoIne(ine: DadosIne | null, codigo: string | null, tamanho: 7 | 9): string | null {
  if (!ine || !codigo) return null;
  return Object.keys(ine.nomes).find((g) => g.length === tamanho && g.endsWith(codigo)) ?? null;
}

/** O imóvel com os valores lidos (só os que a caderneta tem). */
export function aplicarCaderneta(i: Imovel, l: LeituraCaderneta, ine: DadosIne | null): Imovel {
  const novo: Imovel = { ...i };
  if (l.morada) novo.morada = l.morada;
  const geoMun = codigoIne(ine, l.codigoConcelho, 7);
  const geoFreg = codigoIne(ine, l.codigoFreguesia, 9);
  if (geoMun && ine) {
    novo.geoMunicipio = geoMun;
    novo.municipio = ine.nomes[geoMun];
    novo.geoFreguesia = geoFreg;
    novo.freguesia = geoFreg ? ine.nomes[geoFreg] : l.freguesia;
  } else {
    if (l.concelho) novo.municipio = l.concelho;
    if (l.freguesia) novo.freguesia = l.freguesia;
    novo.geoMunicipio = null;
    novo.geoFreguesia = null;
  }
  if (l.regiao) novo.regiao = l.regiao;
  if (/com[ée]rcio|servi[çc]os|armaz|ind[úu]stria/i.test(l.afetacao)) novo.destino = "comercial";
  if (l.moradia !== null) novo.moradia = l.moradia;
  if (l.tipologia) novo.tipologia = l.tipologia;
  if (l.area) novo.area = l.area;
  if (l.vpt) novo.vpt = l.vpt;
  if (l.anoInscricao && !i.anoConstrucao) novo.anoConstrucao = l.anoInscricao;
  if (l.coordenadas) novo.coordenadas = l.coordenadas;
  if (!i.nome.trim()) novo.nome = [l.tipologia, l.morada.split(",")[0]].filter(Boolean).join(" ");
  return novo;
}

export function CadernetaPainel({ i, ine, onAplicar, onCancelar }: { i: Imovel; ine: DadosIne | null; onAplicar: (novo: Imovel) => void; onCancelar: () => void }) {
  const [fase, setFase] = useState<Fase>({ nome: "inicio" });
  const ficheiro = useRef<HTMLInputElement>(null);

  async function aoEscolher(f: File | undefined) {
    if (!f) return;
    const { eFicheiroPdf } = await import("../leitura/leitor");
    if (!eFicheiroPdf(f)) {
      setFase({ nome: "erro", mensagem: "Escolha o PDF da caderneta predial, descarregado do Portal das Finanças." });
      return;
    }
    setFase({ nome: "a-ler", mensagem: "A ler o PDF…" });
    try {
      const [{ extrairTextoPdf }, trabalhador] = await Promise.all([import("../leitura/pdf"), import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")]);
      const texto = await extrairTextoPdf(new Uint8Array(await f.arrayBuffer()), trabalhador.default);
      const l = lerCaderneta(texto);
      if (!l || (!l.morada && !l.area && !l.vpt)) {
        setFase({
          nome: "erro",
          mensagem:
            "Este PDF não parece uma caderneta predial urbana. Descarregue-a no Portal das Finanças (Os seus serviços › Imóveis › Caderneta predial) e escolha esse PDF. Uma digitalização em papel não se consegue ler.",
        });
        return;
      }
      setFase({ nome: "rever", l });
    } catch (e) {
      setFase({ nome: "erro", mensagem: `Não foi possível ler o ficheiro. ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  const escolher = (
    <input ref={ficheiro} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => aoEscolher(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
  );

  if (fase.nome === "rever") {
    const l = fase.l;
    const geoMun = codigoIne(ine, l.codigoConcelho, 7);
    const geoFreg = codigoIne(ine, l.codigoFreguesia, 9);
    const linhas: [string, string][] = [
      ["Morada", l.morada],
      ["Município", geoMun && ine ? ine.nomes[geoMun] : l.concelho],
      ["Freguesia", geoFreg && ine ? ine.nomes[geoFreg] : l.freguesia ? `${l.freguesia}${ine ? " (sem dados do INE: usa-se o município)" : ""}` : ""],
      ["Região", l.regiao ? NOME_REGIAO[l.regiao] : ""],
      ["Tipo de imóvel", l.moradia === null ? "" : l.moradia ? "Moradia (prédio)" : `Apartamento (fração ${l.fracao || "autónoma"})`],
      ["Afetação", l.afetacao],
      ["Tipologia", l.tipologia === "T5+" ? "T5 ou mais" : l.tipologia],
      ["Área bruta privativa", l.area ? area(l.area) : ""],
      ["VPT", l.vpt ? `${euros(l.vpt)}${l.anoVpt ? ` (determinado em ${l.anoVpt})` : ""}` : ""],
      ["Ano de construção", l.anoInscricao ? `${l.anoInscricao} (ano de inscrição na matriz)${i.anoConstrucao ? " — já indicou um ano, que se mantém" : ""}` : ""],
      ["Localização no mapa", l.coordenadas ? "Sim, a partir das coordenadas da caderneta" : ""],
      ["Artigo matricial", l.artigo ? `${l.artigo}${l.fracao ? ` · fração ${l.fracao}` : ""}` : ""],
    ];
    const encontrados = linhas.filter(([, v]) => v);
    const emFalta = linhas.filter(([, v]) => !v).map(([n]) => n);
    return (
      <>
        {escolher}
        <div className="cartao tabela-rolavel">
          <h3 style={{ margin: 0 }}>O que a caderneta indica</h3>
          <table>
            <tbody>
              {encontrados.map(([n, v]) => (
                <tr key={n}>
                  <th style={{ textAlign: "left" }}>{n}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {emFalta.length > 0 && <p className="suave">Não encontrado: {emFalta.join(", ")}.</p>}
        </div>
        <Aviso>
          Confirme os valores. A caderneta não indica o preço, o estado de conservação, o certificado energético nem se está em ARU: preencha-os depois. O artigo
          matricial é só para referência e não fica guardado.
        </Aviso>
        <div className="acoes">
          <button data-icone="repor" type="button" className="botao" onClick={() => ficheiro.current?.click()}>
            Escolher outro PDF
          </button>
          <button data-icone="guardar" type="button" className="botao" onClick={() => onAplicar(aplicarCaderneta(i, l, ine))}>
            Usar estes valores
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {escolher}
      <div className="cartao">
        <p style={{ margin: 0 }}>
          Escolha o PDF da <strong>caderneta predial urbana</strong>, descarregado do Portal das Finanças. A app preenche a morada, o município e a freguesia, o tipo de
          imóvel, a tipologia, a área, o VPT, o ano e a localização no mapa.
        </p>
        <ul className="suave">
          <li>A leitura é feita neste aparelho. O PDF não é enviado para lado nenhum nem fica guardado.</li>
          <li>Os titulares (nomes e NIF) não são lidos.</li>
          <li>Antes de preencher, mostra o que leu para confirmar.</li>
        </ul>
      </div>
      {fase.nome === "a-ler" && <p className="suave">{fase.mensagem}</p>}
      {fase.nome === "erro" && (
        <p className="erro" role="alert">
          {fase.mensagem}
        </p>
      )}
      <div className="acoes">
        <button data-icone="fechar" type="button" className="botao" onClick={onCancelar}>
          Cancelar
        </button>
        <button data-icone="importar" type="button" className="botao" disabled={fase.nome === "a-ler"} onClick={() => ficheiro.current?.click()}>
          Escolher o PDF da caderneta
        </button>
      </div>
    </>
  );
}
