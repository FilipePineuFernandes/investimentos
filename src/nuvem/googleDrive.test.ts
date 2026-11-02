import { afterEach, describe, expect, it } from "vitest";
import { esquecerSessao, iniciarEntrada, obterToken, processarRetornoGoogle, sessaoAtiva, usaRedirecionamento } from "./googleDrive";

type Pedido = { prompt?: string; login_hint?: string };

/** Uma Google de brincar: guarda os pedidos e deixa o teste responder quando quiser. */
function googleFalsa() {
  const pedidos: Pedido[] = [];
  const respostas: ((r: { access_token?: string; expires_in?: number; error?: string }) => void)[] = [];
  const erros: ((e: { type?: string }) => void)[] = [];
  const navegou: string[] = [];
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: "https://exemplo.github.io", pathname: "/", search: "", hash: "", assign: (u: string) => navegou.push(u) },
    localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (c: { callback: (typeof respostas)[number]; error_callback: (typeof erros)[number] }) => ({
            requestAccessToken: (o: Pedido) => {
              pedidos.push(o);
              respostas.push(c.callback);
              erros.push(c.error_callback);
            },
          }),
          revoke: () => undefined,
        },
      },
    },
  };
  return { pedidos, navegou, responder: (i = 0) => respostas[i]({ access_token: "tok", expires_in: 3600 }), falhar: (tipo: string, i = 0) => erros[i]({ type: tipo }) };
}

const navegadorOriginal = Object.getOwnPropertyDescriptor(globalThis, "navigator");

afterEach(() => {
  esquecerSessao();
  delete (globalThis as { window?: unknown }).window;
  if (navegadorOriginal) Object.defineProperty(globalThis, "navigator", navegadorOriginal);
  else delete (globalThis as { navigator?: unknown }).navigator;
});

describe("início de sessão na Google", () => {
  it("pede a janela no próprio instante do toque, sem esperas", async () => {
    const g = googleFalsa();
    iniciarEntrada("ligar", true);
    expect(g.pedidos).toEqual([{ prompt: "select_account" }]);
    g.responder();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("o pedido seguinte junta-se ao que já está a caminho", async () => {
    const g = googleFalsa();
    iniciarEntrada();
    const t = obterToken({ interativo: true });
    expect(g.pedidos).toHaveLength(1);
    g.responder();
    expect(await t).toBe("tok");
    expect(sessaoAtiva()).toBe(true);
    // Com a sessão ativa não volta a abrir nada.
    expect(await obterToken({ interativo: true })).toBe("tok");
    expect(g.pedidos).toHaveLength(1);
  });

  it("a tentativa silenciosa não impede de abrir a janela quando a pessoa toca no botão", async () => {
    const g = googleFalsa();
    const silencioso = obterToken({ interativo: false, conta: "eu@exemplo.pt" });
    silencioso.catch(() => undefined);
    const interativo = obterToken({ interativo: true });
    expect(g.pedidos).toEqual([{ prompt: "none", login_hint: "eu@exemplo.pt" }, { prompt: "" }]);
    g.responder(1);
    expect(await interativo).toBe("tok");
    g.responder(0);
    await silencioso;
  });

  it("explica quando a pessoa fecha a janela", async () => {
    const g = googleFalsa();
    const b = obterToken({ interativo: true });
    g.falhar("popup_closed");
    await expect(b).rejects.toMatchObject({ motivo: "cancelado" });
  });

  it("se o navegador não deixa abrir a janela, entra-se na própria página", () => {
    const g = googleFalsa();
    obterToken({ interativo: true, intencao: "ligar" }).catch(() => undefined);
    g.falhar("popup_failed_to_open");
    expect(g.navegou).toHaveLength(1);
    expect(g.navegou[0]).toContain("response_type=token");
  });
});

/** Um iPhone com a app instalada no ecrã principal, com o endereço, o armazenamento e a navegação de brincar. */
function iphoneInstalado(hash = "") {
  const navegou: string[] = [];
  const guardado = new Map<string, string>();
  const substituiu: string[] = [];
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: "https://exemplo.github.io", pathname: "/investimentos/", search: "", hash, assign: (u: string) => navegou.push(u) },
    history: { replaceState: (_a: unknown, _b: unknown, url: string) => substituiu.push(url) },
    localStorage: { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v), removeItem: (k: string) => guardado.delete(k) },
    matchMedia: () => ({ matches: true }),
  };
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5, standalone: true }, configurable: true });
  return { navegou, guardado, substituiu };
}

describe("entrada na Google sem janela (iPhone com a app instalada)", () => {
  it("só se usa no iPhone com a app instalada", () => {
    iphoneInstalado();
    expect(usaRedirecionamento()).toBe(true);
    (navigator as unknown as { standalone: boolean }).standalone = false;
    (window as unknown as { matchMedia: () => { matches: boolean } }).matchMedia = () => ({ matches: false });
    expect(usaRedirecionamento()).toBe(false);
  });

  it("sai para a Google no próprio toque e volta com o código", async () => {
    const i = iphoneInstalado();
    iniciarEntrada("ligar", true);
    expect(i.navegou).toHaveLength(1);
    const url = new URL(i.navegou[0]);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("redirect_uri")).toBe("https://exemplo.github.io/");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    const estado = url.searchParams.get("state")!;
    expect(JSON.parse(i.guardado.get("investimentos-entrada-google")!)).toMatchObject({ intencao: "ligar", estado });

    // A página volta com o código no endereço.
    const w = window as unknown as { location: { hash: string } };
    w.location.hash = `#access_token=abc&token_type=Bearer&expires_in=3599&state=${estado}`;
    expect(processarRetornoGoogle()).toEqual({ intencao: "ligar" });
    expect(i.substituiu).toEqual(["/investimentos/"]);
    expect(i.guardado.size).toBe(0);
    expect(sessaoAtiva()).toBe(true);
    // O pedido de «mudar de conta» a seguir usa este código em vez de sair outra vez.
    expect(await obterToken({ interativo: true, escolherConta: true, intencao: "ligar" })).toBe("abc");
    expect(i.navegou).toHaveLength(1);
  });

  it("ignora um retorno que não foi pedido por esta app e explica a recusa", () => {
    const i = iphoneInstalado("#access_token=falso&state=outro");
    expect(processarRetornoGoogle()).toBeNull();
    expect(sessaoAtiva()).toBe(false);
    expect(i.substituiu).toEqual(["/investimentos/"]);

    const j = iphoneInstalado();
    iniciarEntrada("trazer", true);
    const estado = new URL(j.navegou[0]).searchParams.get("state")!;
    (window as unknown as { location: { hash: string } }).location.hash = `#error=access_denied&state=${estado}`;
    expect(processarRetornoGoogle()).toMatchObject({ intencao: "trazer", erro: expect.stringContaining("recusada") });
  });

  it("sem ser num toque, não sai da página: diz que a sessão caducou", async () => {
    const i = iphoneInstalado();
    await expect(obterToken({ interativo: false })).rejects.toMatchObject({ motivo: "sessao" });
    expect(i.navegou).toHaveLength(0);
  });
});
