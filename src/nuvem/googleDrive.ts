// Ligação ao Google Drive: início de sessão (Google Identity Services) e pedidos à API do Drive.
//
// A app só pede o acesso "drive.file": vê apenas os ficheiros que ela própria criou, nunca o resto do Drive.
// A palavra-passe da Google nunca passa pela app (a janela de entrada é da Google). O código de acesso
// vive só em memória e dura cerca de uma hora.

/** ID de cliente OAuth da app (público por natureza: identifica a app, não dá acesso a nada). */
export const GOOGLE_CLIENT_ID = "847804921650-ob46ivh33s677hok9ig42nager22jf1l.apps.googleusercontent.com";

export const ESCOPO = "https://www.googleapis.com/auth/drive.file";
export const NOME_PASTA = "Investimentos";
export const NOME_FICHEIRO = "investimentos-dados.cofre";

const SCRIPT_GOOGLE = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/drive/v3";
const API_ENVIO = "https://www.googleapis.com/upload/drive/v3";
const TIPO_PASTA = "application/vnd.google-apps.folder";

/** Erro com motivo, para a app saber se deve pedir de novo o início de sessão. */
export class ErroDrive extends Error {
  constructor(
    mensagem: string,
    readonly motivo: "sessao" | "cancelado" | "rede" | "outro" = "outro",
  ) {
    super(mensagem);
  }
}

// ---------------------------------------------------------------- Início de sessão

interface RespostaToken {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface ClienteToken {
  requestAccessToken(opcoes?: { prompt?: string; login_hint?: string }): void;
}

interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(c: {
        client_id: string;
        scope: string;
        callback: (r: RespostaToken) => void;
        error_callback?: (e: { type?: string; message?: string }) => void;
      }): ClienteToken;
      revoke(token: string, feito?: () => void): void;
    };
  };
}

const gis = (): Gis | undefined => (window as unknown as { google?: Gis }).google;

let aCarregar: Promise<void> | null = null;

function carregarGis(): Promise<void> {
  if (gis()) return Promise.resolve();
  aCarregar ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_GOOGLE;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      aCarregar = null;
      s.remove();
      reject(new ErroDrive("Não foi possível falar com a Google. Verifique a ligação à internet.", "rede"));
    };
    document.head.appendChild(s);
  });
  return aCarregar;
}

let tokenAtual: { token: string; expiraEm: number } | null = null;

export function sessaoAtiva(): boolean {
  return !!tokenAtual && tokenAtual.expiraEm > Date.now() + 60_000;
}

/** Esquece o código de acesso em memória (por exemplo ao mudar de conta). */
export function esquecerSessao(): void {
  tokenAtual = null;
  tokenRecenteEm = 0;
}

/** Retira à app a autorização na conta Google (ao desligar o Drive). Não apaga nada no Drive. */
export async function retirarAutorizacao(): Promise<void> {
  const t = tokenAtual?.token;
  tokenAtual = null;
  if (!t) return;
  try {
    await carregarGis();
    gis()?.accounts.oauth2.revoke(t);
  } catch {
    // Sem rede não dá para revogar; a pessoa pode fazê-lo em myaccount.google.com.
  }
}

/** O que a pessoa estava a fazer ao sair para a Google, para a app continuar quando voltar. */
export type Intencao = "ligar" | "trazer" | "sincronizar";

export interface OpcoesSessao {
  /** Só conta se for preciso sair da página para entrar na Google (ver `usaRedirecionamento`). */
  intencao?: Intencao;
  /** Pode abrir a janela da Google (só com um clique da pessoa). Sem isto, só tenta em silêncio. */
  interativo: boolean;
  /** Obriga a escolher a conta (ligar pela primeira vez ou mudar de conta). */
  escolherConta?: boolean;
  /** Conta esperada (para a tentativa silenciosa). */
  conta?: string;
}

const ESPERA_SILENCIOSA_MS = 12_000;

// ---------------------------------------------------------------- Entrada sem janela (iPhone com a app instalada)

const CHAVE_ENTRADA = "investimentos-entrada-google";
const VALIDADE_ENTRADA_MS = 15 * 60_000;

