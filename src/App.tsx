import { useEffect, useState } from "react";
import { existeCofre } from "./dados/cofre";
import { diasDesdeUltimaCopia, fazerCopia, lerDefinicoesCopias } from "./dados/copias";
import { lerPerfil } from "./dados/perfil";
import { BoasVindas } from "./ecras/BoasVindas";
import { CriarCofre } from "./ecras/CriarCofre";
import { Desbloquear } from "./ecras/Desbloquear";
import { Restaurar } from "./ecras/Restaurar";
import { EscolherLocal } from "./ecras/EscolherLocal";
import { PerfilEcra } from "./ecras/PerfilEcra";
import { Inicio } from "./ecras/Inicio";
import { CopiasSeguranca } from "./ecras/CopiasSeguranca";
import { ParametrosEcra } from "./ecras/ParametrosEcra";
import { ImoveisLista } from "./ecras/ImoveisLista";
import { ImovelEcra } from "./ecras/ImovelEcra";
import { EtfInicio } from "./ecras/EtfInicio";
import { EtfCatalogo, EtfFicha } from "./ecras/EtfCatalogo";
import { EtfSimulacao } from "./ecras/EtfSimulacao";
import { EtfCarteira } from "./ecras/EtfCarteira";
import { EtfDuvidas } from "./ecras/EtfDuvidas";

const BLOQUEIO_MINUTOS = 5;

type Ecra =
  | { nome: "carregar" }
  | { nome: "boasVindas" }
  | { nome: "criarCofre" }
  | { nome: "restaurarInicial" }
  | { nome: "desbloquear"; mensagem?: string }
  | { nome: "assistenteLocal" }
  | { nome: "assistentePerfil" }
  | { nome: "inicio" }
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
  | { nome: "etfDuvidas" };

export function App() {
  const [ecra, setEcra] = useState<Ecra>({ nome: "carregar" });
  const [chave, setChave] = useState<CryptoKey | null>(null);

  useEffect(() => {
    existeCofre().then((existe) => setEcra(existe ? { nome: "desbloquear" } : { nome: "boasVindas" }));
  }, []);

  function bloquear(mensagem?: string) {
    setChave(null);
    setEcra({ nome: "desbloquear", mensagem });
  }

  // Depois de abrir: completa o assistente se faltar algum passo.
  async function aberto(c: CryptoKey) {
    setChave(c);
    if (!(await lerDefinicoesCopias(c))) setEcra({ nome: "assistenteLocal" });
    else if (!(await lerPerfil(c))) setEcra({ nome: "assistentePerfil" });
    else setEcra({ nome: "inicio" });
  }

  // Bloqueio automático por inatividade.
  useEffect(() => {
    if (!chave) return;
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
  }, [chave]);

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

  switch (ecra.nome) {
    case "carregar":
      return null;
    case "boasVindas":
      return <BoasVindas onComecar={() => setEcra({ nome: "criarCofre" })} onRestaurar={() => setEcra({ nome: "restaurarInicial" })} />;
    case "criarCofre":
      return <CriarCofre voltar={() => setEcra({ nome: "boasVindas" })} onCriado={aberto} />;
    case "restaurarInicial":
      return <Restaurar substituiDados={false} voltar={() => setEcra({ nome: "boasVindas" })} onRestaurado={(m) => setEcra({ nome: "desbloquear", mensagem: m })} />;
    case "desbloquear":
      return <Desbloquear mensagem={ecra.mensagem} onAberto={aberto} />;
  }

  if (!chave) return null;

  switch (ecra.nome) {
    case "assistenteLocal":
      return <EscolherLocal chave={chave} assistente onConcluido={() => aberto(chave)} />;
    case "assistentePerfil":
      return <PerfilEcra chave={chave} assistente onGuardado={() => setEcra({ nome: "inicio" })} />;
    case "inicio":
      return <Inicio chave={chave} onNavegar={(d) => setEcra({ nome: d })} onBloquear={() => bloquear()} />;
    case "perfil":
      return <PerfilEcra chave={chave} assistente={false} voltar={() => setEcra({ nome: "inicio" })} onGuardado={() => setEcra({ nome: "inicio" })} />;
    case "copias":
      return (
        <CopiasSeguranca
          chave={chave}
          voltar={() => setEcra({ nome: "inicio" })}
          onAlterarLocal={() => setEcra({ nome: "alterarLocal" })}
          onRestaurar={() => setEcra({ nome: "restaurar" })}
        />
      );
    case "alterarLocal":
      return <EscolherLocal chave={chave} assistente={false} voltar={() => setEcra({ nome: "copias" })} onConcluido={() => setEcra({ nome: "copias" })} />;
    case "restaurar":
      return <Restaurar substituiDados voltar={() => setEcra({ nome: "copias" })} onRestaurado={(m) => bloquear(m)} />;
    case "parametros":
      return <ParametrosEcra voltar={() => setEcra({ nome: "inicio" })} />;
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
    case "etfDuvidas":
      return <EtfDuvidas voltar={() => setEcra({ nome: "etf" })} />;
  }
}
