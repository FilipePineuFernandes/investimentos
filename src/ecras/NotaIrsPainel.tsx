import { useRef, useState } from "react";
import { Aviso, Campo } from "../componentes/ui";
import { anoDaNotaNecessaria, aplicarNotaAoPerfil, CAMPOS_NOTA, conferirNota, criarNota, lerNota, type CampoNota, type LeituraNota, type Valores } from "../calculo/notaIrs";
import { hojeLocal } from "../calculo/util";
import type { Perfil, Regiao } from "../dados/perfil";
import { lerNumero, textoNumero } from "../util/numeros";

/** Valor com duas casas decimais, como vem no papel: 35896,00. */
const comCentimos = (n: number | undefined) => (n === undefined ? "" : n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }));

const NOME_REGIAO: Record<Regiao, string> = { continente: "Continente", acores: "Açores", madeira: "Madeira" };

type Fase = { nome: "inicio" } | { nome: "a-ler"; mensagem: string; fracao: number } | { nome: "rever"; leitura: LeituraNota } | { nome: "erro"; mensagem: string };

/**
 * Preenche o IRS do perfil a partir da nota de liquidação (fotografia ou PDF). A leitura corre no aparelho:
 * a fotografia não é enviada nem guardada, e só ficam os números e datas da tabela da nota.
 */