/**
 * No iPhone/iPad com a app instalada no ecrã principal, a janela de entrada da Google abre numa folha à parte que
 * não consegue devolver o resultado à app. Aí a entrada faz-se na própria página: vai à Google e volta com o código.
 */
export function usaRedirecionamento(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
  return ios && instalada;
}

/** Endereço para onde a Google devolve a pessoa. Tem de estar igual na lista «URIs de redirecionamento» da consola Google. */
export const enderecoDeRetorno = (): string => new URL(import.meta.env.BASE_URL, window.location.origin).href;

/** O que fazer antes de sair para a página da Google (a app guarda a chave por pouco tempo). */
let antesDeSair: (() => Promise<void>) | null = null;

/** Regista o que fazer antes de sair para a página da Google (ou null para deixar de o fazer). */
export function aoSairParaAGoogle(f: (() => Promise<void>) | null): void {
  antesDeSair = f;
}

function sairParaAGoogle(o: OpcoesSessao): Promise<never> {
  const estado = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    window.localStorage.setItem(CHAVE_ENTRADA, JSON.stringify({ intencao: o.intencao ?? "sincronizar", estado, em: Date.now() }));
  } catch {
    // Sem armazenamento a app não sabe continuar sozinha, mas o início de sessão ainda se faz.
  }
  const parametros = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: enderecoDeRetorno(),
    response_type: "token",
    scope: ESCOPO,
    state: estado,
    include_granted_scopes: "true",
  });
  if (o.escolherConta) parametros.set("prompt", "select_account");
  else if (o.conta) parametros.set("login_hint", o.conta);
  const destino = `https://accounts.google.com/o/oauth2/v2/auth?${parametros}`;
  const sair = () => window.location.assign(destino);
  if (!antesDeSair) sair();
  else
    antesDeSair()
      .catch(() => undefined)
      .then(sair);
  return new Promise<never>(() => undefined); // a página vai ser trocada
}

export interface RetornoGoogle {
  intencao: Intencao;
  /** A Google recusou ou algo correu mal. */
  erro?: string;
}

/** Quando a pessoa voltou da Google com um código novo: nos minutos seguintes, mudar de conta não obriga a sair outra vez. */
let tokenRecenteEm = 0;
const tokenRecente = () => Date.now() - tokenRecenteEm < VALIDADE_ENTRADA_MS;

/**
 * Chamar uma vez ao arrancar a app: se a pessoa acabou de voltar da Google, guarda o código de acesso, limpa o
 * endereço e diz o que ela estava a fazer.
 */
export function processarRetornoGoogle(): RetornoGoogle | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (!hash.has("access_token") && !hash.has("error")) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  let pendente: { intencao: Intencao; estado: string; em: number } | null = null;
  try {
    pendente = JSON.parse(window.localStorage.getItem(CHAVE_ENTRADA) ?? "null");
    window.localStorage.removeItem(CHAVE_ENTRADA);
  } catch {
    pendente = null;
  }
  if (!pendente || pendente.estado !== hash.get("state") || Date.now() - pendente.em > VALIDADE_ENTRADA_MS) return null;

  const token = hash.get("access_token");
  if (token) {
    tokenAtual = { token, expiraEm: Date.now() + Number(hash.get("expires_in") ?? 3600) * 1000 };
    tokenRecenteEm = Date.now();
    return { intencao: pendente.intencao };
  }
  const erro = hash.get("error");
  return { intencao: pendente.intencao, erro: erro === "access_denied" ? "A autorização foi recusada na Google." : "Não foi possível entrar na Google. Tente de novo." };
}

/** Prepara o início de sessão: carrega já o script da Google, para a janela abrir no instante do toque (o Safari só aceita assim). */
export function preCarregarGoogle(): Promise<void> {
  return usaRedirecionamento() ? Promise.resolve() : carregarGis();
}

let emCurso: { interativo: boolean; promessa: Promise<string> } | null = null;

/**
 * Devolve um código de acesso válido, usando o que já está em memória se ainda servir.
 *
 * Para abrir a janela da Google, o pedido tem de sair no mesmo instante do toque da pessoa (os navegadores
 * bloqueiam janelas abertas depois de esperas). Por isso, ao tocar num botão, chame primeiro `iniciarEntrada`:
 * o pedido que vier a seguir junta-se a esse, em vez de começar outro.
 */
