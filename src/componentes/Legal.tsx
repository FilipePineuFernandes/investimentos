// Ligação para a página pública da política de privacidade e dos avisos legais
// (public/privacidade.html). Abre num separador novo para a app não perder o desbloqueio.

export const URL_LEGAL = `${import.meta.env.BASE_URL}privacidade.html`;

export function LigacaoLegal({ texto = "Privacidade e avisos legais", seccao }: { texto?: string; seccao?: "privacidade" | "avisos" }) {
  return (
    <a href={seccao ? `${URL_LEGAL}#${seccao}` : URL_LEGAL} target="_blank" rel="noopener">
      {texto}
    </a>
  );
}

/** Rodapé com o aviso de simulação e a ligação para a página legal. */
export function RodapeLegal() {
  return (
    <p className="suave">
      Ferramenta de simulação. Não é aconselhamento financeiro nem fiscal. Os seus dados ficam só neste aparelho. <LigacaoLegal />
    </p>
  );
}
