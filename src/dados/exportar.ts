// Exportação dos dados num ficheiro que se abre no Excel (CSV com ponto e vírgula). Ao contrário das cópias de
// segurança, este ficheiro NÃO vai cifrado: serve para ler, imprimir ou arquivar.

import { listarImoveis, NOMES_DESTINO, NOMES_ESTADO } from "./imoveis";
import { listarETF, NOMES_POLITICA, NOMES_REGIAO, NOMES_REPLICACAO, NOMES_SETOR } from "./etf";
import { listarCotacoes, listarMovimentos, NOMES_ORIGEM, NOMES_TIPO } from "./movimentosEtf";
import { lerNome } from "./utilizador";
import { lerPerfil, type Perfil } from "./perfil";
import { dataPt } from "../util/numeros";

type Celula = string | number | boolean | null | undefined;

const NOMES_REGIAO_FISCAL: Record<Perfil["residenciaFiscal"], string> = { continente: "Continente", acores: "Açores", madeira: "Madeira" };
const NOMES_TOLERANCIA: Record<Perfil["toleranciaRisco"], string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const NOMES_MODELO: Record<Perfil["modeloAlocacao"], string> = {
  "global-capitalizacao": "Global (por capitalização)",
  "global-mais-europa": "Global com mais Europa",
  personalizada: "Personalizada",
};
const NOMES_CONSERVACAO: Record<string, string> = { novo: "Novo", bom: "Bom", recuperar: "A recuperar", ruina: "Ruína" };

