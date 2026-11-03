import { useEffect, useState } from "react";
import { Aviso, Campo, CampoNumero, Ecra, Passos } from "../componentes/ui";
import { anoDaNotaNecessaria, notaDesatualizada } from "../calculo/notaIrs";
import { hojeLocal } from "../calculo/util";
import { descricaoComissao, guardarPerfil, idade, lerPerfil, PERFIL_VAZIO, problemaDataNascimento, temCorretora, type Perfil } from "../dados/perfil";
import { dataPt, euros } from "../util/numeros";
import { NotaIrsPainel } from "./NotaIrsPainel";

const pc = (n: number, casas = 2) => n.toLocaleString("pt-PT", { maximumFractionDigits: casas });

/** Perfil do investidor (ponto 4 da especificação). */
export function PerfilEcra({ chave, assistente, voltar, onGuardado }: { chave: CryptoKey; assistente: boolean; voltar?: () => void; onGuardado: () => void }) {
  const [p, setP] = useState<Perfil | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  /** Data de nascimento já guardada neste aparelho: depois da primeira vez não se volta a pedir. */
  const [dataGuardada, setDataGuardada] = useState("");
  const [corrigirData, setCorrigirData] = useState(false);
  const [aImportar, setAImportar] = useState(false);
  const [versao, setVersao] = useState(0);
  const [editarCorretora, setEditarCorretora] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [tentou, setTentou] = useState(false);

  useEffect(() => {
    lerPerfil(chave).then((x) => {
      const base = { ...PERFIL_VAZIO, ...x, corretora: { ...PERFIL_VAZIO.corretora, ...x?.corretora } };
      setP(base);
      setDataGuardada(x?.dataNascimento ?? "");
      setEditarCorretora(!temCorretora(base.corretora));
    });
  }, [chave]);

  if (!p) return <Ecra titulo="Perfil do investidor">A carregar…</Ecra>;

  const muda = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setP({ ...p, [k]: v });
  const mudaCorretora = <K extends keyof Perfil["corretora"]>(k: K, v: Perfil["corretora"][K]) => setP({ ...p, corretora: { ...p.corretora, [k]: v } });
  const anos = idade(p.dataNascimento);
  const hoje = hojeLocal();
  const dataBloqueada = !corrigirData && problemaDataNascimento(dataGuardada) === null;
  const problemaData = dataBloqueada ? null : problemaDataNascimento(p.dataNascimento);
  const nota = p.nota;
  const necessaria = anoDaNotaNecessaria(hoje);

  async function guardar() {
    setTentou(true);
    if (problemaData) return;
    setAGuardar(true);
    await guardarPerfil(chave, p!);
    setAGuardar(false);
    onGuardado();
  }

  function corrigir() {
    if (window.confirm("A data de nascimento não muda com o tempo. Só a corrija se se enganou ao escrevê-la. Continuar?")) setCorrigirData(true);
  }

  if (aImportar) {
    return (
      <Ecra titulo="Nota de liquidação de IRS" voltar={() => setAImportar(false)}>
        <NotaIrsPainel
          perfil={p}
          onCancelar={() => setAImportar(false)}
          onAplicar={(novo) => {
            setP(novo);
            setVersao((v) => v + 1);
            setAImportar(false);
            setMensagem("Valores da nota aplicados ao perfil. Carregue em «Guardar» para os guardar.");
          }}
        />
      </Ecra>
    );
  }

  const c = p.corretora;

  return (
    <Ecra titulo="Perfil do investidor" voltar={voltar}>
      {assistente && <Passos atual={4} total={4} />}
      <p>
        Estes dados servem para calcular corretamente impostos, limites de crédito e custos. Ficam <strong>só neste aparelho</strong>, cifrados.
        {assistente ? " A data de nascimento é obrigatória e só é pedida esta vez; os restantes campos pode deixá-los em branco e preenchê-los mais tarde." : " Pode deixar campos em branco e preenchê-los mais tarde."}
      </p>
      {mensagem && <Aviso tipo="sucesso">{mensagem}</Aviso>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        style={{ display: "contents" }}
      >
        <h2>Dados pessoais</h2>
        <div className="cartao grelha">
          {dataBloqueada ? (
            <div className="campo">
              <span className="rotulo-campo">Data de nascimento</span>
              <div>
                {dataPt(dataGuardada)} {idade(dataGuardada) !== null && <span className="suave">({idade(dataGuardada)} anos)</span>}
              </div>
              <small className="ajuda">
                Já está guardada neste aparelho e não volta a ser pedida. Usada no IMT Jovem e no prazo máximo do crédito.{" "}
                <button type="button" className="botao-ligacao" style={{ padding: 0 }} onClick={corrigir}>
                  Corrigir engano
                </button>
              </small>
            </div>
          ) : (
            <Campo
              rotulo="Data de nascimento"
              ajuda={
                tentou && problemaData ? (
                  <span className="erro-texto">{problemaData}</span>
                ) : anos !== null && !problemaData ? (
                  `${anos} anos. Escreva-a com atenção: depois de guardada não volta a ser pedida. Usada no IMT Jovem e no prazo máximo do crédito.`
                ) : (
                  "Obrigatória. Escreva-a com atenção: depois de guardada não volta a ser pedida. Usada no IMT Jovem e no prazo máximo do crédito."
                )
              }
            >
              {(id) => <input id={id} type="date" max={hoje} value={p.dataNascimento} aria-invalid={tentou && !!problemaData} onChange={(e) => muda("dataNascimento", e.target.value)} />}
            </Campo>
          )}
          <Campo rotulo="Residência fiscal" ajuda="Sugerimos Continente; altere se vive nos Açores ou na Madeira (a nota de liquidação de IRS também a confirma). Define as tabelas de IMT e de IRS.">
            {(id) => (
              <select id={id} value={p.residenciaFiscal} onChange={(e) => muda("residenciaFiscal", e.target.value as Perfil["residenciaFiscal"])}>
                <option value="continente">Continente</option>
                <option value="acores">Açores</option>
                <option value="madeira">Madeira</option>
              </select>
            )}
          </Campo>
        </div>

        <h2>Rendimentos e créditos</h2>
        <div className="cartao">
          <h3 style={{ marginTop: 0 }}>Nota de liquidação de IRS</h3>
          {nota ? (
            <>
              <dl className="lista">
                <dt>Rendimentos de</dt>
                <dd>
                  {nota.anoRendimentos}
                  {nota.dataLiquidacao ? ` (liquidada em ${dataPt(nota.dataLiquidacao)})` : ""}
                </dd>
                {(nota.rendimentoParaTaxa ?? nota.rendimentoColetavel) !== null && (
                  <>
                    <dt>Rendimento da taxa</dt>
                    <dd>{euros((nota.rendimentoParaTaxa ?? nota.rendimentoColetavel)!)}</dd>
                  </>
                )}
                <dt>Tributação</dt>
                <dd>
                  {nota.quocienteFamiliar >= 2 ? `Conjunta, quociente ${pc(nota.quocienteFamiliar)}` : "Individual"}
                  {nota.taxaMarginal !== null ? ` · escalão de ${pc(nota.taxaMarginal, 3)} %` : ""}
                </dd>
                {nota.impostoApurado !== null && (
                  <>
                    <dt>Imposto apurado</dt>
                    <dd>
                      {nota.impostoApurado >= 0 ? `${euros(nota.impostoApurado)} a pagar` : `${euros(-nota.impostoApurado)} a receber`}
                      {nota.taxaEfetiva !== null ? ` · taxa efetiva ${pc(nota.taxaEfetiva)} %` : ""}
                    </dd>
                  </>
                )}
              </dl>
              {notaDesatualizada(nota, hoje) ? (
                <Aviso tipo="atencao" titulo="Falta a nota de liquidação mais recente">
                  A nota dos rendimentos de {nota.anoRendimentos} só servia até 31 de agosto de {nota.anoRendimentos + 2}. Envie a nota de liquidação dos rendimentos de{" "}
                  <strong>{necessaria}</strong>.
                </Aviso>
              ) : (
                <small className="ajuda">
                  Esta nota serve até 31 de agosto de {nota.anoRendimentos + 2}. A partir de 1 de setembro de {nota.anoRendimentos + 2} a app pede a dos rendimentos de {nota.anoRendimentos + 1}.
                </small>
              )}
            </>
          ) : (
            <p className="suave" style={{ marginTop: 0 }}>
              Em vez de escrever o rendimento, fotografe a nota de liquidação de IRS (ou use o PDF do Portal das Finanças): a app preenche o rendimento e o quociente familiar.
            </p>
          )}
          <button type="button" className={notaDesatualizada(nota, hoje) || !nota ? "botao" : "botao botao-secundario"} onClick={() => setAImportar(true)}>
            {nota ? "Atualizar com outra nota" : "Preencher com a nota de liquidação"}
          </button>
        </div>

        <div className="cartao grelha">
          <CampoNumero rotulo="Rendimento mensal líquido do agregado" sufixo="€" valor={p.rendimentoMensalLiquido} onChange={(v) => muda("rendimentoMensalLiquido", v)} ajuda="Para a taxa de esforço do crédito. A nota não o indica." />
          <CampoNumero rotulo="Outras prestações de crédito" sufixo="€/mês" valor={p.outrasPrestacoes} onChange={(v) => muda("outrasPrestacoes", v)} ajuda="Crédito automóvel, pessoal, cartões…" />
          <CampoNumero
            key={`rendimento-${versao}`}
            rotulo="Rendimento coletável anual estimado"
            sufixo="€"
            valor={p.rendimentoColetavelAnual}
            onChange={(v) => muda("rendimentoColetavelAnual", v)}
            ajuda={nota ? `Veio da nota de liquidação de ${nota.anoRendimentos}. Pode corrigi-lo à mão.` : "Para o escalão de IRS e o englobamento."}
          />
          <Campo rotulo="Tributação do IRS" ajuda="Com tributação conjunta de casal o escalão calcula-se sobre metade do rendimento (quociente 2). A nota de liquidação preenche-o.">
            {(id) => (
              <select id={id} value={String(p.quocienteFamiliar)} onChange={(e) => muda("quocienteFamiliar", Number(e.target.value))}>
                <option value="1">Individual (quociente 1)</option>
                <option value="2">Conjunta de casal (quociente 2)</option>
                {p.quocienteFamiliar !== 1 && p.quocienteFamiliar !== 2 && <option value={String(p.quocienteFamiliar)}>Quociente {pc(p.quocienteFamiliar)}</option>}
              </select>
            )}
          </Campo>
        </div>

        <h2>Opções de IRS</h2>
        <div className="cartao">
          <label className="caixa">
            <input type="checkbox" checked={p.englobamentoRendas} onChange={(e) => muda("englobamentoRendas", e.target.checked)} />
            <span>Optar pelo englobamento das rendas (em vez da taxa autónoma)</span>
          </label>
          <label className="caixa">
            <input type="checkbox" checked={p.englobamentoMaisValias} onChange={(e) => muda("englobamentoMaisValias", e.target.checked)} />
            <span>Optar pelo englobamento das mais-valias de ETF (em vez da taxa de 28%)</span>
          </label>
          <small className="ajuda">Na dúvida, deixe por marcar. A app mostra o efeito de cada opção nas simulações.</small>
        </div>

        <h2>Investimento em ETF</h2>
        <div className="cartao grelha">
          <Campo rotulo="Tolerância ao risco">
            {(id) => (
              <select id={id} value={p.toleranciaRisco} onChange={(e) => muda("toleranciaRisco", e.target.value as Perfil["toleranciaRisco"])}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            )}
          </Campo>
          <Campo rotulo="Alocação-alvo da carteira" ajuda="Base das sugestões de equilíbrio. A alocação personalizada chega na fase 3.">
            {(id) => (
              <select id={id} value={p.modeloAlocacao} onChange={(e) => muda("modeloAlocacao", e.target.value as Perfil["modeloAlocacao"])}>
                <option value="global-capitalizacao">Global por capitalização</option>
                <option value="global-mais-europa">Global com mais Europa</option>
                <option value="personalizada" disabled>
                  Personalizada (em breve)
                </option>
              </select>
            )}
          </Campo>
        </div>

        <h2>Corretora principal</h2>
        {!editarCorretora ? (
          <div className="cartao">
            <dl className="lista">
              <dt>Corretora</dt>
              <dd>{c.nome}</dd>
              <dt>Comissão por ordem</dt>
              <dd>{descricaoComissao(c)}</dd>
              <dt>Custo de câmbio</dt>
              <dd>{c.cambioPercentagem ? `${pc(c.cambioPercentagem, 3)} % (só em ETF noutra moeda)` : "Sem custo indicado"}</dd>
              <dt>Custódia anual</dt>
              <dd>{c.custodiaAnualPercentagem ? `${pc(c.custodiaAnualPercentagem, 3)} % ao ano` : "Sem custo indicado"}</dd>
            </dl>
            <button type="button" className="botao botao-secundario" onClick={() => setEditarCorretora(true)}>
              Alterar dados da corretora
            </button>
          </div>
        ) : (
          <div className="cartao grelha">
            <Campo rotulo="Nome da corretora">{(id) => <input id={id} value={c.nome} onChange={(e) => mudaCorretora("nome", e.target.value)} />}</Campo>
            <CampoNumero rotulo="Comissão fixa por ordem" sufixo="€" valor={c.comissaoFixa} onChange={(v) => mudaCorretora("comissaoFixa", v)} />
            <CampoNumero rotulo="Comissão percentual" sufixo="%" valor={c.comissaoPercentagem} onChange={(v) => mudaCorretora("comissaoPercentagem", v)} />
            <CampoNumero rotulo="Comissão mínima por ordem" sufixo="€" valor={c.comissaoMinima ?? null} onChange={(v) => mudaCorretora("comissaoMinima", v)} ajuda="Se a corretora cobra pelo menos este valor em cada ordem." />
            <CampoNumero rotulo="Comissão máxima por ordem" sufixo="€" valor={c.comissaoMaxima ?? null} onChange={(v) => mudaCorretora("comissaoMaxima", v)} ajuda="Se a corretora nunca cobra mais do que isto por ordem." />
            <CampoNumero rotulo="Custo de câmbio" sufixo="%" valor={c.cambioPercentagem} onChange={(v) => mudaCorretora("cambioPercentagem", v)} ajuda="Em compras de ETF negociados noutra moeda." />
            <CampoNumero rotulo="Custódia anual" sufixo="%" valor={c.custodiaAnualPercentagem ?? null} onChange={(v) => mudaCorretora("custodiaAnualPercentagem", v)} ajuda="Taxa anual sobre o valor em carteira, se a corretora a cobrar. Entra nas projeções como o TER." />
            {temCorretora(c) && (
              <button type="button" className="botao botao-secundario" onClick={() => setEditarCorretora(false)}>
                Fechar a edição
              </button>
            )}
          </div>
        )}

        <Aviso>Moeda de referência: euro.</Aviso>
        {tentou && problemaData && <Aviso tipo="erro">{problemaData}</Aviso>}
        <button className="botao" type="submit" disabled={aGuardar}>
          {aGuardar ? "A guardar…" : assistente ? "Guardar e concluir" : "Guardar"}
        </button>
      </form>
    </Ecra>
  );
}
