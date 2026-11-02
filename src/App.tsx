import { useEffect, useState } from "react";
import { aparelhoLembrado, chaveDoAparelho, esquecerAparelho, existeCofre, lembrarAparelho } from "./dados/cofre";
import { DEFINICOES_PADRAO, diasDesdeUltimaCopia, fazerCopia, guardarDefinicoesCopias, lerDefinicoesCopias } from "./dados/copias";
import { aoAlterar } from "./dados/repositorio";
import { lerMarcador } from "./nuvem/sincronizar";
import { lerPerfil } from "./dados/perfil";
import { BoasVindas } from "./ecras/BoasVindas";
import { CriarCofre } from "./ecras/CriarCofre";
import { Desbloquear } from "./ecras/Desbloquear";
import { Restaurar } from "./ecras/Restaurar";
import { ASincronizar, DriveInicial } from "./ecras/DriveInicial";
import { EscolherLocal } from "./ecras/EscolherLocal";
import { PerfilEcra } from "./ecras/PerfilEcra";
import { Inicio } from "./ecras/Inicio";
import { DefinicoesEcra } from "./ecras/DefinicoesEcra";
import { CopiasSeguranca } from "./ecras/CopiasSeguranca";
import { ParametrosEcra } from "./ecras/ParametrosEcra";
import { ImoveisLista } from "./ecras/ImoveisLista";
import { ImovelEcra } from "./ecras/ImovelEcra";
import { EtfInicio } from "./ecras/EtfInicio";
import { EtfCatalogo, EtfFicha } from "./ecras/EtfCatalogo";
import { EtfSimulacao } from "./ecras/EtfSimulacao";
import { EtfCarteira } from "./ecras/EtfCarteira";
import { CarteiraGlobal } from "./ecras/CarteiraGlobal";
import { BiometriaEcra } from "./ecras/BiometriaEcra";
import { EtfDuvidas } from "./ecras/EtfDuvidas";

const BLOQUEIO_MINUTOS = 5;
/** Quanto tempo a abertura espera pelo Google Drive antes de seguir. */
const ESPERA_ABERTURA_MS = 8_000;
/** Depois da última alteração, espera este tempo antes de enviar (para juntar várias alterações seguidas). */
const ESPERA_ENVIO_MS = 5_000;
/** Ao voltar à app, só sincroniza de novo se já passou este tempo. */
const INTERVALO_SINCRONIZACAO_MS = 2 * 60_000;

type Ecra =
  | { nome: "carregar" }
  | { nome: "boasVindas" }
  | { nome: "criarCofre" }
  | { nome: "restaurarInicial" }
  | { nome: "driveInicial" }
  | { nome: "aSincronizar" }
  | { nome: "desbloquear"; mensagem?: string }
  | { nome: "assistenteLocal" }
  | { nome: "assistentePerfil" }
  | { nome: "inicio" }
  | { nome: "definicoes" }
  | { nome: "perfil" }
  | { nome: "copias" }
  | { nome: "alterarLocal" }
  | { nome: "restaurar" }
  | { nome: "parametros" }
  | { nome: "imoveis" }
  | { nome: "imovel"; id: string | null }
  | { nome: "etf" }
  | { nome: "etfCatalogo" }
  | { nome: "etfFicha"; isin: string | null }
  | { nome: "etfSimulacao" }
  | { nome: "etfCarteira" }
  | { nome: "etfDuvidas" }
  | { nome: "carteiraGlobal" }
  | { nome: "biometria" };