/** Uma célula em texto: números com vírgula decimal (como o Excel português espera), sim/não, vazio quando não há valor. */
export function celula(v: Celula): string {
  let t: string;
  if (v === null || v === undefined || v === "") t = "";
  else if (typeof v === "number") t = Number.isFinite(v) ? String(v).replace(".", ",") : "";
  else if (typeof v === "boolean") t = v ? "sim" : "não";
  else t = v;
  // Aspas à volta de tudo o que tenha separadores, aspas ou mudanças de linha.
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const linha = (...cs: Celula[]) => cs.map(celula).join(";");
const data = (iso: string | null | undefined) => (iso ? dataPt(iso) : "");

export async function gerarCsv(chave: CryptoKey, hoje = new Date()): Promise<string> {
  const [nome, perfil, imoveis, etfs, movimentos, cotacoes] = await Promise.all([
    lerNome(chave),
    lerPerfil(chave),
    listarImoveis(chave),
    listarETF(chave),
    listarMovimentos(chave),
    listarCotacoes(chave),
  ]);
  const e: string[] = [];
  const secao = (titulo: string) => e.push("", linha(titulo.toUpperCase()));

  e.push(linha("Exportação dos meus dados"), linha("Gerada em", hoje.toLocaleString("pt-PT")));
  e.push(linha("Atenção: este ficheiro não está cifrado. Guarde-o num sítio seguro e apague-o quando já não precisar."));

  if (perfil) {
    secao("Perfil do investidor");
    e.push(linha("Campo", "Valor"));
    e.push(linha("Nome", nome));
    e.push(linha("Data de nascimento", data(perfil.dataNascimento)));
    e.push(linha("Residência fiscal", NOMES_REGIAO_FISCAL[perfil.residenciaFiscal]));
    e.push(linha("Rendimento mensal líquido (€)", perfil.rendimentoMensalLiquido));
    e.push(linha("Outras prestações por mês (€)", perfil.outrasPrestacoes));
    e.push(linha("Rendimento coletável anual (€)", perfil.rendimentoColetavelAnual));
    e.push(linha("Quociente familiar (2 = tributação conjunta)", perfil.quocienteFamiliar));
    e.push(linha("Englobar rendas", perfil.englobamentoRendas));
    e.push(linha("Englobar mais-valias", perfil.englobamentoMaisValias));
    e.push(linha("Tolerância ao risco", NOMES_TOLERANCIA[perfil.toleranciaRisco]));
    e.push(linha("Modelo de alocação", NOMES_MODELO[perfil.modeloAlocacao]));

    secao("Corretora");
    const c = perfil.corretora;
    e.push(linha("Campo", "Valor"));
    e.push(linha("Nome", c.nome));
    e.push(linha("Comissão fixa por ordem (€)", c.comissaoFixa));
    e.push(linha("Comissão sobre o valor (%)", c.comissaoPercentagem));
    e.push(linha("Comissão mínima por ordem (€)", c.comissaoMinima));
    e.push(linha("Comissão máxima por ordem (€)", c.comissaoMaxima));
    e.push(linha("Câmbio (%)", c.cambioPercentagem));
    e.push(linha("Custódia anual (%)", c.custodiaAnualPercentagem));

    if (perfil.nota) {
      const n = perfil.nota;
      secao("Nota de liquidação de IRS");
      e.push(linha("Campo", "Valor"));
      e.push(linha("Ano dos rendimentos", n.anoRendimentos));
      e.push(linha("Data da liquidação", data(n.dataLiquidacao)));
      e.push(linha("Data limite de pagamento", data(n.dataLimitePagamento)));
      e.push(linha("Rendimento global (€)", n.rendimentoGlobal));
      e.push(linha("Deduções específicas (€)", n.deducoesEspecificas));
      e.push(linha("Rendimento coletável (€)", n.rendimentoColetavel));
      e.push(linha("Rendimento para determinação da taxa (€)", n.rendimentoParaTaxa));
      e.push(linha("Quociente familiar", n.quocienteFamiliar));
      e.push(linha("Taxa marginal (%)", n.taxaMarginal));
      e.push(linha("Coleta total (€)", n.coletaTotal));
      e.push(linha("Deduções à coleta (€)", n.deducoesColeta));
      e.push(linha("Coleta líquida (€)", n.coletaLiquida));
      e.push(linha("Imposto apurado (€, negativo = a receber)", n.impostoApurado));
      e.push(linha("Taxa efetiva (%)", n.taxaEfetiva));
      e.push(linha("Lida na app em", data(n.importadaEm)));
    }
  }

  secao("Imóveis");
  if (imoveis.length === 0) e.push(linha("Sem imóveis registados"));
  else {
    e.push(
      linha(
        "Nome", "Estado", "Morada", "Município", "Freguesia", "Destino", "Tipologia", "Área (m²)", "Ano de construção", "Conservação",
        "VPT (€)", "Preço (€)", "Financiado", "Montante do crédito (€)", "Prazo (anos)", "Estratégias analisadas", "Data de compra", "Obras realizadas (€)", "Renda do contrato (€/mês)",
      ),
    );
    for (const i of imoveis) {
      const estrategias = [i.revenda && "revenda", i.arrendamento && "arrendamento", i.reconstrucao && "reconstrução", i.cedencia && "cedência de posição"].filter(Boolean).join(", ");
      e.push(
        linha(
          i.nome, NOMES_ESTADO[i.estado] ?? i.estado, i.morada, i.municipio, i.freguesia, NOMES_DESTINO[i.destino] ?? i.destino, i.tipologia, i.area, i.anoConstrucao,
          NOMES_CONSERVACAO[i.conservacao] ?? i.conservacao, i.vpt, i.preco, !!i.financiamento, i.financiamento?.montante, i.financiamento?.prazoAnos, estrategias,
          data(i.carteira?.dataCompra), i.carteira?.obrasRealizadas, i.carteira?.rendaContrato,
        ),
      );
    }
  }

  secao("ETF no catálogo");
  if (etfs.length === 0) e.push(linha("Sem ETF no catálogo"));
  else {
    e.push(linha("ISIN", "Código", "Nome", "Emitente", "Índice", "Região", "Setor", "TER (%)", "Política", "Domicílio", "Dimensão (M€)", "Replicação", "Verificado em"));
    for (const f of etfs) {
      e.push(
        linha(f.isin, f.ticker, f.nome, f.emitente, f.indice, NOMES_REGIAO[f.regiao] ?? f.regiao, NOMES_SETOR[f.setor] ?? f.setor, f.ter, NOMES_POLITICA[f.politica] ?? f.politica, f.domicilio, f.dimensao, NOMES_REPLICACAO[f.replicacao] ?? f.replicacao, data(f.atualizadoEm)),
      );
    }
  }

  secao("Compras, vendas e dividendos de ETF");
  if (movimentos.length === 0) e.push(linha("Sem movimentos registados"));
  else {
    e.push(linha("Data", "ISIN", "Tipo", "Quantidade", "Preço (€)", "Comissão (€)", "Dividendo bruto (€)", "Imposto retido (€)", "Corretora", "Origem"));
    for (const m of movimentos) {
      e.push(linha(data(m.data), m.isin, NOMES_TIPO[m.tipo] ?? m.tipo, m.quantidade, m.preco, m.comissao, m.valor, m.imposto, m.corretora, m.origem ? NOMES_ORIGEM[m.origem] : ""));
    }
  }

  if (cotacoes.length > 0) {
    secao("Últimas cotações de ETF");
    e.push(linha("ISIN", "Preço (€)", "Data"));
    for (const c of cotacoes) e.push(linha(c.isin, c.preco, data(c.data)));
  }

  return e.join("\r\n") + "\r\n";
}

export function nomeFicheiroExportacao(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `investimentos-dados-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`;
}

/** O Excel só reconhece os acentos se o ficheiro começar por esta marca (BOM). */
export const comMarcaDeCodificacao = (csv: string): string => "﻿" + csv;
