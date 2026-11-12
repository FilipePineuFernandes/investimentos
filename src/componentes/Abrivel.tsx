import { useState, type ReactNode } from "react";
import { Janela } from "./Janela";

/** Botão com o título que abre o conteúdo numa janela por cima do ecrã; «←» volta atrás. */
export function Abrivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <div className="acoes">
        <button type="button" className="botao botao-verde" aria-haspopup="dialog" onClick={() => setAberto(true)}>
          {titulo}
        </button>
      </div>
      {aberto && (
        <Janela titulo={titulo} onFechar={() => setAberto(false)}>
          {children}
        </Janela>
      )}
    </>
  );
}
