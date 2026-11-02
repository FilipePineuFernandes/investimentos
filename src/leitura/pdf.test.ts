import { describe, expect, it } from "vitest";
import { lerNota } from "../calculo/notaIrs";
import { extrairTextoPdf, textoDeItens } from "./pdf";

// Nota inventada. Cada linha da tabela tem a etiqueta à esquerda e o valor à direita, como num PDF do Portal das Finanças.
const LINHAS: [string, string][] = [
  ["1 Rendimento global", "40.000,00 €"],
  ["2 Deduções específicas", "4.104,00 €"],
  ["6 Rendimento coletável [1-(2+3+4+5)]", "35.896,00 €"],
  ["9 Total do rendimento para determinação da taxa (6+8-7)", "35.896,00 €"],
  ["10 Quociente familiar 2,00 ; taxa 24,400%", ""],
  ["11 Importância apurada (9:coef. x taxa)", "4.379,31 €"],
  ["12 Parcela a abater", "1.400,00 €"],
  ["18 Coleta total [(11-12)x2,00+13-14+15+16+17]", "5.958,62 €"],
  ["19 Deduções à coleta", "3.000,00 €"],
  ["20 Benefício municipal (1,50% da coleta)", "44,38 €"],
  ["22 Coleta líquida [18-19-20(>=0)+21]", "2.914,24 €"],
  ["23 Pagamentos por conta", "1.200,00 €"],
  ["24 Retenções na fonte", "300,00 €"],
  ["25 Imposto apurado [22-(23+24)]", "1.414,24 €"],
];

/** Texto em bytes WinAnsi (o € é o byte 0x80; as letras acentuadas coincidem com latin1). */
const codificar = (t: string) => Uint8Array.from(t, (c) => (c === "€" ? 0x80 : c.charCodeAt(0) & 0xff));

const juntar = (...partes: Uint8Array[]) => {
  const todo = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    todo.set(p, i);
    i += p.length;
  }
  return todo;
};

// Dentro de um texto de PDF, a barra e os parênteses têm de levar uma barra à frente.
const escapar = (t: string) => t.replace(/[\\()]/g, (c) => "\\" + c);

/** PDF mínimo com texto em posições exatas (letra Helvetica, acentos em WinAnsi). */
function criarPdf(linhas: [string, string][]): Uint8Array {
  let conteudo = "BT\n/F1 9 Tf\n";
  const periodo = "2025-01-01 a 2025-12-31 | 2026-07-01 | 2026 5000000001 | 2026-06-26";
  conteudo += `1 0 0 1 40 800 Tm (${escapar(periodo)}) Tj\n`;
  linhas.forEach(([etiqueta, valor], i) => {
    const y = 760 - i * 18;
    conteudo += `1 0 0 1 40 ${y} Tm (${escapar(etiqueta)}) Tj\n`;
    if (valor) conteudo += `1 0 0 1 480 ${y} Tm (${escapar(valor)}) Tj\n`;
  });
  conteudo += "ET\n";
  const corpo = codificar(conteudo);

  const partes: Uint8Array[] = [codificar("%PDF-1.4\n")];
  const posicoes: number[] = [];
  let tamanho = partes[0].length;
  const objeto = (n: number, texto: string | Uint8Array) => {
    posicoes[n] = tamanho;
    const b = juntar(codificar(`${n} 0 obj\n`), typeof texto === "string" ? codificar(texto) : texto, codificar("\nendobj\n"));
    partes.push(b);
    tamanho += b.length;
  };
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objeto(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>");
  objeto(4, juntar(codificar(`<< /Length ${corpo.length} >>\nstream\n`), corpo, codificar("\nendstream")));
  objeto(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let n = 1; n <= 5; n++) xref += `${String(posicoes[n]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${tamanho}\n%%EOF\n`;
  partes.push(codificar(xref));
  return juntar(...partes);
}

describe("texto de PDF", () => {
  it("junta os pedaços da mesma altura numa linha, da esquerda para a direita", () => {
    const texto = textoDeItens([
      { str: "35.896,00 €", transform: [1, 0, 0, 1, 450, 700] },
      { str: "Rendimento coletável", transform: [1, 0, 0, 1, 40, 701] },
      { str: "Outra linha", transform: [1, 0, 0, 1, 40, 650] },
      { str: "   ", transform: [1, 0, 0, 1, 100, 650] },
    ]);
    expect(texto).toBe("Rendimento coletável  35.896,00 €\nOutra linha");
  });

  it("lê um PDF e a nota sai com todos os valores certos", async () => {
    const texto = await extrairTextoPdf(criarPdf(LINHAS));
    expect(texto).toContain("Deduções específicas");
    expect(texto).toContain("40.000,00 €");
    const n = lerNota([texto]);
    expect(n.valores).toEqual({
      rendimentoGlobal: 40_000,
      deducoesEspecificas: 4104,
      rendimentoColetavel: 35_896,
      rendimentoParaTaxa: 35_896,
      importanciaApurada: 4379.31,
      parcelaAbater: 1400,
      coletaTotal: 5958.62,
      deducoesColeta: 3000,
      beneficioMunicipal: 44.38,
      coletaLiquida: 2914.24,
      pagamentosPorConta: 1200,
      retencoes: 300,
      impostoApurado: 1414.24,
    });
    expect(Object.values(n.origem).every((o) => o === "lido")).toBe(true);
    expect(n.anoRendimentos).toBe(2025);
    expect(n.quocienteFamiliar).toBe(2);
    expect(n.taxaMarginal).toBe(24.4);
    expect(n.duvidas).toEqual([]);
  });
});
