import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { BaseDados } from "../dados/bd";
import { abrirComPalavraPasse, criarCofre } from "../dados/cofre";
import { apagar, guardar, ler, listar } from "../dados/repositorio";
import { ClienteDrive, ErroDrive, NOME_FICHEIRO, NOME_PASTA } from "./googleDrive";
import { desligarDrive, lerMarcador, sincronizar, trazerDoDrive } from "./sincronizar";

let n = 0;
const novaBase = () => new BaseDados(`nuvem-${n++}`);
const PP = "uma frase bem comprida";
const espera = () => new Promise((r) => setTimeout(r, 5));

/** Um Google Drive de brincar, na memória, com os pedidos que a app faz. */
function drivefalso() {
  const ficheiros = new Map<string, { id: string; name: string; mimeType: string; content: string; created: number; trashed?: boolean; parents?: string[] }>();
  let seq = 0;
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
  const pedidos: string[] = [];
  const pedir = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(entrada));
    const metodo = init.method ?? "GET";
    pedidos.push(`${metodo} ${url.pathname}`);
    if (url.pathname === "/drive/v3/about") return resposta({ user: { emailAddress: "eu@exemplo.pt" } });
    if (url.pathname === "/drive/v3/files" && metodo === "GET") {
      const q = url.searchParams.get("q") ?? "";
      const nome = /name = '([^']+)'/.exec(q)?.[1];
      const tipo = /mimeType = '([^']+)'/.exec(q)?.[1];
      const lista = [...ficheiros.values()].filter((f) => !f.trashed && f.name === nome && (!tipo || f.mimeType === tipo)).sort((a, b) => a.created - b.created);
      return resposta({ files: lista.map((f) => ({ id: f.id, name: f.name })) });
    }
    if (url.pathname === "/drive/v3/files" && metodo === "POST") {
      const meta = JSON.parse(String(init.body));
      const id = `id${++seq}`;
      ficheiros.set(id, { id, name: meta.name, mimeType: meta.mimeType, content: "", created: seq });
      return resposta({ id });
    }
    if (url.pathname === "/upload/drive/v3/files" && metodo === "POST") {
      const corpo = String(init.body);
      const partes = corpo.split(/\r\n--investimentos-[a-z0-9]+(?:--)?/);
      const meta = JSON.parse(partes[0].split("\r\n\r\n")[1]);
      const conteudo = partes[1].split("\r\n\r\n").slice(1).join("\r\n\r\n");
      const id = `id${++seq}`;
      ficheiros.set(id, { id, name: meta.name, mimeType: meta.mimeType, content: conteudo, created: seq, parents: meta.parents });
      return resposta({ id, name: meta.name });
    }
    const m = /^\/(?:upload\/)?drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (m) {
      const f = ficheiros.get(m[1]);
      if (!f) return resposta({}, 404);
      if (metodo === "PATCH") {
        f.content = String(init.body);
        return resposta({ id: f.id, name: f.name });
      }
      if (url.searchParams.get("alt") === "media") return new Response(f.content, { status: 200 });
      return resposta({ id: f.id, trashed: !!f.trashed, parents: f.parents });
    }
    return resposta({}, 404);
  }) as typeof fetch;
  return { cliente: () => new ClienteDrive(async () => "token", pedir), ficheiros, pedidos };
}

