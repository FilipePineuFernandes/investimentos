// Dados dos gráficos da carteira: cada ativo (imóvel, ETF, moeda) com o que pagou, o valor de
// hoje e o lucro, e as chaves por que se pode agrupar (área, setor, região…). Somar por grupo e
// saber que combinações de tipo de gráfico e medida fazem sentido.

import type { Metrica } from "./historico";
import { centimos } from "./util";

export type TipoGrafico = "circular" | "barras" | "evolucao";

export const NOMES_TIPO_GRAFICO: Record<TipoGrafico, string> = { circular: "Circular", barras: "Barras", evolucao: "Evolução" };

export interface ItemGrafico {
  id: string;
  nome: string;
  /** Para cada forma de agrupar (área, setor…), o grupo a que o ativo pertence. */
  grupos: Record<string, { id: string; nome: string }>;
  custo: number | null;
  valor: number | null;
  lucro: number | null;
}

export interface ValorGrupo {
  id: string;
  nome: string;
  valor: number;
}

/** Soma os ativos de cada grupo na medida escolhida. O lucro em % é o lucro do grupo sobre o que pagou. */
export function agregar(itens: ItemGrafico[], agrupar: string, medida: Metrica): { grupos: ValorGrupo[]; semDados: number } {
  const somas = new Map<string, { nome: string; custo: number; valor: number; lucro: number }>();
  let semDados = 0;
  for (const i of itens) {
    const g = i.grupos[agrupar];
    if (!g) continue;
    const precisa = medida === "valor" ? i.valor : medida === "custo" ? i.custo : medida === "lucro" ? i.lucro : i.lucro !== null && i.custo !== null ? i.lucro : null;
    if (precisa === null) {
      semDados++;
      continue;
    }
    const s = somas.get(g.id) ?? { nome: g.nome, custo: 0, valor: 0, lucro: 0 };
    s.custo += i.custo ?? 0;
    s.valor += i.valor ?? 0;
    s.lucro += i.lucro ?? 0;
    somas.set(g.id, s);
  }
  const grupos = [...somas.entries()].flatMap(([id, s]) => {
    if (medida === "lucroPct") return s.custo > 0 ? [{ id, nome: s.nome, valor: centimos((s.lucro / s.custo) * 100) }] : [];
    const valor = medida === "valor" ? s.valor : medida === "custo" ? s.custo : s.lucro;
    return [{ id, nome: s.nome, valor: centimos(valor) }];
  });
  return { grupos, semDados };
}

/** Se a combinação faz sentido; se não, porquê (para explicar no ecrã dos parâmetros). */
export function compatibilidade(tipo: TipoGrafico, medida: Metrica, temEvolucao: boolean): string | null {
  if (tipo === "circular" && (medida === "lucro" || medida === "lucroPct")) {
    return "O gráfico circular mostra partes de um todo: use-o com o valor ou com o que pagou. Para o lucro, escolha barras.";
  }
  if (tipo === "evolucao" && !temEvolucao) return "Esta forma de agrupar não tem evolução no tempo: escolha barras ou circular.";
  return null;
}
