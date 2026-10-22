import { Aviso } from "./ui";

export function estaInstalada(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

export function eIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** No iPhone/iPad, uma app web não instalada pode perder os dados ao fim de algum tempo sem uso. */
export function AvisoInstalacao() {
  if (estaInstalada() || !eIOS()) return null;
  return (
    <Aviso tipo="atencao" titulo="Instale a app no ecrã principal">
      No iPhone e no iPad, use o Safari: toque em <strong>Partilhar</strong> e depois em <strong>Adicionar ao ecrã principal</strong>. Sem isso, o sistema
      pode apagar os dados da app se ela não for usada durante algum tempo.
    </Aviso>
  );
}
