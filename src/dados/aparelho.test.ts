import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { BaseDados } from "./bd";
import { aparelhoLembrado, chaveDoAparelho, criarCofre, esquecerAparelho, lembrarAparelho } from "./cofre";
import { gerarFicheiroCopia, restaurarCopia } from "./copias";
import { guardar, ler } from "./repositorio";
import { guardarNome, lerNome } from "./utilizador";

let n = 0;
const novaBase = () => new BaseDados(`teste-aparelho-${n++}`);
const PP = "uma frase bem comprida";

describe("abertura automática neste aparelho", () => {
  it("depois de lembrar, abre os dados sem palavra-passe", async () => {
    const base = novaBase();
    const { chave } = await criarCofre(PP, base);
    await guardar(chave, "teste", "1", { valor: 42 }, base);
    await guardarNome(chave, "  Filipe ");

    expect(await chaveDoAparelho(base)).toBeNull();
    await lembrarAparelho(chave, base);
    expect(await aparelhoLembrado(base)).toBeTruthy();

    const aberta = await chaveDoAparelho(base);
    expect(aberta).not.toBeNull();
    expect(await ler(aberta!, "teste", "1", base)).toEqual({ valor: 42 });
    expect(await lerNome(aberta!)).toBe("Filipe");
  });

  it("esquecer volta a pedir a palavra-passe", async () => {
    const base = novaBase();
    const { chave } = await criarCofre(PP, base);
    await lembrarAparelho(chave, base);
    await esquecerAparelho(base);
    expect(await chaveDoAparelho(base)).toBeNull();
    expect(await aparelhoLembrado(base)).toBeNull();
  });

  it("a chave do aparelho não vai nas cópias, e um restauro obriga a usar a palavra-passe", async () => {
    const base = novaBase();
    const { chave } = await criarCofre(PP, base);
    await lembrarAparelho(chave, base);
    const ficheiro = await gerarFicheiroCopia(base);
    expect(ficheiro).not.toContain("aparelho");
    await restaurarCopia(ficheiro, base);
    expect(await chaveDoAparelho(base)).toBeNull();
  });

  it("uma chave que já não corresponde aos dados é esquecida", async () => {
    const base = novaBase();
    await criarCofre(PP, base);
    const outra = await criarCofre(PP, novaBase());
    await lembrarAparelho(outra.chave, base);
    // Simula uma verificação feita com outra chave.
    const l = await base.locais.get("aparelho");
    const { chave: terceira } = await criarCofre(PP, novaBase());
    await base.locais.put({ ...(l as Extract<typeof l, { id: "aparelho" }>)!, chave: terceira });
    expect(await chaveDoAparelho(base)).toBeNull();
    expect(await aparelhoLembrado(base)).toBeNull();
  });
}, 60_000);