describe("sincronização com o Google Drive", () => {
  it("envia, traz para um aparelho novo e mantém os dois em dia (incluindo apagar)", async () => {
    const drive = drivefalso();
    const a = novaBase();
    const { chave } = await criarCofre(PP, a);
    await guardar(chave, "perfil", "principal", { nascimento: "1980-05-05" }, a);
    await guardar(chave, "imovel", "casa", { preco: 100 }, a);
    await guardar(chave, "definicoes", "copias", { destino: "googleDrive" }, a);

    // Primeira vez: o Drive ainda está vazio, por isso vai tudo (menos o que é só deste aparelho).
    const r1 = await sincronizar({ interativo: true, escolherConta: true, cliente: drive.cliente() }, a);
    expect(r1).toMatchObject({ ok: true, acao: "enviou", conta: "eu@exemplo.pt" });
    expect([...drive.ficheiros.values()].map((f) => f.name).sort()).toEqual([NOME_FICHEIRO, NOME_PASTA].sort());
    const guardado = [...drive.ficheiros.values()].find((f) => f.name === NOME_FICHEIRO)!.content;
    expect(guardado).not.toContain("1980-05-05");
    expect(guardado).not.toContain('"copias"');
    expect((await lerMarcador(a))?.conta).toBe("eu@exemplo.pt");
    const pasta = [...drive.ficheiros.values()].find((f) => f.name === NOME_PASTA)!;
    expect((await lerMarcador(a))?.pastaId).toBe(pasta.id);

    // Aparelho novo: traz os dados e abre só com a palavra-passe, já com o perfil preenchido.
    const b = novaBase();
    expect(await trazerDoDrive(b, drive.cliente())).toMatchObject({ ok: true, conta: "eu@exemplo.pt" });
    const chaveB = (await abrirComPalavraPasse(PP, b))!;
    expect(chaveB).not.toBeNull();
    expect(await ler(chaveB, "perfil", "principal", b)).toEqual({ nascimento: "1980-05-05" });
    expect(await listar(chaveB, "imovel", b)).toEqual([{ preco: 100 }]);
    expect((await lerMarcador(b))?.pastaId).toBe(pasta.id);

    // Alterações nos dois lados juntam-se.
    await espera();
    await guardar(chaveB, "imovel", "quinta", { preco: 50 }, b);
    await guardar(chaveB, "perfil", "principal", { nascimento: "1980-05-05", regiao: "Continente" }, b);
    expect(await sincronizar({ interativo: false, cliente: drive.cliente() }, b)).toMatchObject({ ok: true, acao: "enviou" });
    await espera();
    await guardar(chave, "imovel", "loja", { preco: 70 }, a);
    expect(await sincronizar({ interativo: false, cliente: drive.cliente() }, a)).toMatchObject({ ok: true, acao: "fundiu" });
    expect((await listar<{ preco: number }>(chave, "imovel", a)).map((i) => i.preco).sort((x, y) => x - y)).toEqual([50, 70, 100]);
    expect(await ler(chave, "perfil", "principal", a)).toEqual({ nascimento: "1980-05-05", regiao: "Continente" });
    expect(await sincronizar({ interativo: false, cliente: drive.cliente() }, b)).toMatchObject({ ok: true, acao: "recebeu" });
    expect(await listar(chaveB, "imovel", b)).toHaveLength(3);

    // Apagar num aparelho apaga no outro.
    await espera();
    await apagar("imovel", "casa", a);
    await sincronizar({ interativo: false, cliente: drive.cliente() }, a);
    await sincronizar({ interativo: false, cliente: drive.cliente() }, b);
    expect((await listar<{ preco: number }>(chaveB, "imovel", b)).map((i) => i.preco).sort((x, y) => x - y)).toEqual([50, 70]);

    // Sem novidades, nada se envia.
    const antes = drive.pedidos.length;
    expect(await sincronizar({ interativo: false, cliente: drive.cliente() }, b)).toMatchObject({ ok: true, acao: "igual" });
    expect(drive.pedidos.slice(antes).some((p) => p.startsWith("PATCH") || p.startsWith("POST"))).toBe(false);
  }, 120_000);

  it("avisa quando o Drive tem outro cofre e deixa escolher o que fazer", async () => {
    const drive = drivefalso();
    const a = novaBase();
    const { chave } = await criarCofre(PP, a);
    await guardar(chave, "perfil", "principal", { v: "a" }, a);
    await sincronizar({ interativo: true, escolherConta: true, cliente: drive.cliente() }, a);

    const c = novaBase();
    const { chave: chaveC } = await criarCofre("outra frase bem comprida", c);
    await guardar(chaveC, "perfil", "principal", { v: "c" }, c);
    const r = await sincronizar({ interativo: true, escolherConta: true, cliente: drive.cliente() }, c);
    expect(r).toMatchObject({ ok: false, cofreDiferente: true });
    expect(await ler(chaveC, "perfil", "principal", c)).toEqual({ v: "c" });

    // Trazer os do Drive: os deste aparelho deixam de existir e abre com a palavra-passe do Drive.
    expect(await sincronizar({ interativo: true, escolherConta: true, forcar: "receber", cliente: drive.cliente() }, c)).toMatchObject({ ok: true, acao: "substituiu" });
    const nova = (await abrirComPalavraPasse(PP, c))!;
    expect(await ler(nova, "perfil", "principal", c)).toEqual({ v: "a" });
    expect((await lerMarcador(c))?.ficheiroId).toBeDefined();
  }, 120_000);

  it("enviar os deste aparelho substitui os do Drive", async () => {
    const drive = drivefalso();
    const a = novaBase();
    const { chave } = await criarCofre(PP, a);
    await guardar(chave, "perfil", "principal", { v: "a" }, a);
    await sincronizar({ interativo: true, escolherConta: true, cliente: drive.cliente() }, a);

    const c = novaBase();
    const { chave: chaveC } = await criarCofre("outra frase bem comprida", c);
    await guardar(chaveC, "perfil", "principal", { v: "c" }, c);
    expect(await sincronizar({ interativo: true, escolherConta: true, forcar: "enviar", cliente: drive.cliente() }, c)).toMatchObject({ ok: true, acao: "enviou" });
    const d = novaBase();
    await trazerDoDrive(d, drive.cliente());
    const chaveD = (await abrirComPalavraPasse("outra frase bem comprida", d))!;
    expect(await ler(chaveD, "perfil", "principal", d)).toEqual({ v: "c" });
  }, 120_000);

  it("diz que não há dados quando a conta não tem nada", async () => {
    const r = await trazerDoDrive(novaBase(), drivefalso().cliente());
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? "" : r.erro).toContain("Não encontrei");
  });

  it("pede de novo o início de sessão quando a Google recusa o código", async () => {
    const a = novaBase();
    await criarCofre(PP, a);
    const expirado = new ClienteDrive(async () => "token", (async () => new Response("{}", { status: 401 })) as typeof fetch);
    const r = await sincronizar({ interativo: false, cliente: expirado }, a);
    expect(r).toMatchObject({ ok: false, precisaLogin: true });
    const semRede = new ClienteDrive(
      async () => "token",
      (async () => {
        throw new TypeError("falhou");
      }) as typeof fetch,
    );
    expect(await sincronizar({ interativo: false, cliente: semRede }, a)).toMatchObject({ ok: false, precisaLogin: false });
    expect(new ErroDrive("x", "sessao").motivo).toBe("sessao");
  }, 60_000);

  it("desligar apaga a ligação mas não os dados", async () => {
    const drive = drivefalso();
    const a = novaBase();
    const { chave } = await criarCofre(PP, a);
    await guardar(chave, "perfil", "principal", { v: 1 }, a);
    await sincronizar({ interativo: true, escolherConta: true, cliente: drive.cliente() }, a);
    expect(await lerMarcador(a)).toBeDefined();
    await desligarDrive(a);
    expect(await lerMarcador(a)).toBeUndefined();
    expect(await ler(chave, "perfil", "principal", a)).toEqual({ v: 1 });
    expect(drive.ficheiros.size).toBe(2);
  }, 60_000);
});
