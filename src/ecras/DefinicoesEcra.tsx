import { Ecra, Opcao } from "../componentes/ui";

export type DestinoDefinicoes = "perfil" | "copias" | "biometria" | "parametros";

/** Tudo o que se configura uma vez e depois quase não se mexe. */
export function DefinicoesEcra({ voltar, onNavegar }: { voltar: () => void; onNavegar: (d: DestinoDefinicoes) => void }) {
  return (
    <Ecra titulo="Definições e perfil" voltar={voltar}>
      <Opcao titulo="Perfil do investidor" descricao="Data de nascimento, residência fiscal, rendimentos, nota de liquidação de IRS e corretora." onClick={() => onNavegar("perfil")} />
      <Opcao titulo="Onde estão os meus dados" descricao="Local das cópias de segurança e restauro." onClick={() => onNavegar("copias")} />
      <Opcao titulo="Abertura da app" descricao="Palavra-passe, rosto ou impressão digital, e abertura automática neste aparelho." onClick={() => onNavegar("biometria")} />
      <Opcao titulo="Parâmetros fiscais" descricao="Taxas e valores usados nas contas (IMT, IMI, IRS e outros)." onClick={() => onNavegar("parametros")} />
    </Ecra>
  );
}
