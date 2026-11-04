import { useState, type ReactNode } from "react";

/** Só mostra o conteúdo se a pessoa o abrir: um botão com o título, e «Fechar» para o esconder outra vez. */
export function Abrivel({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <div className="acoes">
        <button type="button" className="botao botao-verde" aria-expanded={false} onClick={() => setAberto(true)}>
          {titulo}
        </button>
      </div>
    );
  }
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{titulo}</h2>
        <button type="button" className="botao botao-secundario" aria-expanded onClick={() => setAberto(false)}>
          Fechar
        </button>
      </div>
      {children}
    </>
  );
}
