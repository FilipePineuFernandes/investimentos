import { Aviso, Ecra } from "../componentes/ui";
import { PARAMETROS, TABELAS_IMT, VERSAO_PARAMETROS } from "../dados/parametros";

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-PT");
const euro = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 0 });
const corEstado = (estado: string) => (estado === "confirmado" ? "var(--sucesso)" : "var(--atencao)");

export function ParametrosEcra({ voltar }: { voltar: () => void }) {
  const porConfirmar = [...PARAMETROS, ...TABELAS_IMT].filter((p) => p.estado === "a confirmar").length;
  return (
    <Ecra titulo="Parâmetros fiscais" voltar={voltar}>
      <p>
        Valores usados nos cálculos, com a fonte e a data de verificação. Versão das tabelas: {data(VERSAO_PARAMETROS)}.
      </p>
      {porConfirmar > 0 && (
        <Aviso tipo="atencao" titulo={`${porConfirmar} valores a confirmar`}>
          Estes valores ainda não foram validados por um contabilista. As tabelas do IRS e as taxas de IMI por município entram mais tarde.
        </Aviso>
      )}
      <div className="cartao tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Parâmetro</th>
              <th>Valor</th>
              <th>Fonte</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {PARAMETROS.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.descricao}
                  {p.nota && <div className="suave">{p.nota}</div>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {p.valor.toLocaleString("pt-PT")} {p.unidade}
                </td>
                <td>
                  {p.fonte}
                  <div className="suave">verificado a {data(p.verificadoEm)}</div>
                </td>
                <td style={{ color: corEstado(p.estado) }}>{p.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {TABELAS_IMT.map((t) => (
        <div key={t.id} className="cartao tabela-rolavel">
          <h3>{t.descricao}</h3>
          <p className="suave">
            {t.fonte} · em vigor desde {data(t.emVigorDesde)} · verificado a {data(t.verificadoEm)} ·{" "}
            <span style={{ color: corEstado(t.estado) }}>{t.estado}</span>
          </p>
          {t.nota && <p className="suave">{t.nota}</p>}
          <table>
            <thead>
              <tr>
                <th>Valor (€)</th>
                <th>Taxa</th>
              </tr>
            </thead>
            <tbody>
              {t.escaloes.map((e, i) => {
                const anterior = i === 0 ? null : t.escaloes[i - 1].ate;
                const intervalo = anterior === null ? `até ${euro(e.ate!)}` : e.ate === null ? `mais de ${euro(anterior)}` : `${euro(anterior)} a ${euro(e.ate)}`;
                return (
                  <tr key={i}>
                    <td>{intervalo}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {e.taxa.toLocaleString("pt-PT")}%{e.unica && " (taxa única)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </Ecra>
  );
}
