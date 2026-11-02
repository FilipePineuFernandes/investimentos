// Sincronização dos dados com o Google Drive.
//
// O Drive guarda um único ficheiro: o mesmo formato da cópia de segurança, já cifrado (o Google só
// vê um ficheiro ilegível). Cada sincronização descarrega esse ficheiro, junta-o com os dados deste
// aparelho (ver fusao.ts) e, se houver novidades de um lado ou do outro, atualiza o que faltar.
// Trabalha sobre os dados já cifrados: não precisa da chave nem da palavra-passe.

import { bd, type BaseDados, type LocalDrive } from "../dados/bd";
import { cofreDeFicheiro, lerFicheiroLocal, lerTextoCopia, registoDeFicheiro, substituirPeloFicheiro, type FicheiroCopia } from "../dados/copias";
import { ClienteDrive, ErroDrive, esquecerSessao, obterToken, retirarAutorizacao } from "./googleDrive";
import { fundir, mesmoCofre } from "./fusao";

export interface OpcoesSincronizacao {
  /** Vem de um clique: pode abrir a janela de entrada da Google. */
  interativo: boolean;
  /** Ligar (ou mudar de) conta: obriga a escolher a conta e procura o ficheiro de novo. */
  escolherConta?: boolean;
  /** Só para resolver o conflito entre dois cofres diferentes: manda os deste aparelho ou traz os do Drive. */
  forcar?: "enviar" | "receber";
  /** Troca o cliente do Drive (testes). */
  cliente?: ClienteDrive;
}

export type ResultadoSincronizacao =
  | { ok: true; acao: "enviou" | "recebeu" | "fundiu" | "igual" | "substituiu"; bytes: number; conta?: string }
  | { ok: false; erro: string; precisaLogin?: boolean; cofreDiferente?: boolean };

export async function lerMarcador(base: BaseDados = bd): Promise<LocalDrive | undefined> {
  const l = await base.locais.get("drive");
  return l?.id === "drive" ? l : undefined;
}

async function gravarMarcador(base: BaseDados, m: Omit<LocalDrive, "id">): Promise<void> {
  await base.locais.put({ id: "drive", ...m });
}

const tamanho = (texto: string) => new Blob([texto]).size;

/** Aplica neste aparelho o que veio do Drive, sem pisar alterações feitas entretanto (só entra o que for mais recente). */
async function aplicarNoAparelho(base: BaseDados, fusao: FicheiroCopia, remoto: FicheiroCopia): Promise<void> {
  await base.transaction("rw", base.cofre, base.registos, base.apagados, async () => {
    const atual = await base.cofre.get("principal");
    if (atual && fusao.cofre === remoto.cofre) {
      await base.cofre.put({ ...cofreDeFicheiro(fusao), ...(atual.biometria ? { biometria: atual.biometria } : {}) });
    }
    for (const r of fusao.registos) {
      const a = await base.registos.get([r.tipo, r.id]);
      if (!a || a.atualizadoEm < r.atualizadoEm) await base.registos.put(registoDeFicheiro(r));
      if (await base.apagados.get([r.tipo, r.id])) await base.apagados.delete([r.tipo, r.id]);
    }
    for (const x of fusao.apagados ?? []) {
      const a = await base.registos.get([x.tipo, x.id]);
      if (a && a.atualizadoEm <= x.em) await base.registos.delete([x.tipo, x.id]);
      const t = await base.apagados.get([x.tipo, x.id]);
      if (!t || t.em < x.em) await base.apagados.put(x);
    }
  });
}