export function App() {
  const [ecra, setEcra] = useState<Ecra>({ nome: "carregar" });
  const [chave, setChave] = useState<CryptoKey | null>(null);
  /** A app abre sozinha neste aparelho (sem palavra-passe). */
  const [automatico, setAutomatico] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await existeCofre())) return setEcra({ nome: "boasVindas" });
      const guardada = await chaveDoAparelho();
      if (guardada) await aberto(guardada);
      else setEcra({ nome: "desbloquear" });
    })();
  }, []);

  function bloquear(mensagem?: string) {
    setChave(null);
    setEcra({ nome: "desbloquear", mensagem });
  }

  /** Botão 🔒: com a abertura automática ligada, desliga-a neste aparelho e passa a pedir a palavra-passe. */
  async function bloquearManual() {
    if (automatico) {
      if (!window.confirm("Bloquear a app desliga a abertura automática neste aparelho: da próxima vez, a app pede a palavra-passe (pode voltar a ligá-la ao abrir). Continuar?")) return;
      await esquecerAparelho();
      setAutomatico(false);
    }
    bloquear();
  }

  // Depois de abrir: completa o assistente se faltar algum passo.
  async function aberto(c: CryptoKey, lembrar?: boolean) {
    if (lembrar) await lembrarAparelho(c);
    setAutomatico((await aparelhoLembrado()) !== null);
    setChave(c);
    let def = await lerDefinicoesCopias(c);
    // Aparelho novo ligado ao Google Drive: a escolha do local já está feita, não se pergunta outra vez.
    if (!def && (await lerMarcador())) {
      def = { ...DEFINICOES_PADRAO, destino: "googleDrive" };
      await guardarDefinicoesCopias(c, def);
    }
    if (def?.destino === "googleDrive") {
      // Traz as novidades do Drive antes de decidir o que falta perguntar. Se a Google demorar, a app segue e a sincronização acaba por si.
      setEcra({ nome: "aSincronizar" });
      await Promise.race([fazerCopia(c, false), new Promise((resolver) => setTimeout(resolver, ESPERA_ABERTURA_MS))]);
    }
    if (!def) setEcra({ nome: "assistenteLocal" });
    else if (!(await lerPerfil(c))) setEcra({ nome: "assistentePerfil" });
    else setEcra({ nome: "inicio" });
  }

  // Bloqueio automático por inatividade (não se aplica com a abertura automática ligada).
  useEffect(() => {
    if (!chave || automatico) return;
    let ultima = Date.now();
    const atividade = () => (ultima = Date.now());
    const eventos = ["pointerdown", "keydown", "scroll", "touchstart"];
    eventos.forEach((e) => window.addEventListener(e, atividade, { passive: true }));
    const relogio = setInterval(() => {
      if (Date.now() - ultima > BLOQUEIO_MINUTOS * 60_000) bloquear(`A app foi bloqueada após ${BLOQUEIO_MINUTOS} minutos sem utilização.`);
    }, 15_000);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, atividade));
      clearInterval(relogio);
    };
  }, [chave, automatico]);

  // Cópia automática ao sair da app (só para a pasta do computador, no máximo uma vez por dia).
  useEffect(() => {
    if (!chave) return;
    const aoSair = async () => {
      if (document.visibilityState !== "hidden") return;
      const def = await lerDefinicoesCopias(chave);
      if (def?.destino === "pasta" && diasDesdeUltimaCopia(def) >= 1) await fazerCopia(chave, false);
    };
    document.addEventListener("visibilitychange", aoSair);
    return () => document.removeEventListener("visibilitychange", aoSair);
  }, [chave]);

  // Sincronização automática com o Google Drive: pouco depois de cada alteração, ao sair da app e ao voltar a ela.
  useEffect(() => {
    if (!chave) return;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let pendente = false;
    let ultima = Date.now();
    const sincronizarJa = async () => {
      clearTimeout(temporizador);
      pendente = false;
      if ((await lerDefinicoesCopias(chave))?.destino !== "googleDrive") return;
      ultima = Date.now();
      await fazerCopia(chave, false);
    };
    const parar = aoAlterar(() => {
      pendente = true;
      clearTimeout(temporizador);
      temporizador = setTimeout(sincronizarJa, ESPERA_ENVIO_MS);
    });
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "hidden") {
        if (pendente) void sincronizarJa();
      } else if (Date.now() - ultima > INTERVALO_SINCRONIZACAO_MS) {
        void sincronizarJa();
      }
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      parar();
      clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [chave]);

  switch (ecra.nome) {
    case "carregar":
      return null;
    case "boasVindas":
      return (
        <BoasVindas
          onComecar={() => setEcra({ nome: "criarCofre" })}
          onRestaurar={() => setEcra({ nome: "restaurarInicial" })}
          onDrive={() => setEcra({ nome: "driveInicial" })}
        />
      );
    case "driveInicial":
      return <DriveInicial voltar={() => setEcra({ nome: "boasVindas" })} onTrazido={(m) => setEcra({ nome: "desbloquear", mensagem: m })} />;
    case "criarCofre":
      return <CriarCofre voltar={() => setEcra({ nome: "boasVindas" })} onCriado={(c) => aberto(c)} />;
    case "restaurarInicial":
      return <Restaurar substituiDados={false} voltar={() => setEcra({ nome: "boasVindas" })} onRestaurado={(m) => setEcra({ nome: "desbloquear", mensagem: m })} />;
    case "desbloquear":
      return <Desbloquear mensagem={ecra.mensagem} onAberto={aberto} />;
  }

  if (!chave) return null;

  switch (ecra.nome) {
    case "aSincronizar":
      return <ASincronizar />;
    case "assistenteLocal":
      return <EscolherLocal chave={chave} assistente onConcluido={() => aberto(chave)} onSubstituido={(m) => bloquear(m)} />;
    case "assistentePerfil":
      return <PerfilEcra chave={chave} assistente onGuardado={() => setEcra({ nome: "inicio" })} />;
    case "inicio":
      return <Inicio chave={chave} onNavegar={(d) => setEcra({ nome: d })} onBloquear={bloquearManual} automatico={automatico} />;
    case "definicoes":
      return <DefinicoesEcra voltar={() => setEcra({ nome: "inicio" })} onNavegar={(d) => setEcra({ nome: d })} />;
    case "perfil":
      return <PerfilEcra chave={chave} assistente={false} voltar={() => setEcra({ nome: "definicoes" })} onGuardado={() => setEcra({ nome: "inicio" })} />;
    case "copias":
      return (
        <CopiasSeguranca
          chave={chave}
          voltar={() => setEcra({ nome: "definicoes" })}
          onAlterarLocal={() => setEcra({ nome: "alterarLocal" })}
          onRestaurar={() => setEcra({ nome: "restaurar" })}
        />
      );
    case "alterarLocal":
      return (
        <EscolherLocal
          chave={chave}
          assistente={false}
          voltar={() => setEcra({ nome: "copias" })}
          onConcluido={() => setEcra({ nome: "copias" })}
          onSubstituido={(m) => bloquear(m)}
        />
      );
    case "restaurar":
      return <Restaurar substituiDados voltar={() => setEcra({ nome: "copias" })} onRestaurado={(m) => bloquear(m)} />;
    case "parametros":
      return <ParametrosEcra voltar={() => setEcra({ nome: "definicoes" })} />;
    case "imoveis":
      return <ImoveisLista chave={chave} voltar={() => setEcra({ nome: "inicio" })} onAbrir={(id) => setEcra({ nome: "imovel", id })} />;
    case "imovel":
      return <ImovelEcra key={ecra.id ?? "novo"} chave={chave} id={ecra.id} voltar={() => setEcra({ nome: "imoveis" })} />;
    case "etf":
      return <EtfInicio chave={chave} voltar={() => setEcra({ nome: "inicio" })} onNavegar={(d) => setEcra({ nome: d })} />;
    case "etfCatalogo":
      return <EtfCatalogo chave={chave} voltar={() => setEcra({ nome: "etf" })} onAbrir={(isin) => setEcra({ nome: "etfFicha", isin })} />;
    case "etfFicha":
      return <EtfFicha key={ecra.isin ?? "novo"} chave={chave} isin={ecra.isin} voltar={() => setEcra({ nome: "etfCatalogo" })} />;
    case "etfSimulacao":
      return <EtfSimulacao chave={chave} voltar={() => setEcra({ nome: "etf" })} onCatalogo={() => setEcra({ nome: "etfCatalogo" })} onCarteira={() => setEcra({ nome: "etfCarteira" })} />;
    case "etfCarteira":
      return <EtfCarteira chave={chave} voltar={() => setEcra({ nome: "etf" })} />;
    case "biometria":
      return <BiometriaEcra chave={chave} automatico={automatico} onAutomatico={setAutomatico} voltar={() => setEcra({ nome: "definicoes" })} />;
    case "carteiraGlobal":
      return (
        <CarteiraGlobal
          chave={chave}
          voltar={() => setEcra({ nome: "inicio" })}
          onImoveis={() => setEcra({ nome: "imoveis" })}
          onEtf={() => setEcra({ nome: "etfCarteira" })}
        />
      );
    case "etfDuvidas":
      return <EtfDuvidas voltar={() => setEcra({ nome: "etf" })} />;
  }
}
