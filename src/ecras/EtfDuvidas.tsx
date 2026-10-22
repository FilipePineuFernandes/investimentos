// Zona de dúvidas (ponto 6.10): glossário fixo, que funciona sem internet.
// Os exemplos numéricos são calculados pelo motor da app, não escritos à mão.

import type { ReactNode } from "react";
import { Ecra } from "../componentes/ui";
import { valorFuturo } from "../calculo/etf";
import { valorParametro } from "../dados/parametros";
import { euros } from "../util/numeros";

const REVISTO = "2026-10-22";

export function EtfDuvidas({ voltar }: { voltar: () => void }) {
  const taxa = valorParametro("irs.mobiliario-taxa-liberatoria");
  const barato = valorFuturo(10_000, 0, 0.06 - 0.002, 30);
  const caro = valorFuturo(10_000, 0, 0.06 - 0.007, 30);

  const perguntas: { p: string; r: ReactNode }[] = [
    {
      p: "O que é o spread (bid/ask)?",
      r: (
        <>
          <p>
            É a diferença entre o preço a que pode comprar (<em>ask</em>) e o preço a que pode vender (<em>bid</em>) no mesmo momento. Não aparece na fatura, mas
            é um custo: quem compra e vende logo a seguir perde o spread.
          </p>
          <p>É mais baixo nos ETF grandes e muito negociados, e quando a bolsa onde estão as ações do ETF está aberta. Evite ordens nos primeiros e últimos minutos da sessão.</p>
        </>
      ),
    },
    {
      p: "Câmbio e comissões de compra: o que pago e a quem?",
      r: (
        <>
          <p>
            <strong>Comissão:</strong> paga à corretora em cada ordem de compra ou venda. Pode ser fixa, uma percentagem, ou as duas.
          </p>
          <p>
            <strong>Câmbio:</strong> se comprar o ETF numa bolsa que negoceia noutra moeda (por exemplo em dólares em Londres), a corretora converte os euros e cobra
            por isso. Comprar a versão do mesmo ETF cotada em euros evita esse custo. A moeda das ações dentro do fundo continua a variar, seja qual for a moeda em
            que comprou.
          </p>
          <p>Indique as condições da sua corretora no perfil, para a app as usar nas simulações.</p>
        </>
      ),
    },
    {
      p: "Que impostos pago na venda de um ETF e nos dividendos?",
      r: (
        <>
          <p>
            <strong>Na venda:</strong> paga IRS sobre a mais-valia (o que recebeu menos o que pagou, com as comissões). A taxa é de {taxa}%, ou pode optar por
            englobar os ganhos no rendimento e pagar pelos escalões. O imposto incide sobre o saldo do ano: as perdas de umas vendas abatem aos ganhos de outras.
          </p>
          <p>
            Se vender unidades que tem há menos de 365 dias e o seu rendimento coletável chegar ao último escalão do IRS, esse saldo tem de ser englobado.
          </p>
          <p>
            <strong>Nos dividendos</strong> (ETF de distribuição): paga {taxa}% todos os anos, retidos pela corretora se for portuguesa. Com uma corretora estrangeira, tem
            de os declarar no IRS.
          </p>
          <p>As vendas usam o método FIFO: as primeiras unidades compradas são as primeiras vendidas. O imposto depende sobretudo da sua situação, e muito pouco do ETF.</p>
        </>
      ),
    },
    {
      p: "O que é a tracking difference (e a diferença para o tracking error)?",
      r: (
        <>
          <p>
            <strong>Tracking difference:</strong> a diferença, num ano, entre o resultado do ETF e o do índice que replica. Normalmente é negativa e próxima do TER.
            Quanto mais próxima de zero (ou positiva), melhor.
          </p>
          <p>
            <strong>Tracking error:</strong> mede o quanto essa diferença varia de dia para dia. É um indicador de regularidade, não de custo.
          </p>
          <p>Encontra os dois no relatório anual do emitente.</p>
        </>
      ),
    },
    {
      p: "O que é o TER e como afeta o resultado a longo prazo?",
      r: (
        <>
          <p>
            É o custo anual do ETF, em percentagem, retirado todos os dias ao valor do fundo. Não o paga à parte: vê-o no resultado.
          </p>
          <p>
            Exemplo calculado pela app: 10 000 € durante 30 anos, a 6% ao ano antes de custos, dão cerca de <strong>{euros(Math.round(barato))}</strong> com um TER de
            0,2% e <strong>{euros(Math.round(caro))}</strong> com um TER de 0,7%. A diferença é de {euros(Math.round(barato - caro))}.
          </p>
        </>
      ),
    },
    {
      p: "Acumulação ou distribuição?",
      r: (
        <>
          <p>
            <strong>Acumulação:</strong> o ETF reinveste os dividendos. Em Portugal só paga imposto quando vender, por isso o imposto fica a render até lá.
          </p>
          <p>
            <strong>Distribuição:</strong> o ETF paga os dividendos, que pagam {taxa}% de IRS todos os anos. Dá um rendimento regular, mas a carteira cresce mais devagar
            se reinvestir o que sobra.
          </p>
        </>
      ),
    },
    {
      p: "Porque é que o domicílio do ETF importa (Irlanda, Luxemburgo, EUA)?",
      r: (
        <>
          <p>
            O país onde o fundo está registado define quanto imposto o próprio fundo paga sobre os dividendos das empresas que tem. Por exemplo, sobre os dividendos de
            ações americanas, os fundos irlandeses beneficiam em geral de uma retenção mais baixa do que os do Luxemburgo, por causa do acordo fiscal entre a Irlanda e
            os EUA. Esse imposto não aparece na sua declaração: reduz o resultado do fundo.
          </p>
          <p>
            Os ETF domiciliados nos EUA não têm documento KID para particulares na UE, por isso as corretoras europeias não os podem vender a particulares. Por isso
            não entram no catálogo.
          </p>
        </>
      ),
    },
    {
      p: "O que são as regras UCITS e o documento KID?",
      r: (
        <>
          <p>
            <strong>UCITS:</strong> regras europeias para fundos vendidos a particulares, com limites de concentração, guarda dos ativos por uma entidade independente e
            supervisão.
          </p>
          <p>
            <strong>KID:</strong> documento de informação fundamental, com poucas páginas, que todos os ETF vendidos a particulares na UE têm de ter. Mostra o objetivo,
            o risco (de 1 a 7), os custos e cenários de resultado. Encontra-o no site do emitente ou da corretora.
          </p>
        </>
      ),
    },
  ];

  return (
    <Ecra titulo="Zona de dúvidas" voltar={voltar}>
      <p className="suave">Respostas curtas às dúvidas mais comuns. Conteúdo revisto a {new Date(`${REVISTO}T00:00:00`).toLocaleDateString("pt-PT")}.</p>
      {perguntas.map((q) => (
        <details key={q.p} className="cartao">
          <summary>{q.p}</summary>
          {q.r}
        </details>
      ))}
      <p className="suave">Informação geral. Não é aconselhamento financeiro nem fiscal: confirme a sua situação com um contabilista certificado.</p>
    </Ecra>
  );
}