async function sincronizarSemFila(o: OpcoesSincronizacao, base: BaseDados): Promise<ResultadoSincronizacao> {
  const marcador = await lerMarcador(base);
  const cliente = o.cliente ?? new ClienteDrive(() => obterToken({ interativo: o.interativo, escolherConta: o.escolherConta, conta: marcador?.conta }));

  let ficheiroId = o.escolherConta ? undefined : marcador?.ficheiroId;
  if (ficheiroId && !(await cliente.existe(ficheiroId))) ficheiroId = undefined;
  ficheiroId ??= (await cliente.procurarFicheiro())?.id;
  const conta = !o.escolherConta && marcador?.conta ? marcador.conta : await cliente.conta();

  const local = await lerFicheiroLocal(base, { paraSincronizar: true });
  const agora = () => new Date().toISOString();

  const enviar = async (f: FicheiroCopia) => {
    const texto = JSON.stringify(f);
    const r = ficheiroId ? await cliente.atualizarFicheiro(ficheiroId, texto) : await cliente.criarFicheiro(texto);
    await gravarMarcador(base, { ficheiroId: r.id, conta, ultimaSincronizacao: agora() });
    return tamanho(texto);
  };

  if (!ficheiroId) return { ok: true, acao: "enviou", bytes: await enviar(local), conta };

  const remoto = lerTextoCopia(await cliente.descarregar(ficheiroId));
  const bytes = tamanho(JSON.stringify(remoto));

  if (o.forcar === "enviar") return { ok: true, acao: "enviou", bytes: await enviar(local), conta };
  if (o.forcar === "receber") {
    await substituirPeloFicheiro(remoto, base);
    await gravarMarcador(base, { ficheiroId, conta, ultimaSincronizacao: agora() });
    return { ok: true, acao: "substituiu", bytes, conta };
  }

  if (!mesmoCofre(local, remoto)) {
    return { ok: false, cofreDiferente: true, erro: "Os dados que estão no Google Drive pertencem a outro cofre, diferente do deste aparelho." };
  }

  const fusao = fundir(local, remoto);
  if (fusao.mudouLocal) await aplicarNoAparelho(base, fusao.ficheiro, remoto);
  let enviados = bytes;
  if (fusao.mudouRemoto) enviados = await enviar(fusao.ficheiro);
  else await gravarMarcador(base, { ficheiroId, conta, ultimaSincronizacao: agora() });

  const acao = fusao.mudouLocal && fusao.mudouRemoto ? "fundiu" : fusao.mudouLocal ? "recebeu" : fusao.mudouRemoto ? "enviou" : "igual";
  return { ok: true, acao, bytes: enviados, conta };
}

/** Uma sincronização de cada vez: as que chegam entretanto esperam pela anterior. */
let fila: Promise<unknown> = Promise.resolve();

export function sincronizar(opcoes: OpcoesSincronizacao, base: BaseDados = bd): Promise<ResultadoSincronizacao> {
  const tarefa = fila.then(async (): Promise<ResultadoSincronizacao> => {
    try {
      return await sincronizarSemFila(opcoes, base);
    } catch (e) {
      if (e instanceof ErroDrive) return { ok: false, erro: e.message, precisaLogin: e.motivo === "sessao" };
      return { ok: false, erro: e instanceof Error ? e.message : String(e) };
    }
  });
  fila = tarefa;
  return tarefa;
}

/**
 * Aparelho novo: entra na conta Google, traz os dados que lá estão e substitui o que houver neste
 * aparelho. Depois basta a palavra-passe para abrir.
 */
export async function trazerDoDrive(base: BaseDados = bd, cliente?: ClienteDrive): Promise<{ ok: true; criadoEm: string; conta?: string } | { ok: false; erro: string }> {
  try {
    const c = cliente ?? new ClienteDrive(() => obterToken({ interativo: true, escolherConta: true }));
    const ficheiro = await c.procurarFicheiro();
    if (!ficheiro) return { ok: false, erro: "Não encontrei dados desta app nesta conta Google. Confirme que escolheu a conta onde os guardou." };
    const remoto = lerTextoCopia(await c.descarregar(ficheiro.id));
    const conta = await c.conta();
    await substituirPeloFicheiro(remoto, base);
    await gravarMarcador(base, { ficheiroId: ficheiro.id, conta, ultimaSincronizacao: new Date().toISOString() });
    return { ok: true, criadoEm: remoto.criadoEm, conta };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Deixa de usar o Drive neste aparelho. Os dados no Drive ficam onde estão; só se retira a autorização à app. */
export async function desligarDrive(base: BaseDados = bd): Promise<void> {
  await base.locais.delete("drive");
  await retirarAutorizacao();
  esquecerSessao();
}
