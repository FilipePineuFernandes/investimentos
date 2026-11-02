// Texto de um PDF (por exemplo a nota de liquidação descarregada do Portal das Finanças), lido no aparelho.

export interface ItemTexto {
  str: string;
  transform: number[];
}

/** Junta os pedaços de texto de uma página em linhas: mesma altura = mesma linha, da esquerda para a direita. */
export function textoDeItens(items: ItemTexto[]): string {
  const linhas: { y: number; itens: { x: number; str: string }[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const linha = linhas.find((l) => Math.abs(l.y - y) <= 3);
    if (linha) linha.itens.push({ x, str: item.str });
    else linhas.push({ y, itens: [{ x, str: item.str }] });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) =>
      l.itens
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str.trim())
        .join("  "),
    )
    .join("\n");
}

const MAX_PAGINAS = 6;

/** Texto de todas as páginas. `workerSrc` é o endereço do trabalhador do leitor de PDF (só no navegador). */
export async function extrairTextoPdf(dados: Uint8Array, workerSrc?: string): Promise<string> {
  // Versão "legacy": funciona também em telemóveis mais antigos.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const tarefa = pdfjs.getDocument({ data: dados, useSystemFonts: true });
  const documento = await tarefa.promise;
  try {
    const paginas: string[] = [];
    for (let n = 1; n <= Math.min(documento.numPages, MAX_PAGINAS); n++) {
      const pagina = await documento.getPage(n);
      const conteudo = await pagina.getTextContent();
      paginas.push(textoDeItens(conteudo.items.filter((i): i is typeof i & ItemTexto => "str" in i)));
    }
    return paginas.join("\n");
  } finally {
    await tarefa.destroy();
  }
}
