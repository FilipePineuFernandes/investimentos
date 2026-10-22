import { Aviso, Ecra } from "../componentes/ui";
import { PARAMETROS, VERSAO_PARAMETROS } from "../dados/parametros";

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-PT");

export function ParametrosEcra({ voltar }: { voltar: () => void }) {
  const porConfirmar = PARAMETROS.filter((p) => p.estado === "a confirmar").length;
  return (
    <Ecra titulo="Parâmetros fiscais" voltar={voltar}>
      <p>
        Valores usados nos cálculos, com a fonte e a data de verificação. Versão das tabelas: {data(VERSAO_PARAMETROS)}.
      </p>
      {porConfirmar > 0 && (
        <Aviso tipo="atencao" titulo={`${porConfirmar} valores a confirmar`}>
          Estes valores ainda não foram validados por um contabilista. As tabelas por escalões (IMT, IRS) e as taxas de IMI por município entram na fase 1.
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
                <td style={{ color: p.estado === "confirmado" ? "var(--sucesso)" : "var(--atencao)" }}>{p.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Ecra>
  );
}
