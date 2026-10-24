import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { BaseDados } from "../dados/bd";
import { abrirComBiometria, abrirComPalavraPasse, ativarBiometria, criarCofre, desativarBiometria, recuperarComCodigo, temBiometria } from "../dados/cofre";
import { gerarFicheiroCopia, restaurarCopia } from "../dados/copias";
import { guardar, ler } from "../dados/repositorio";
import { desembrulharComSegredo, embrulharComSegredo, ErroBiometria, type DadosBiometria } from "./biometria";
import { bytesAleatorios, type Bytes } from "./cripto";

let n = 0;
const novaBase = () => new BaseDados(`teste-bio-${n++}`);
const PP = "uma frase bem comprida";

// O aparelho devolve sempre o mesmo segredo para a mesma chave de acesso, depois de reconhecer o rosto.
const segredoDoAparelho = bytesAleatorios(32);
const registarSimulado = async (bruta: Bytes): Promise<DadosBiometria> => ({
  credencialId: bytesAleatorios(16),
  salPrf: bytesAleatorios(32),
  chaveEmbrulhada: await embrulharComSegredo(bruta, segredoDoAparelho),
  criadaEm: "2026-10-24T10:00:00.000Z",
});
const rostoReconhecido = (d: DadosBiometria) => desembrulharComSegredo(d.chaveEmbrulhada, segredoDoAparelho);
const outroAparelho = (d: DadosBiometria) => desembrulharComSegredo(d.chaveEmbrulhada, bytesAleatorios(32));

describe("chave embrulhada com o segredo da biometria", () => {
  it("só se desembrulha com o mesmo segredo", async () => {
    const bruta = bytesAleatorios(32);
    const e = await embrulharComSegredo(bruta, segredoDoAparelho);
    expect(await desembrulharComSegredo(e, segredoDoAparelho)).toEqual(bruta);
    await expect(desembrulharComSegredo(e, bytesAleatorios(32))).rejects.toThrow();
  });
});

describe("desbloqueio com o rosto ou a impressão digital", () => {
  it("ativa com a palavra-passe certa e abre os mesmos dados", async () => {
    const base = novaBase();
    const { chave } = await criarCofre(PP, base);
    await guardar(chave, "teste", "1", { valor: 42 }, base);

    expect(await ativarBiometria("errada errada errada", registarSimulado, base)).toBe(false);
    expect(await temBiometria(base)).toBe(false);
    expect(await ativarBiometria(PP, registarSimulado, base)).toBe(true);
    expect(await temBiometria(base)).toBe(true);

    const aberta = await abrirComBiometria(rostoReconhecido, base);
    expect(await ler(aberta, "teste", "1", base)).toEqual({ valor: 42 });
    await expect(abrirComBiometria(outroAparelho, base)).rejects.toThrow();
  });

  it("continua a funcionar depois de recuperar o acesso com o código", async () => {
    const base = novaBase();
    const { chave, codigoRecuperacao } = await criarCofre(PP, base);
    await guardar(chave, "teste", "1", "dados", base);
    await ativarBiometria(PP, registarSimulado, base);
    await recuperarComCodigo(codigoRecuperacao, "nova palavra-passe", base);
    expect(await ler(await abrirComBiometria(rostoReconhecido, base), "teste", "1", base)).toBe("dados");
  });

  it("desativar remove a biometria; a palavra-passe continua a abrir", async () => {
    const base = novaBase();
    await criarCofre(PP, base);
    await ativarBiometria(PP, registarSimulado, base);
    await desativarBiometria(base);
    expect(await temBiometria(base)).toBe(false);
    await expect(abrirComBiometria(rostoReconhecido, base)).rejects.toBeInstanceOf(ErroBiometria);
    expect(await abrirComPalavraPasse(PP, base)).not.toBeNull();
  });

  it("a biometria é só deste aparelho: não vai nas cópias", async () => {
    const origem = novaBase();
    await criarCofre(PP, origem);
    await ativarBiometria(PP, registarSimulado, origem);
    const ficheiro = await gerarFicheiroCopia(origem);
    expect(ficheiro).not.toContain("biometria");
    const destino = novaBase();
    await restaurarCopia(ficheiro, destino);
    expect(await temBiometria(destino)).toBe(false);
    expect(await abrirComPalavraPasse(PP, destino)).not.toBeNull();
  });
}, 60_000);