export function obterToken(o: OpcoesSessao): Promise<string> {
  // Ao mudar de conta pede-se sempre de novo, a não ser que a pessoa tenha acabado de voltar da Google.
  if (sessaoAtiva() && (!o.escolherConta || tokenRecente())) return Promise.resolve(tokenAtual!.token);
  if (o.interativo && usaRedirecionamento()) return sairParaAGoogle(o);
  if (!o.interativo && usaRedirecionamento()) return Promise.reject(new ErroDrive("A sessão Google caducou. Entre de novo na Google.", "sessao"));
  // Um pedido já a caminho serve, a não ser que seja silencioso e este precise de abrir a janela.
  if (emCurso && (emCurso.interativo || !o.interativo)) return emCurso.promessa;
  const promessa = (gis() ? pedirToken(o) : carregarGis().then(() => pedirToken(o))).finally(() => {
    if (emCurso?.promessa === promessa) emCurso = null;
  });
  emCurso = { interativo: o.interativo, promessa };
  return promessa;
}

/** Chamar logo no início do toque num botão que precise de entrar na Google. Os erros ficam para quem usar o resultado. */
export function iniciarEntrada(intencao: Intencao = "sincronizar", escolherConta = false): void {
  obterToken({ interativo: true, escolherConta, intencao }).catch(() => undefined);
}

function pedirToken(o: OpcoesSessao): Promise<string> {
  const g = gis();
  if (!g) return Promise.reject(new ErroDrive("Não foi possível falar com a Google.", "rede"));
  return new Promise<string>((resolve, reject) => {
    let terminado = false;
    const acabar = (f: () => void) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(relogio);
      f();
    };
    const relogio = setTimeout(
      () => acabar(() => reject(new ErroDrive("A sessão Google caducou. Ligue de novo ao Google Drive.", "sessao"))),
      o.interativo ? 5 * 60_000 : ESPERA_SILENCIOSA_MS,
    );
    const cliente = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: ESCOPO,
      callback: (r) =>
        acabar(() => {
          if (r.access_token) {
            tokenAtual = { token: r.access_token, expiraEm: Date.now() + (r.expires_in ?? 3600) * 1000 };
            resolve(r.access_token);
          } else if (r.error === "access_denied") {
            reject(new ErroDrive("A autorização foi recusada na janela da Google.", "cancelado"));
          } else {
            reject(new ErroDrive("A sessão Google caducou. Ligue de novo ao Google Drive.", "sessao"));
          }
        }),
      error_callback: (e) => {
        // Navegador sem janela possível (bloqueada ou não suportada): entra-se na própria página.
        if (e.type === "popup_failed_to_open" && o.interativo) {
          void sairParaAGoogle(o);
          return;
        }
        acabar(() =>
          reject(
            e.type === "popup_closed"
              ? new ErroDrive("A janela da Google foi fechada antes de terminar.", "cancelado")
              : new ErroDrive(
                  e.type === "popup_failed_to_open"
                    ? "O navegador bloqueou a janela da Google. Toque de novo no botão; se continuar, permita janelas nesta página."
                    : "A sessão Google caducou. Ligue de novo ao Google Drive.",
                  "sessao",
                ),
          ),
        );
      },
    });
    cliente.requestAccessToken({
      prompt: o.escolherConta ? "select_account" : o.interativo ? "" : "none",
      ...(o.conta && !o.escolherConta ? { login_hint: o.conta } : {}),
    });
  });
}

// ---------------------------------------------------------------- API do Drive

export interface FicheiroDrive {
  id: string;
  name: string;
  modifiedTime?: string;
  /** Só quando o ficheiro acabou de ser criado: a pasta onde ficou. */
  pastaId?: string;
}

/** Endereço da pasta no Google Drive, para abrir a partir da app. */
export const enderecoPasta = (pastaId: string): string => `https://drive.google.com/drive/folders/${pastaId}`;

type Pedir = typeof fetch;

/** Pedidos ao Drive. `token` devolve o código de acesso e `pedir` é o `fetch` (trocável nos testes). */
export class ClienteDrive {
  constructor(
    private readonly token: () => Promise<string>,
    private readonly pedir: Pedir = (...a) => fetch(...a),
  ) {}

