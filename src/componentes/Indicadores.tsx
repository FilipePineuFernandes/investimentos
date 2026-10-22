import type { ReactNode } from "react";

/** Fila de indicadores: um número de destaque por cartão, com rótulo e nota. */
export function Indicadores({ itens }: { itens: { rotulo: string; valor: ReactNode; nota?: ReactNode; cor?: string }[] }) {
  return (
    <div className="indicadores">
      {itens.map((x) => (
        <div key={x.rotulo} className="indicador">
          <div className="rotulo">{x.rotulo}</div>
          <div className="valor" style={{ color: x.cor }}>
            {x.valor}
          </div>
          {x.nota && <div className="suave" style={{ fontSize: ".85rem" }}>{x.nota}</div>}
        </div>
      ))}
    </div>
  );
}