export function NotaIrsPainel({ perfil, onAplicar, onCancelar }: { perfil: Perfil; onAplicar: (p: Perfil) => void; onCancelar: () => void }) {
  const [fase, setFase] = useState<Fase>({ nome: "inicio" });
  const camara = useRef<HTMLInputElement>(null);
  const ficheiro = useRef<HTMLInputElement>(null);
  const hoje = hojeLocal();
  const necessaria = anoDaNotaNecessaria(hoje);

  async function aoEscolher(f: File | undefined) {
    if (!f) return;
    setFase({ nome: "a-ler", mensagem: "A preparar…", fracao: 0 });
    try {
      const { lerFicheiroDaNota } = await import("../leitura/leitor");
      const textos = await lerFicheiroDaNota(f, (mensagem, fracao) => setFase({ nome: "a-ler", mensagem, fracao }));
      const leitura = lerNota(textos);
      const lidos = CAMPOS_NOTA.filter((c) => leitura.valores[c.campo] !== undefined).length;
      if (lidos < 4) {
        setFase({
          nome: "erro",
          mensagem:
            "Não consegui encontrar a tabela da nota de liquidação. Fotografe a nota de frente e inteira, com boa luz e sem sombras, ou use o PDF da nota (descarregado do Portal das Finanças), que se lê sem erros.",
        });
        return;
      }
      setFase({ nome: "rever", leitura });
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : String(e);
      setFase({ nome: "erro", mensagem: `Não foi possível ler o ficheiro. ${detalhe}` });
    }
  }

  return (
    <>
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => aoEscolher(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
      <input ref={ficheiro} type="file" accept="image/*,application/pdf,.pdf" hidden onChange={(e) => aoEscolher(e.target.files?.[0]).finally(() => (e.target.value = ""))} />

      {fase.nome === "inicio" && (
        <div className="cartao">
          <p>
            Fotografe a <strong>nota de liquidação de IRS</strong> (ou escolha o PDF descarregado do Portal das Finanças). A app lê só a tabela dos valores e preenche o
            rendimento e o quociente familiar do perfil.
          </p>
          <ul className="suave">
            <li>A leitura é feita neste aparelho. A fotografia não é enviada para lado nenhum nem fica guardada.</li>
            <li>Nomes, NIF e morada não são lidos nem guardados: só os números da tabela e as datas.</li>
            <li>Na primeira vez a app descarrega o leitor de texto (cerca de 6 MB). Depois fica guardado.</li>
            <li>
              A app precisa da nota dos rendimentos de <strong>{necessaria}</strong>.
            </li>
          </ul>
          <div className="acoes">
            <button type="button" className="botao" onClick={() => camara.current?.click()}>
              Fotografar a nota
            </button>
            <button type="button" className="botao botao-secundario" onClick={() => ficheiro.current?.click()}>
              Escolher fotografia ou PDF
            </button>
          </div>
          <button type="button" className="botao-ligacao" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      )}

      {fase.nome === "a-ler" && (
        <div className="cartao" role="status">
          <p>
            <strong>{fase.mensagem}</strong>
          </p>
          <div className="progresso" aria-hidden>
            <span style={{ width: `${Math.round(fase.fracao * 100)}%` }} />
          </div>
          <small className="ajuda">Pode demorar meio minuto. Não feche a app.</small>
        </div>
      )}

      {fase.nome === "erro" && (
        <div className="cartao">
          <Aviso tipo="erro" titulo="Leitura sem sucesso">
            {fase.mensagem}
          </Aviso>
          <div className="acoes">
            <button type="button" className="botao" onClick={() => setFase({ nome: "inicio" })}>
              Tentar outra vez
            </button>
            <button type="button" className="botao botao-secundario" onClick={onCancelar}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {fase.nome === "rever" && <RevisaoNota leitura={fase.leitura} perfil={perfil} hoje={hoje} necessaria={necessaria} onConfirmar={onAplicar} onVoltar={() => setFase({ nome: "inicio" })} />}
    </>
  );
}

type Estado = "normal" | "calculado" | "duvida" | "falta";

function RevisaoNota({
  leitura,
  perfil,
  hoje,
  necessaria,
  onConfirmar,
  onVoltar,
}: {
  leitura: LeituraNota;
  perfil: Perfil;
  hoje: string;
  necessaria: number;
  onConfirmar: (p: Perfil) => void;
  onVoltar: () => void;
}) {
  const inicial = Object.fromEntries(CAMPOS_NOTA.map((c) => [c.campo, comCentimos(leitura.valores[c.campo])])) as Record<CampoNota, string>;
  const [texto, setTexto] = useState(inicial);
  const [ano, setAno] = useState(leitura.anoRendimentos ? String(leitura.anoRendimentos) : "");
  const [dataLiquidacao, setDataLiquidacao] = useState(leitura.dataLiquidacao ?? "");
  const [prazo, setPrazo] = useState(leitura.dataLimitePagamento ?? "");
  const [quociente, setQuociente] = useState(textoNumero(leitura.quocienteFamiliar));
  const [taxa, setTaxa] = useState(textoNumero(leitura.taxaMarginal, 3));
  const [mudarRegiao, setMudarRegiao] = useState(leitura.regiao !== null && leitura.regiao !== perfil.residenciaFiscal);
  const [conferi, setConferi] = useState(false);

  const valores: Valores = {};
  for (const { campo } of CAMPOS_NOTA) {
    const n = lerNumero(texto[campo]);
    if (n !== null) valores[campo] = n;
  }
  const q = lerNumero(quociente);
  const taxaNum = lerNumero(taxa);
  const { duvidas, avisos } = conferirNota(valores, q, taxaNum);

  const estado = (campo: CampoNota): Estado => {
    if (texto[campo].trim() === "") return "falta";
    if (duvidas.includes(campo)) return "duvida";
    if (leitura.origem[campo] === "calculado" && texto[campo] === inicial[campo]) return "calculado";
    return "normal";
  };

  const anoNum = Number(ano);
  const rendimento = valores.rendimentoParaTaxa ?? valores.rendimentoColetavel;
  const completa = Number.isInteger(anoNum) && anoNum >= 2000 && anoNum <= 2100 && rendimento !== undefined && rendimento >= 0 && q !== null && q >= 1;
  const regiaoNota = leitura.regiao;

  function confirmar() {
    const nota = criarNota(
      {
        valores,
        anoRendimentos: anoNum,
        dataLiquidacao: dataLiquidacao || null,
        dataLimitePagamento: prazo || null,
        quocienteFamiliar: q!,
        taxaMarginal: taxaNum,
        taxaEfetiva: leitura.taxaEfetiva,
        regiao: regiaoNota,
      },
      hoje,
    );
    onConfirmar(aplicarNotaAoPerfil(perfil, nota, mudarRegiao ? regiaoNota : null));
  }

  return (
    <div className="cartao">
      <h3 style={{ marginTop: 0 }}>Confirme os valores com o papel</h3>
      <p className="suave">
        Linhas <strong>a vermelho</strong> faltam ou não batem certo com as contas da nota. Linhas <strong>a amarelo</strong> foram calculadas pelas contas da própria nota. Corrija
        o que estiver diferente do papel.
      </p>

      {avisos.length > 0 && (
        <Aviso tipo="atencao" titulo="Há contas da nota que não batem certo">
          <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {anoNum > 0 && anoNum < necessaria && (
        <Aviso tipo="atencao">
          Esta nota é dos rendimentos de {anoNum}, mas a app precisa agora da de {necessaria}. Pode usá-la, mas a de {necessaria} é mais atual.
        </Aviso>
      )}

      <div className="grelha">
        <Campo rotulo="Ano dos rendimentos">{(id) => <input id={id} inputMode="numeric" value={ano} aria-invalid={ano !== "" && !completa && !(anoNum >= 2000)} onChange={(e) => setAno(e.target.value)} />}</Campo>
        <Campo rotulo="Quociente familiar" ajuda="2,00 = tributação conjunta de casal; 1,00 = individual.">
          {(id) => <input id={id} inputMode="decimal" value={quociente} aria-invalid={q === null || q < 1} onChange={(e) => setQuociente(e.target.value)} />}
        </Campo>
        <Campo rotulo="Taxa do escalão" ajuda="Em %, linha 10 da nota.">
          {(id) => <input id={id} inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} />}
        </Campo>
        <Campo rotulo="Data da liquidação">{(id) => <input id={id} type="date" value={dataLiquidacao} onChange={(e) => setDataLiquidacao(e.target.value)} />}</Campo>
        <Campo rotulo="Prazo de pagamento (opcional)">{(id) => <input id={id} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />}</Campo>
      </div>

      <div className="tabela-rolavel">
        <table className="tabela-nota">
          <thead>
            <tr>
              <th>Linha</th>
              <th>Descrição</th>
              <th>Valor (€)</th>
            </tr>
          </thead>
          <tbody>
            {CAMPOS_NOTA.map(({ campo, linha, rotulo }) => {
              const e = estado(campo);
              return (
                <tr key={campo} className={e === "duvida" || e === "falta" ? "linha-duvida" : e === "calculado" ? "linha-calculada" : undefined}>
                  <td>{linha}</td>
                  <td>
                    {rotulo}
                    {e === "calculado" && <span className="etiqueta"> calculado</span>}
                    {e === "falta" && <span className="etiqueta etiqueta-erro"> em falta</span>}
                  </td>
                  <td>
                    <input
                      aria-label={`Linha ${linha}: ${rotulo}`}
                      inputMode="decimal"
                      value={texto[campo]}
                      aria-invalid={e === "duvida" || e === "falta"}
                      onChange={(ev) => setTexto({ ...texto, [campo]: ev.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {leitura.aReceber && <small className="ajuda">Esta nota acaba em reembolso: o imposto apurado é negativo.</small>}

      {regiaoNota && regiaoNota !== perfil.residenciaFiscal && (
        <label className="caixa">
          <input type="checkbox" checked={mudarRegiao} onChange={(e) => setMudarRegiao(e.target.checked)} />
          <span>
            Mudar a residência fiscal de {NOME_REGIAO[perfil.residenciaFiscal]} para <strong>{NOME_REGIAO[regiaoNota]}</strong>, como indicam os códigos postais da nota.
          </span>
        </label>
      )}
      {regiaoNota && regiaoNota === perfil.residenciaFiscal && <small className="ajuda">Residência fiscal: {NOME_REGIAO[regiaoNota]}, confirmada pelos códigos postais da nota.</small>}

      <label className="caixa">
        <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} />
        <span>Conferi estes valores com a nota de liquidação.</span>
      </label>

      <div className="acoes">
        <button type="button" className="botao" disabled={!completa || !conferi} onClick={confirmar}>
          Usar estes valores
        </button>
        <button type="button" className="botao botao-secundario" onClick={onVoltar}>
          Ler outra vez
        </button>
      </div>
      <small className="ajuda">Só ficam guardados os números desta tabela e as datas, cifrados neste aparelho. Os valores só entram no perfil quando carregar em «Guardar».</small>
    </div>
  );
}
