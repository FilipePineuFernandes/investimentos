import { useEffect, useState } from "react";
import { preCarregarGoogle } from "./googleDrive";

/**
 * Carrega o início de sessão da Google assim que o ecrã abre. Os botões que abrem a janela da Google só devem
 * ficar ativos quando estiver "pronto": se a pessoa tocar antes, o navegador bloqueia a janela.
 */
export function useGoogle(ativo = true): "a-carregar" | "pronto" | "falhou" {
  const [estado, setEstado] = useState<"a-carregar" | "pronto" | "falhou">("a-carregar");
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    preCarregarGoogle().then(
      () => vivo && setEstado("pronto"),
      () => vivo && setEstado("falhou"),
    );
    return () => {
      vivo = false;
    };
  }, [ativo]);
  return estado;
}
