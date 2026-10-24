/**
 * Selo de origem de um valor de referência (ponto 2.3): fonte, período e data.
 * Fica a cor de laranja, com "desatualizado", quando passou o prazo de validade.
 */
export function Selo({ fonte, periodo, data, desatualizado }: { fonte: string; periodo?: string; data?: string; desatualizado?: boolean }) {
  return (
    <span className="selo" style={desatualizado ? { color: "var(--atencao)", background: "var(--atencao-fundo)" } : undefined}>
      Fonte: {fonte}
      {periodo && ` · referente a ${periodo}`}
      {data && ` · ${data}`}
      {desatualizado && " · desatualizado"}
    </span>
  );
}
