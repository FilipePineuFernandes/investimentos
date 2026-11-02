import { describe, expect, it } from "vitest";
import { FORMATO, type FicheiroCopia } from "../dados/copias";
import { fundir, mesmoCofre } from "./fusao";

const cifrado = { iv: "AA==", dados: "AA==" };
const cofre = (criadoEm = "2026-01-01T00:00:00.000Z", atualizadoEm?: string): FicheiroCopia["cofre"] => ({
  id: "principal",
  versao: 1,
  criadoEm,
  ...(atualizadoEm ? { atualizadoEm } : {}),
  argon2: {} as FicheiroCopia["cofre"]["argon2"],
  salPalavraPasse: "",
  chaveViaPalavraPasse: cifrado,
  salRecuperacao: "",
  chaveViaRecuperacao: cifrado,
});
const reg = (tipo: string, id: string, atualizadoEm: string) => ({ tipo, id, atualizadoEm, conteudo: cifrado });
const ficheiro = (registos: FicheiroCopia["registos"], apagados: { tipo: string; id: string; em: string }[] = [], c = cofre()): FicheiroCopia => ({
  formato: FORMATO,
  versao: 1,
  criadoEm: "2026-06-01T00:00:00.000Z",
  cofre: c,
  registos,
  apagados,
});

const T1 = "2026-03-01T10:00:00.000Z";
const T2 = "2026-03-02T10:00:00.000Z";
const T3 = "2026-03-03T10:00:00.000Z";
const ids = (f: FicheiroCopia) => f.registos.map((r) => `${r.tipo}/${r.id}`).sort();

describe("fusão de dados entre aparelhos", () => {
  it("junta o que só existe de um lado e o que só existe do outro", () => {
    const r = fundir(ficheiro([reg("imovel", "a", T1)]), ficheiro([reg("imovel", "b", T1)]));
    expect(ids(r.ficheiro)).toEqual(["imovel/a", "imovel/b"]);
    expect(r.mudouLocal).toBe(true);
    expect(r.mudouRemoto).toBe(true);
  });

  it("fica a versão mais recente de cada registo", () => {
    const r = fundir(ficheiro([reg("perfil", "p", T1), reg("imovel", "a", T3)]), ficheiro([reg("perfil", "p", T2), reg("imovel", "a", T1)]));
    const por = Object.fromEntries(r.ficheiro.registos.map((x) => [`${x.tipo}/${x.id}`, x.atualizadoEm]));
    expect(por).toEqual({ "perfil/p": T2, "imovel/a": T3 });
    expect(r.mudouLocal).toBe(true);
    expect(r.mudouRemoto).toBe(true);
  });

  it("não muda nada quando os dois lados são iguais", () => {
    const r = fundir(ficheiro([reg("perfil", "p", T1)]), ficheiro([reg("perfil", "p", T1)]));
    expect(r.mudouLocal).toBe(false);
    expect(r.mudouRemoto).toBe(false);
  });

  it("um registo apagado depois da última alteração apaga-se nos dois", () => {
    const r = fundir(ficheiro([], [{ tipo: "imovel", id: "a", em: T3 }]), ficheiro([reg("imovel", "a", T2)]));
    expect(ids(r.ficheiro)).toEqual([]);
    expect(r.ficheiro.apagados).toEqual([{ tipo: "imovel", id: "a", em: T3 }]);
    expect(r.mudouRemoto).toBe(true);
    expect(r.mudouLocal).toBe(false);
  });

  it("um registo alterado depois de apagado volta a existir", () => {
    const r = fundir(ficheiro([reg("imovel", "a", T3)]), ficheiro([], [{ tipo: "imovel", id: "a", em: T2 }]));
    expect(ids(r.ficheiro)).toEqual(["imovel/a"]);
    expect(r.ficheiro.apagados).toEqual([]);
    expect(r.mudouRemoto).toBe(true);
  });

  it("no empate o registo não se perde", () => {
    const r = fundir(ficheiro([reg("imovel", "a", T2)]), ficheiro([], [{ tipo: "imovel", id: "a", em: T2 }]));
    expect(ids(r.ficheiro)).toEqual(["imovel/a"]);
  });

  it("as chaves embrulhadas mais recentes (nova palavra-passe) é que ficam", () => {
    const antigo = ficheiro([], [], cofre("2026-01-01T00:00:00.000Z"));
    const novo = ficheiro([], [], cofre("2026-01-01T00:00:00.000Z", T2));
    const a = fundir(antigo, novo);
    expect(a.ficheiro.cofre.atualizadoEm).toBe(T2);
    expect(a.mudouLocal).toBe(true);
    const b = fundir(novo, antigo);
    expect(b.ficheiro.cofre.atualizadoEm).toBe(T2);
    expect(b.mudouRemoto).toBe(true);
  });

  it("distingue cofres diferentes", () => {
    expect(mesmoCofre(ficheiro([]), ficheiro([]))).toBe(true);
    expect(mesmoCofre(ficheiro([]), ficheiro([], [], cofre("2026-02-02T00:00:00.000Z")))).toBe(false);
  });
});
