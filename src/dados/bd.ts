// Base de dados local (IndexedDB do navegador, através do Dexie).
//
// - cofre: as chaves embrulhadas e os parâmetros de derivação (nada legível sem a palavra-passe).
// - registos: todos os dados da app, cada um cifrado com a chave de dados.
// - locais: referências a pastas do computador escolhidas para as cópias. Não são dados
//   do utilizador e não podem ser cifradas (o navegador guarda-as como objetos especiais).

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

export const NOME_BD = "investimentos";

export class BaseDados extends Dexie {
  cofre!: EntityTable<Cofre, "id">;
  registos!: Dexie.Table<Registo, [string, string]>;
  locais!: EntityTable<LocalPasta, "id">;

  constructor(nome = NOME_BD) {
    super(nome);
    this.version(1).stores({
      cofre: "id",
      registos: "[tipo+id], tipo",
      locais: "id",
    });
  }
}

export const bd = new BaseDados();
