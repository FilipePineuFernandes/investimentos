// Janela padrão da app: o que um botão abre aparece numa janela por cima do ecrã, com o título e
// a seta «←» para voltar ao passo anterior. Assim a pessoa vê sempre que algo se abriu, em vez de
// uma caixa a aparecer mais abaixo na página. As janelas podem abrir outras por cima.

import { useEffect, useRef, type ReactNode } from "react";
import { Ecra } from "./ui";

/** Quantas janelas estão abertas: enquanto houver alguma, a página de baixo não desliza. */
let abertas = 0;

export function Janela({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    abertas++;
    document.body.classList.add("com-janela");
    // Leva o foco para a seta de voltar (leitores de ecrã e teclado).
    ref.current?.querySelector<HTMLButtonElement>(".cabecalho .botao-icone")?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      const todas = document.querySelectorAll(".janela");
      if (e.key === "Escape" && todas[todas.length - 1] === ref.current) fechar.current();
    };
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      abertas--;
      if (abertas === 0) document.body.classList.remove("com-janela");
    };
  }, []);

  return (
    <div ref={ref} className="janela" role="dialog" aria-modal="true" aria-label={titulo}>
      <Ecra titulo={titulo} voltar={onFechar}>
        {children}
      </Ecra>
    </div>
  );
}
