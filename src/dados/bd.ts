// Base de dados local (IndexedDB do navegador, através do Dexie).
//
// - cofre: as chaves embrulhadas e os parâmetros de derivação (nada legível sem a palavra-passe).
// - registos: todos os dados da app, cada um cifrado com a chave de dados.
// - locais: coisas que só existem neste aparelho e que o navegador guarda como objetos especiais
//   (não podem ser cifradas): a pasta do computador escolhida para as cópias e, se a abertura
//   automática estiver ligada, a chave de dados guardada de forma não exportável, e a ligação ao Google Drive.
// - apagados: o que foi apagado aqui, para a sincronização apagar também nos outros aparelhos.

import Dexie, { type EntityTable } from "dexie";
import type { Cifrado, Bytes, ParametrosArgon2 } from "../seguranca/cripto";
import type { DadosBiometria } from "../seguranca/biometria";

export interface Cofre {
  id: "principal";
  versao: 1;
  criadoEm: string;
  argon2: ParametrosArgon2;
  salPalavraPasse: Bytes;
  chaveViaPalavraPasse: Cifrado;
  salRecuperacao: Bytes;
  chaveViaRecuperacao: Cifrado;
  /** Desbloqueio com o rosto ou a impressão digital, só deste aparelho (não vai nas cópias). */
  biometria?: DadosBiometria;
  /** Quando as chaves embrulhadas mudaram (nova palavra-passe). Sem isto vale `criadoEm`. Decide qual aparelho tem a versão certa. */
  atualizadoEm?: string;
}

export interface Registo {
  tipo: string;
  id: string;
  atualizadoEm: string;
  conteudo: Cifrado;
}

export interface LocalPasta {
  id: "pasta-copias";
  pasta: FileSystemDirectoryHandle;
}

/**
 * Abertura automática neste aparelho: a chave de dados guardada pelo navegador como não exportável
 * (nem a app a consegue ler ou copiar; só a pode usar). A verificação confirma que ainda é a certa.
 */
export interface LocalAparelho {
  id: "aparelho";
  chave: CryptoKey;
  verificacao: Cifrado;
  desde: string;
}

/** Ligação ao Google Drive neste aparelho. Nada aqui é segredo: os dados no Drive vão cifrados. */
export interface LocalDrive {
  id: "drive";
  /** Ficheiro no Drive onde estão os dados (guardado para não o procurar de cada vez). */
  ficheiroId?: string;
  /** Pasta «Investimentos» no Drive (para abrir a partir da app). */
  pastaId?: string;
  /** Conta Google com que a ligação foi feita (só para mostrar). */
  conta?: string;
  ultimaSincronizacao?: string;
}

export type Local = LocalPasta | LocalAparelho | LocalDrive;

/** Registo apagado: serve para o apagar também nos outros aparelhos ao sincronizar. */
export interface Apagado {
  tipo: string;
  id: string;
  em: string;
}

export const NOME_BD = "investimentos";

export class BaseDados extends Dexie {
  cofre!: EntityTable<Cofre, "id">;
  registos!: Dexie.Table<Registo, [string, string]>;
  locais!: Dexie.Table<Local, string>;
  apagados!: Dexie.Table<Apagado, [string, string]>;

  constructor(nome = NOME_BD) {
    super(nome);
    this.version(1).stores({
      cofre: "id",
      registos: "[tipo+id], tipo",
      locais: "id",
    });
    this.version(2).stores({
      cofre: "id",
      registos: "[tipo+id], tipo",
      locais: "id",
      apagados: "[tipo+id]",
    });
  }
}

export const bd = new BaseDados();
