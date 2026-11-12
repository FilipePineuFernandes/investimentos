// Gráfico de barras horizontais: comparar valores (por imóvel, por ETF, por setor…). As barras
// partem de zero; com valores negativos (lucro), as perdas vão para a esquerda a vermelho e os
// ganhos para a direita a azul, sempre com o valor escrito (com sinal) ao lado. Nome por cima de
// cada barra, para os nomes compridos caberem no telemóvel.

export interface Barra {
  id: string;
  nome: string;
  valor: number;
}

export function GraficoBarras({ barras, formato, descricao }: { barras: Barra[]; formato: (n: number) => string; descricao: string }) {
  if (barras.length === 0) return <p className="suave">Não há valores para desenhar.</p>;
  const lista = [...barras].sort((a, b) => b.valor - a.valor);
  const max = Math.max(0, ...lista.map((b) => b.valor));
  const min = Math.min(0, ...lista.map((b) => b.valor));
  const amplitude = max - min || 1;
  const zero = (-min / amplitude) * 100; // posição do zero, em % da largura
  const temNegativos = min < 0;

  return (
    <div className="grafico-viz grafico-barras" role="img" aria-label={`${descricao}. ${lista.map((b) => `${b.nome}: ${formato(b.valor)}`).join("; ")}`}>
      {lista.map((b) => {
        const largura = (Math.abs(b.valor) / amplitude) * 100;
        const esquerda = b.valor >= 0 ? zero : zero - largura;
        return (
          <div key={b.id} className="barra-linha" title={`${b.nome}: ${formato(b.valor)}`}>
            <div className="barra-cabeca">
              <span className="barra-nome">{b.nome}</span>
              <span className="barra-valor">{formato(b.valor)}</span>
            </div>
            <div className="barra-pista">
              {temNegativos && <span className="barra-zero" style={{ left: `${zero}%` }} aria-hidden="true" />}
              <span
                className={`barra-marca ${b.valor < 0 ? "negativa" : "positiva"}`}
                style={{ left: `${esquerda}%`, width: `${Math.max(largura, b.valor === 0 ? 0 : 0.8)}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
      {temNegativos && (
        <p className="grafico-legenda-polaridade suave">
          <span className="amostra-serie" style={{ background: "var(--div-positivo)" }} aria-hidden="true" /> Ganho
          <span className="amostra-serie" style={{ background: "var(--div-negativo)", marginLeft: 12 }} aria-hidden="true" /> Perda
        </p>
      )}
    </div>
  );
}