  private async executar(url: string, init: RequestInit = {}): Promise<Response> {
    let r: Response;
    try {
      r = await this.pedir(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await this.token()}` } });
    } catch (e) {
      if (e instanceof ErroDrive) throw e;
      throw new ErroDrive("Não foi possível falar com o Google Drive. Verifique a ligação à internet.", "rede");
    }
    if (r.status === 401) {
      esquecerSessao();
      throw new ErroDrive("A sessão Google caducou. Ligue de novo ao Google Drive.", "sessao");
    }
    if (r.status === 403 || r.status === 429) {
      throw new ErroDrive("O Google Drive recusou o pedido (limite de utilização ou falta de permissão). Tente daqui a pouco.");
    }
    return r;
  }

  private async json<T>(r: Response): Promise<T> {
    if (!r.ok) throw new ErroDrive(`O Google Drive respondeu com um erro (${r.status}).`);
    return (await r.json()) as T;
  }

  /** O nome da conta (e-mail) com que a sessão está feita. */
  async conta(): Promise<string | undefined> {
    const r = await this.json<{ user?: { emailAddress?: string; displayName?: string } }>(await this.executar(`${API}/about?fields=user(emailAddress,displayName)`));
    return r.user?.emailAddress ?? r.user?.displayName;
  }

  private async procurar(q: string): Promise<FicheiroDrive[]> {
    const url = `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name,modifiedTime)")}&orderBy=createdTime&pageSize=10&spaces=drive`;
    return (await this.json<{ files?: FicheiroDrive[] }>(await this.executar(url))).files ?? [];
  }

  /** O ficheiro de dados criado pela app (o mais antigo, se por azar houver mais do que um). */
  async procurarFicheiro(): Promise<FicheiroDrive | undefined> {
    return (await this.procurar(`name = '${NOME_FICHEIRO}' and trashed = false`))[0];
  }

  /** A pasta onde está um ficheiro. */
  async pastaDe(id: string): Promise<string | undefined> {
    const r = await this.json<{ parents?: string[] }>(await this.executar(`${API}/files/${id}?fields=parents`));
    return r.parents?.[0];
  }

  async existe(id: string): Promise<boolean> {
    const r = await this.executar(`${API}/files/${id}?fields=id,trashed`);
    if (r.status === 404) return false;
    return !(await this.json<{ trashed?: boolean }>(r)).trashed;
  }

  private async pastaDaApp(): Promise<string> {
    const existente = (await this.procurar(`name = '${NOME_PASTA}' and mimeType = '${TIPO_PASTA}' and trashed = false`))[0];
    if (existente) return existente.id;
    const r = await this.json<{ id: string }>(
      await this.executar(`${API}/files?fields=id`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ name: NOME_PASTA, mimeType: TIPO_PASTA }),
      }),
    );
    return r.id;
  }

  /** Cria o ficheiro de dados (e a pasta "Investimentos", se ainda não existir). */
  async criarFicheiro(conteudo: string): Promise<FicheiroDrive> {
    const pasta = await this.pastaDaApp();
    const limite = `investimentos-${Math.random().toString(36).slice(2)}`;
    const corpo =
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: NOME_FICHEIRO, parents: [pasta], mimeType: "application/json" }) +
      `\r\n--${limite}\r\nContent-Type: application/json\r\n\r\n${conteudo}\r\n--${limite}--`;
    const criado = await this.json<FicheiroDrive>(
      await this.executar(`${API_ENVIO}/files?uploadType=multipart&fields=${encodeURIComponent("id,name,modifiedTime")}`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${limite}` },
        body: corpo,
      }),
    );
    return { ...criado, pastaId: pasta };
  }

  async atualizarFicheiro(id: string, conteudo: string): Promise<FicheiroDrive> {
    return this.json<FicheiroDrive>(
      await this.executar(`${API_ENVIO}/files/${id}?uploadType=media&fields=${encodeURIComponent("id,name,modifiedTime")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: conteudo,
      }),
    );
  }

  async descarregar(id: string): Promise<string> {
    const r = await this.executar(`${API}/files/${id}?alt=media`);
    if (!r.ok) throw new ErroDrive(`Não foi possível ler o ficheiro no Google Drive (${r.status}).`);
    return r.text();
  }
}
