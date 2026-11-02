import { afterEach, describe, expect, it } from "vitest";
import { esquecerSessao, iniciarEntrada, obterToken, sessaoAtiva } from "./googleDrive";

type Pedido = { prompt?: string; login_hint?: string };

/** Uma Google de brincar: guarda os pedidos e deixa o teste responder quando quiser. */
function googleFalsa() {
  const pedidos: Pedido[] = [];
  const respostas: ((r: { access_token?: string; expires_in?: number; error?: string }) => void)[] = [];
  const erros: ((e: { type?: string }) => void)[] = [];
  (globalThis as unknown as { window: unknown }).window = {
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
  return { pedidos, responder: (i = 0) => respostas[i]({ access_token: "tok", expires_in: 3600 }), falhar: (tipo: string, i = 0) => erros[i]({ type: tipo }) };
}

afterEach(() => {
  esquecerSessao();
  delete (globalThis as { window?: unknown }).window;
});

describe("início de sessão na Google", () => {
  it("pede a janela no próprio instante do toque, sem esperas", async () => {
    const g = googleFalsa();
    iniciarEntrada(true);
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

  it("explica quando o navegador bloqueia a janela ou a pessoa a fecha", async () => {
    const g = googleFalsa();
    const a = obterToken({ interativo: true });
    g.falhar("popup_failed_to_open");
    await expect(a).rejects.toMatchObject({ motivo: "sessao", message: expect.stringContaining("bloqueou") });
    const b = obterToken({ interativo: true });
    g.falhar("popup_closed", 1);
    await expect(b).rejects.toMatchObject({ motivo: "cancelado" });
  });
});
