// Símbolos da app, desenhados no estilo do logotipo: traço grosso e arredondado em verde-azulado,
// com um detalhe a cinzento (como a grelha e a seta do logotipo). As cores vêm de --ic-a e --ic-b.

import type { ReactNode } from "react";

export type NomeIcone = "carteira" | "imobiliario" | "etf" | "cripto" | "definicoes" | "dados" | "bloquear" | "informacao" | "catalogo" | "procurar" | "duvidas" | "acrescentar" | "simular";

const DENTES = [0, 45, 90, 135, 180, 225, 270, 315];

const DESENHOS: Record<NomeIcone, ReactNode> = {
  carteira: (
    <>
      <path className="a" d="M24 20v-4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" />
      <rect className="a" x="8" y="20" width="48" height="34" rx="7" />
      <path className="bl" d="M8 35h48" />
      <rect className="b" x="27" y="31" width="10" height="9" rx="2.5" />
    </>
  ),
  imobiliario: (
    <>
      <path className="a" d="M8 32 32 11l24 21" />
      <path className="a" d="M14 28v24h36V28" />
      <path className="b" d="M27 52V39a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v13Z" />
    </>
  ),
  etf: (
    <>
      <rect className="b" x="9" y="44" width="11" height="10" rx="2.5" />
      <rect className="b" x="26.5" y="36" width="11" height="18" rx="2.5" />
      <rect className="b" x="44" y="28" width="11" height="26" rx="2.5" />
      <path className="a" d="M8 36 24 24l10 6 20-20" />
      <path className="a" d="M43 9h11v11" />
    </>
  ),
  // Moeda com um losango ao centro: as criptomoedas
  cripto: (
    <>
      <circle className="a" cx="32" cy="32" r="22" />
      <circle className="bl" cx="32" cy="32" r="15" />
      <path className="b" d="M32 22 41 32 32 42 23 32Z" />
    </>
  ),
  // Pessoa com uma roda dentada: o perfil e as definições
  definicoes: (
    <>
      <circle className="a" cx="25" cy="19" r="10" />
      <path className="a" d="M7 55c0-11 7-18 18-18 3 0 5.5.5 8 1.6" />
      <g className="peq" transform="translate(46 44) scale(.62) translate(-32 -32)">
        {DENTES.map((g) => (
          <path key={g} className="a dente" d="M32 9v7" transform={`rotate(${g} 32 32)`} />
        ))}
        <circle className="a" cx="32" cy="32" r="16" />
        <circle className="b" cx="32" cy="32" r="6" />
      </g>
    </>
  ),
  dados: (
    <>
      <path className="a" d="M12 16v32c0 4.4 8.9 8 20 8s20-3.6 20-8V16" />
      <ellipse className="a" cx="32" cy="16" rx="20" ry="8" />
      <path className="bl" d="M12 32c0 4.4 8.9 8 20 8s20-3.6 20-8" />
    </>
  ),
  bloquear: (
    <>
      <path className="a" d="M22 28v-7a10 10 0 0 1 20 0v7" />
      <rect className="a" x="14" y="28" width="36" height="26" rx="7" />
      <circle className="b" cx="32" cy="39" r="3.5" />
      <path className="bl" d="M32 41v6" />
    </>
  ),
  // Círculo com um «i»: informação sobre a área
  informacao: (
    <>
      <circle className="a" cx="32" cy="32" r="22" />
      <path className="bl" d="M32 29v15" />
      <circle className="b" cx="32" cy="20.5" r="3.5" />
    </>
  ),
  // Livro aberto com linhas: o catálogo
  catalogo: (
    <>
      <path className="a" d="M32 18c-6-4-14-5-22-4v34c8-1 16 0 22 4 6-4 14-5 22-4V14c-8-1-16 0-22 4Z" />
      <path className="a" d="M32 18v34" />
      <path className="bl" d="M16 25h10M16 32h10M38 25h10M38 32h10" />
    </>
  ),
  // Lupa com um «+»: procurar e acrescentar
  procurar: (
    <>
      <circle className="a" cx="27" cy="27" r="16" />
      <path className="a" d="M39 39l14 14" />
      <path className="bl" d="M27 20v14M20 27h14" />
    </>
  ),
  // Ficha com um «+»: acrescentar um registo
  acrescentar: (
    <>
      <rect className="a" x="12" y="8" width="34" height="44" rx="6" />
      <path className="bl" d="M20 20h18M20 28h12" />
      <circle className="b" cx="46" cy="46" r="11" />
      <path className="bl" d="M46 40v12M40 46h12" style={{ stroke: "#fff" }} />
    </>
  ),
  // Calculadora: simular um investimento
  simular: (
    <>
      <rect className="a" x="14" y="8" width="36" height="48" rx="7" />
      <rect className="b" x="21" y="15" width="22" height="9" rx="2" />
      <path className="bl" d="M22 33h4M30 33h4M38 33h4M22 41h4M30 41h4M22 49h4M30 49h4" />
      <path className="a" d="M40 40v10" />
    </>
  ),
  // Balão de conversa com um ponto de interrogação: dúvidas
  duvidas: (
    <>
      <path className="a" d="M12 14h40a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H30l-10 9v-9h-8a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" />
      <path className="bl" d="M26 24.5a6 6 0 1 1 8.5 5.5c-1.6.8-2.5 2-2.5 3.5V35" />
      <circle className="b" cx="32" cy="40" r="2.6" />
    </>
  ),
};

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg className="ic" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {DESENHOS[nome]}
    </svg>
  );
}
