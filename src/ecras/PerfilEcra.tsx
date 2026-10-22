import { useEffect, useState } from "react";
import { Aviso, Campo, CampoNumero, Ecra, Passos } from "../componentes/ui";
import { guardarPerfil, idade, lerPerfil, PERFIL_VAZIO, type Perfil } from "../dados/perfil";

/** Perfil do investidor (ponto 4 da especificação). */
export function PerfilEcra({ chave, assistente, voltar, onGuardado }: { chave: CryptoKey; assistente: boolean; voltar?: () => void; onGuardado: () => void }) {
  const [p, setP] = useState<Perfil | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    lerPerfil(chave).then((x) => setP({ ...PERFIL_VAZIO, ...x, corretora: { ...PERFIL_VAZIO.corretora, ...x?.corretora } }));
  }, [chave]);

  if (!p) return <Ecra titulo="Perfil do investidor">A carregar…</Ecra>;

  const muda = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setP({ ...p, [k]: v });
  const mudaCorretora = <K extends keyof Perfil["corretora"]>(k: K, v: Perfil["corretora"][K]) => setP({ ...p, corretora: { ...p.corretora, [k]: v } });
  const anos = idade(p.dataNascimento);

  async function guardar() {
    setAGuardar(true);
    await guardarPerfil(chave, p!);
    setAGuardar(false);
    onGuardado();
  }

  return (
    <Ecra titulo="Perfil do investidor" voltar={voltar}>
      {assistente && <Passos atual={4} total={4} />}
      <p>
        Estes dados servem para calcular corretamente impostos, limites de crédito e custos. Ficam <strong>só neste aparelho</strong>, cifrados. Pode deixar
        campos em branco e preenchê-los mais tarde.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
        style={{ display: "contents" }}
      >
        <h2>Dados pessoais</h2>
        <div className="cartao grelha">
          <Campo rotulo="Data de nascimento" ajuda={anos !== null ? `${anos} anos. Usada no IMT Jovem e no prazo máximo do crédito.` : "Usada no IMT Jovem e no prazo máximo do crédito."}>
            {(id) => <input id={id} type="date" value={p.dataNascimento} onChange={(e) => muda("dataNascimento", e.target.value)} />}
          </Campo>
          <Campo rotulo="Residência fiscal" ajuda="Define as tabelas de IMT e de IRS.">
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
        <div className="cartao grelha">
          <CampoNumero rotulo="Rendimento mensal líquido do agregado" sufixo="€" valor={p.rendimentoMensalLiquido} onChange={(v) => muda("rendimentoMensalLiquido", v)} ajuda="Para a taxa de esforço do crédito." />
          <CampoNumero rotulo="Outras prestações de crédito" sufixo="€/mês" valor={p.outrasPrestacoes} onChange={(v) => muda("outrasPrestacoes", v)} ajuda="Crédito automóvel, pessoal, cartões…" />
          <CampoNumero rotulo="Rendimento coletável anual estimado" sufixo="€" valor={p.rendimentoColetavelAnual} onChange={(v) => muda("rendimentoColetavelAnual", v)} ajuda="Para o escalão de IRS e o englobamento." />
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
        <div className="cartao grelha">
          <Campo rotulo="Nome da corretora">{(id) => <input id={id} value={p.corretora.nome} onChange={(e) => mudaCorretora("nome", e.target.value)} />}</Campo>
          <CampoNumero rotulo="Comissão fixa por ordem" sufixo="€" valor={p.corretora.comissaoFixa} onChange={(v) => mudaCorretora("comissaoFixa", v)} />
          <CampoNumero rotulo="Comissão percentual" sufixo="%" valor={p.corretora.comissaoPercentagem} onChange={(v) => mudaCorretora("comissaoPercentagem", v)} />
          <CampoNumero rotulo="Custo de câmbio" sufixo="%" valor={p.corretora.cambioPercentagem} onChange={(v) => mudaCorretora("cambioPercentagem", v)} ajuda="Em compras de ETF negociados noutra moeda." />
        </div>

        <Aviso>Moeda de referência: euro.</Aviso>
        <button className="botao" type="submit" disabled={aGuardar}>
          {aGuardar ? "A guardar…" : assistente ? "Guardar e concluir" : "Guardar"}
        </button>
      </form>
    </Ecra>
  );
}
