import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { BaseDados } from "./bd";
import { abrirComPalavraPasse, criarCofre, existeCofre, recuperarComCodigo } from "./cofre";
import { guardar, ler, listar } from "./repositorio";
import { gerarFicheiroCopia, restaurarCopia } from "./copias";
import { codigoRecuperacaoValido, normalizarCodigoRecuperacao } from "../seguranca/cripto";

let n = 0;
const novaBase = () => new BaseDados(`teste-${n++}`);
const PP = "uma frase bem comprida";

describe("cofre", () => {
  it("cria, abre com a palavra-passe certa e recusa a errada", async () => {
    const base = novaBase();
    expect(await existeCofre(base)).toBe(false);
    const { chave, codigoRecuperacao } = await criarCofre(PP, base);
    expect(await existeCofre(base)).toBe(true);
    expect(codigoRecuperacaoValido(codigoRecuperacao)).toBe(true);

    await guardar(chave, "teste", "1", { valor: 42 }, base);
    const reaberta = await abrirComPalavraPasse(PP, base);
    expect(reaberta).not.toBeNull();
    expect(await ler(reaberta!, "teste", "1", base)).toEqual({ valor: 42 });
    expect(await abrirComPalavraPasse("errada errada errada", base)).toBeNull();
  });

  it("recusa palavras-passe curtas", async () => {
    await expect(criarCofre("curta", novaBase())).rejects.toThrow();
  });

  it("não guarda nada legível na base de dados", async () => {
    const base = novaBase();
    const { chave } = await criarCofre(PP, base);
    await guardar(chave, "perfil", "principal", { nome: "segredo-muito-visivel" }, base);
    const bruto = await base.registos.toArray();
    const texto = new TextDecoder().decode(bruto[0].conteudo.dados);
    expect(texto).not.toContain("segredo-muito-visivel");
  });

  it("recupera com o código (escrito de qualquer forma) e define nova palavra-passe", async () => {
    const base = novaBase();
    const { chave, codigoRecuperacao } = await criarCofre(PP, base);
    await guardar(chave, "teste", "1", "dados", base);
    const escritoAMao = codigoRecuperacao.toLowerCase().replace(/-/g, " ");
    expect(await recuperarComCodigo("AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA", "nova palavra-passe", base)).toBeNull();
    const c2 = await recuperarComCodigo(escritoAMao, "nova palavra-passe", base);
    expect(c2).not.toBeNull();
    expect(await ler(c2!, "teste", "1", base)).toBe("dados");
    expect(await abrirComPalavraPasse(PP, base)).toBeNull();
    expect(await abrirComPalavraPasse("nova palavra-passe", base)).not.toBeNull();
  });
}, 60_000);

describe("cópias", () => {
  it("restaura noutro aparelho com a mesma palavra-passe", async () => {
    const origem = novaBase();
    const { chave } = await criarCofre(PP, origem);
    await guardar(chave, "imovel", "a", { preco: 200000 }, origem);
    await guardar(chave, "imovel", "b", { preco: 150000 }, origem);
    const ficheiro = await gerarFicheiroCopia(origem);
    expect(ficheiro).not.toContain("200000");

    const destino = novaBase();
    const r = await restaurarCopia(ficheiro, destino);
    expect(r.registos).toBe(2);
    const c = await abrirComPalavraPasse(PP, destino);
    expect(c).not.toBeNull();
    const imoveis = await listar<{ preco: number }>(c!, "imovel", destino);
    expect(imoveis.map((i) => i.preco).sort()).toEqual([150000, 200000]);
  });

  it("recusa ficheiros que não são cópias", async () => {
    await expect(restaurarCopia("isto não é json", novaBase())).rejects.toThrow("não é uma cópia");
    await expect(restaurarCopia(JSON.stringify({ formato: "outro" }), novaBase())).rejects.toThrow();
  });
}, 60_000);

describe("código de recuperação", () => {
  it("normaliza letras confundíveis", () => {
    expect(normalizarCodigoRecuperacao("abcde fghij")).toBe("ABCDE-FGH1J");
    expect(normalizarCodigoRecuperacao("o0o0o")).toBe("00000");
  });
});
