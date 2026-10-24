const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel,
  AlignmentType, LevelFormat, WidthType, ShadingType, BorderStyle, PageBreak,
  Header, Footer, PageNumber, TableOfContents,
} = require("docx");

const OUT = process.argv[2] || "Especificacao.docx";
const W = 9638; // largura útil A4 com margens de 2 cm
const AZUL = "1F3864", AZUL_CLARO = "D9E2F3", CINZA = "F2F2F2", VERDE_CL = "E2EFDA", AMARELO_CL = "FFF2CC";

// **negrito** dentro de um texto
function runs(text, base = {}) {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(s =>
    s.startsWith("**") ? new TextRun({ text: s.slice(2, -2), bold: true, ...base }) : new TextRun({ text: s, ...base }));
}
const P = (t, o = {}) => new Paragraph({ children: runs(t), spacing: { after: 120 }, ...o });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const B = (t, l = 0) => new Paragraph({ numbering: { reference: "bul", level: l }, children: runs(t), spacing: { after: 60 } });
const N = (t, ref = "num") => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60 } });
const Bs = (arr) => arr.map(x => Array.isArray(x) ? x.map(y => B(y, 1)) : B(x)).flat();

function Caixa(titulo, linhas, cor = AZUL_CLARO) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "8EAADB" };
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: cor, color: "auto" },
      borders: { top: border, bottom: border, left: { style: BorderStyle.SINGLE, size: 24, color: AZUL }, right: border },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      children: [
        ...(titulo ? [new Paragraph({ children: [new TextRun({ text: titulo, bold: true, color: AZUL })], spacing: { after: 80 } })] : []),
        ...linhas.map(l => new Paragraph({ children: runs(l), spacing: { after: 60 } })),
      ],
    })] })],
  });
}
const Esp = () => new Paragraph({ children: [], spacing: { after: 60 } });

function Tab(cab, linhas, pesos) {
  const total = pesos.reduce((a, b) => a + b, 0);
  const cw = pesos.map(p => Math.floor(W * p / total));
  cw[cw.length - 1] += W - cw.reduce((a, b) => a + b, 0);
  const bd = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
  const borders = { top: bd, bottom: bd, left: bd, right: bd };
  const cel = (t, i, head, fill) => new TableCell({
    width: { size: cw[i], type: WidthType.DXA }, borders,
    shading: { type: ShadingType.CLEAR, fill: head ? AZUL : (fill || "FFFFFF"), color: "auto" },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(t).split("\n").map(s => new Paragraph({ children: runs(s, head ? { bold: true, color: "FFFFFF", size: 19 } : { size: 19 }) })),
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: cw,
    rows: [
      new TableRow({ tableHeader: true, children: cab.map((c, i) => cel(c, i, true)) }),
      ...linhas.map((l, r) => new TableRow({ children: l.map((c, i) => cel(c, i, false, r % 2 ? CINZA : null)) })),
    ],
  });
}

// ---------------------------------------------------------------- CONTEÚDO
const c = [];

// Capa
c.push(
  new Paragraph({ children: [], spacing: { before: 2400 } }),
  new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Aplicação de Investimentos", bold: true, size: 56, color: AZUL })] }),
  new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 6 } },
    children: [new TextRun({ text: "Imobiliário e ETF", size: 36, color: "2F5496" })] }),
  new Paragraph({ children: [new TextRun({ text: "Especificação revista: necessidades, funcionalidades e soluções de implementação", size: 28 })], spacing: { after: 600 } }),
  P("Este documento junta as duas versões anteriores, a descrição inicial da aplicação e as propostas de melhoria. Para cada funcionalidade diz o que a app deve fazer, de onde vêm os dados, como se calcula o resultado e o que fica fora do alcance da app."),
  P("**Data:** 22 de outubro de 2026"),
  P("**Estado:** versão 7. Todas as decisões do ponto 12 incorporadas, incluindo as da fase 2: dados do INE trazidos pela publicação automática, pesquisa de comparáveis em 14 plataformas, mapa com o preço ou a renda de cada anúncio, cenários de valorização com nomes descritivos e referências do Banco de Portugal. Sem decisões pendentes."),
  new Paragraph({ children: [], spacing: { before: 1200 } }),
  Caixa("Nota importante", [
    "Os valores fiscais e regulamentares indicados (IMT, Imposto do Selo, limites do Banco de Portugal, taxas de IRS) servem para desenhar a app. Na app ficam guardados em tabelas com data e fonte, e devem ser confirmados em cada atualização anual (Orçamento do Estado, Portal das Finanças, Banco de Portugal).",
    "A app é uma ferramenta de simulação de uso individual: qualquer pessoa a pode instalar, mas cada uma só trabalha com os seus próprios dados. Não é aconselhamento financeiro nem fiscal.",
  ], AMARELO_CL),
);

// Índice
c.push(
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ children: [new TextRun({ text: "Índice", bold: true, size: 32, color: AZUL })], spacing: { after: 200 } }),
  new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-2" }),
  P("(Para atualizar o índice no Word: clique com o botão direito sobre ele e escolha \"Atualizar campo\".)", { children: runs("(Para atualizar o índice no Word: clique com o botão direito sobre ele e escolha \"Atualizar campo\".)", { italics: true, color: "7F7F7F", size: 18 }) }),
);

// 1. Sumário
c.push(
  H1("1. Sumário executivo"),
  P("A aplicação tem duas áreas, **Imobiliário** e **ETF**, e passa a ter uma terceira, transversal, de **Património consolidado**. A revisão segue quatro princípios:"),
  N("**Dados e cálculos ficam no aparelho.** A base de dados é local e cifrada, e todos os cálculos (impostos, prestação, rentabilidade, juros compostos) são feitos por código determinístico, nunca pela IA."),
  N("**A internet serve só para ir buscar dados de referência**, de fontes concretas e de preferência oficiais e abertas (INE, Banco Central Europeu, Banco de Portugal). Cada valor obtido fica guardado com a **fonte e a data**."),
  N("**A IA explica, não descobre.** Recebe apenas os dados já obtidos e calculados, e escreve resumos e justificações. Quando não há dados, a app mostra **\"Não encontrado\"**. Nunca há números inventados."),
  N("**Construção por fases.** Primeiro uma versão que funciona sem internet (calculadoras, carteiras, cópia cifrada manual). Depois entram os dados externos, a comparação de ETF, a IA e a cópia automática para o Google Drive."),
  Esp(),
  Caixa("Decisões tomadas (detalhe e consequências no ponto 12)", [
    "**Utilização:** app distribuída, de uso individual. Cada pessoa que a instala só trabalha com os seus próprios dados, e não há servidor central nem contas partilhadas.",
    "**Plataformas:** qualquer aparelho (Android, iPhone, Windows, Mac, tablet), construindo a app como **aplicação web instalável (PWA)**: um só código, sem lojas e sem contas de programador pagas.",
    "**IA:** sim, com dois serviços de IA gratuitos: um principal e um de reserva, que entra automaticamente quando o primeiro esgotar o limite gratuito. Sempre opcional.",
    "**Dados de ETF:** 0 €, com introdução manual e importação de ficheiros dos emitentes.",
    "**API do Idealista:** pedir acesso.",
    "**Comparação com a carteira de ETF:** só acontece quando já existe carteira.",
    "**Propostas e compras de ETF:** a IA avança com propostas (equilíbrio da carteira, setores interdependentes, indicadores de valorização); o utilizador escolhe dessas propostas e atribui um valor a cada escolha. Só os escolhidos são guardados, e as compras registadas ficam na carteira.",
    "**Simulação de ganhos dos ETF:** cenários de 4%, 6%, 8% e 10% ao ano.",
    "**Local das cópias:** no primeiro arranque, o utilizador escolhe entre Google Drive, Dropbox, pasta no computador ou cópias descarregadas. A app mostra sempre onde está a guardar e permite alterar o local.",
  ], VERDE_CL),
  Esp(),
  H2("1.1 Principais alterações em relação à versão inicial"),
  Tab(["Tema", "Versão inicial", "Versão revista"], [
    ["Localização", "\"Interior ou litoral\"", "Morada ou ponto no mapa, com município e freguesia. Os impostos dependem do destino do imóvel, da região (Continente, Açores, Madeira), da idade do comprador e da ARU."],
    ["Preços de mercado", "A IA pesquisa os portais num raio de 2–3 km", "Valores medianos oficiais do INE por freguesia, comparáveis introduzidos pelo utilizador e, se for concedido acesso, a API do Idealista. Sem recolha automática não autorizada."],
    ["Projeções do imóvel", "\"Previsão da inflação pelo INE\"", "Cenários a partir do histórico do Índice de Preços da Habitação (INE). As projeções de inflação do Banco de Portugal são usadas só para custos."],
    ["Revenda e arrendamento", "Uma única área", "Duas estratégias separadas, com rentabilidade, cash-flow, ROI, TIR e payback."],
    ["Financiamento", "Montante e prazo", "Também spread, tipo de taxa, indexante, seguros, TAEG e validação dos limites do Banco de Portugal (LTV, DSTI, prazo)."],
    ["Reconstrução", "Tudo em m², com opção \"total\"", "Unidade certa para cada trabalho, obra integral e obra por zonas como alternativas, valor depois da obra, licenciamento, prazo e ARU."],
    ["Projeção dos ETF", "8% fixos", "Taxa editável em quatro cenários (4%, 6%, 8% e 10%), já descontado o TER, com valores nominais e reais. Mesmos horizontes em todo o lado (1, 5, 10, 20 e 30 anos)."],
    ["Dependências", "Opinião da IA", "Dados objetivos: sobreposição de posições entre ETF e dependências entre países e setores a partir das tabelas TiVA da OCDE."],
    ["Comparação de ETF", "Cores sem regras", "Pontuação com pesos e limites definidos, e símbolos além das cores (acessível a daltónicos)."],
    ["Visão global", "Inexistente", "Património consolidado, perfil do investidor e histórico das avaliações."],
  ], [2, 3, 5]),
);

// 2. Arquitetura
c.push(
  H1("2. Arquitetura proposta"),
  H2("2.1 Plataforma: aplicação web instalável (PWA)"),
  P("**Decisão:** a app é construída como **PWA (Progressive Web App)**, uma aplicação web que se instala no ecrã inicial e funciona como uma app normal: abre em ecrã inteiro, funciona sem internet e guarda os dados no próprio aparelho. É a forma mais simples de correr em **qualquer aparelho** com um só código."),
  Tab(["Vantagem", "Porque importa"], [
    ["Um só código para todos os aparelhos", "Android, iPhone, iPad, Windows, Mac e Linux usam exatamente a mesma app."],
    ["Instalação por link", "O utilizador abre o endereço da app e escolhe \"Adicionar ao ecrã inicial\" (ou \"Instalar\" no computador). Não passa pelas lojas."],
    ["Sem contas de programador nem Mac", "Não é preciso pagar a Google Play nem a App Store, nem ter um Mac para chegar ao iPhone."],
    ["Atualizações imediatas", "Uma nova versão publicada chega a todos os aparelhos na próxima abertura, sem revisão das lojas."],
    ["Custo de alojamento 0 €", "A app é um conjunto de ficheiros estáticos, alojado gratuitamente (GitHub Pages ou Cloudflare Pages)."],
    ["Desenvolvimento e testes simples", "Testa-se no navegador do computador e no telemóvel desde o primeiro dia."],
  ], [3.5, 6.5]),
  Esp(),
  P("**Sem servidor central:** como cada utilizador só trabalha com os seus dados, a app não precisa de servidor próprio nem de contas de utilizador. Os dados ficam no aparelho e, se a pessoa quiser, numa pasta privada do seu próprio Google Drive."),
  P("**Dados públicos que o navegador não pode pedir (decidido na fase 2):** o BCE e o Banco de Portugal aceitam pedidos diretos da app, mas o INE não (restrição técnica chamada CORS). Em vez de um intermediário, a **publicação automática no GitHub vai buscar os dados do INE** em cada publicação e todas as segundas-feiras, e publica-os com a app (ficheiro dados/ine.json, guardado para uso sem internet). Não é precisa nenhuma conta extra e os dados pessoais nunca passam por lá."),
  Esp(),
  Tab(["Componente", "Tecnologia sugerida", "Função"], [
    ["Interface", "TypeScript + React (ou Svelte), com Vite e o plugin PWA", "Ecrãs, formulários e navegação. Adapta-se ao tamanho do ecrã (telemóvel, tablet, computador)."],
    ["Funcionamento sem internet e instalação", "Service worker e manifesto da app (vite-plugin-pwa)", "Guardar a app no aparelho, abrir sem rede, ícone no ecrã inicial."],
    ["Base de dados local", "IndexedDB do navegador, através da biblioteca Dexie", "Imóveis, ETF, carteiras, avaliações, tabelas fiscais e dados de referência em cache."],
    ["Cifragem", "Web Crypto (AES-256-GCM, incluído no navegador), com a chave derivada da palavra-passe por Argon2id (biblioteca hash-wasm)", "Os registos são cifrados antes de serem gravados, e as cópias de segurança também."],
    ["Bloqueio da app", "Chaves de acesso (passkeys / WebAuthn): impressão digital, rosto, Windows Hello", "Desbloquear a app sem escrever a palavra-passe sempre que o aparelho o suporte. Caso contrário, pede a palavra-passe."],
    ["Gráficos", "Apache ECharts ou Chart.js", "Distribuição por setores e países, projeções, evolução do património."],
    ["Mapa e coordenadas", "Leaflet com OpenStreetMap; moradas convertidas em coordenadas pelo serviço público do OpenStreetMap (Nominatim), só quando o utilizador pede", "Marcar o imóvel e os anúncios no mapa, com o preço ou a renda em cada etiqueta, e o raio de pesquisa."],
    ["Conectores de dados", "Módulo próprio, um conector por fonte (com intermediário quando necessário)", "Ir buscar, validar e guardar dados de referência com fonte e data."],
    ["Cópias de segurança", "Ficheiro cifrado; pasta do computador (File System Access API); Google Drive (Google Identity Services, seletor Google Picker, acesso drive.file); Dropbox (API com PKCE, pasta da app)", "Destino escolhido pelo utilizador no primeiro arranque e alterável nas definições (9.3 e 9.4)."],
    ["IA (opcional)", "Duas APIs de IA com plano gratuito: principal Google Gemini, reserva Groq, atrás de uma camada que permite trocar de fornecedor", "Explicar e resumir dados já obtidos. A app funciona sem ela."],
    ["Alojamento", "GitHub Pages ou Cloudflare Pages (gratuito, com HTTPS)", "Endereço público de onde a app é instalada e atualizada."],
  ], [2, 3.5, 3.5]),
  Esp(),
  H3("Cuidados próprios de uma PWA"),
  ...Bs([
    "**iPhone/iPad:** a app tem de ser **instalada no ecrã inicial** (Safari → Partilhar → \"Adicionar ao ecrã principal\"). Se for usada só como site no Safari, o sistema pode apagar os dados ao fim de algum tempo sem utilização. A app deteta quando não está instalada, mostra as instruções e insiste nas cópias de segurança.",
    "**Proteção contra perda de dados:** a app pede ao navegador armazenamento persistente e lembra a exportação da cópia cifrada. Com a cópia automática para o Google Drive (fase 5), o risco desaparece.",
    "**Biometria:** as chaves de acesso funcionam nos telemóveis atuais e no Windows Hello e Touch ID. Em aparelhos mais antigos, a app usa só a palavra-passe.",
  ]),
  H3("Caminho para as lojas, se um dia for preciso"),
  P("O mesmo código pode ser \"embrulhado\" em app nativa com o **Capacitor** e publicado no Google Play e na App Store sem reescrever a app. É também a alternativa se surgir uma limitação do navegador que seja importante. O **Flutter** (proposto na versão anterior) continua a ser uma alternativa válida, mas obriga a compilar uma versão por plataforma, a ter um Mac para o iPhone e a passar pelas lojas."),
  Esp(),
  H2("2.2 Como os dados circulam"),
  N("O utilizador introduz os dados do investimento. Ficam guardados só na base de dados local cifrada.", "num2"),
  N("Quando precisa de dados de referência, a app chama o conector da fonte certa (por exemplo, INE para preços por freguesia). Só envia o mínimo necessário, como o código da freguesia, e nunca dados pessoais.", "num2"),
  N("A resposta é guardada em cache com **fonte, data de referência e data de consulta**. Se não houver internet, usa-se a última cópia guardada, com aviso de que pode estar desatualizada.", "num2"),
  N("Os cálculos são feitos pelo motor de cálculo da app, com fórmulas fixas e tabelas fiscais versionadas.", "num2"),
  N("A IA, se estiver ativa, recebe os dados e os resultados em formato estruturado e devolve um texto explicativo. A app verifica se todos os números do texto existem nos dados enviados. Se não existirem, o texto é rejeitado.", "num2"),
  Esp(),
  H2("2.3 Dados de referência: regras gerais"),
  ...Bs([
    "Cada valor externo mostra um selo do tipo \"Fonte: INE · referente a 2.º trim. 2026 · consultado a 20/10/2026\".",
    "Cada tipo de dado tem um prazo de validade. Por exemplo, a Euribor tem 1 dia e as tabelas fiscais têm 1 ano. Passado esse prazo, o valor aparece a cor de laranja com o aviso \"desatualizado\".",
    "Qualquer valor de referência pode ser substituído à mão pelo utilizador. Fica então marcado como \"valor do utilizador\".",
    "Se uma fonte não devolver dados, a app mostra \"Não encontrado\" e não preenche nada por estimativa.",
  ]),
);

// 3. Fontes de dados
c.push(
  H1("3. Fontes de dados viáveis"),
  P("Esta tabela substitui a ideia de \"a IA pesquisa na internet\" por fontes concretas, indicando como se acede a cada uma e o que fazer quando não há acesso."),
  Tab(["Dado", "Fonte recomendada", "Acesso", "Alternativa / observações"], [
    ["Valor mediano de venda por m² (por freguesia e município)", "INE: indicador 0012234 (últimos 12 meses, novos e existentes)", "API do INE, lida pela publicação automática (o INE não aceita pedidos do navegador)", "Preços de transação reais, mais fiáveis do que os preços pedidos nos anúncios. Publicação trimestral (último: 2.º trimestre de 2026). Zonas com menos de 15 vendas: \"Não encontrado\", passa-se ao município."],
    ["Renda mediana por m² de novos contratos", "INE: indicador 0012598 (últimos 12 meses)", "API do INE, lida pela publicação automática", "Por município e freguesia. O INE não publica valores novos desde o 2.º semestre de 2024: a app mostra-os com o aviso \"desatualizado\"."],
    ["Histórico da mediana de venda da zona", "INE: indicador 0012234, desde o 4.º trimestre de 2019", "Publicado com a app", "Base dos cenários de valorização (5.5). Substitui o Índice de Preços da Habitação, que o INE só publica para o país inteiro."],
    ["Anúncios num raio de 2–3 km (mínimo, máximo e mediana)", "14 plataformas (5.3): pesquisa aberta com um toque, anúncios registados pelo utilizador", "Endereços de pesquisa diretos (Imovirtual, RE/MAX) ou pesquisa no Google limitada ao portal. A app não lê anúncios: os portais não têm acesso aberto e proíbem a recolha automática.", "API do Idealista: pedido de acesso mantém-se. Se for concedido, os anúncios entram automaticamente."],
    ["Euribor (3, 6 e 12 meses)", "Banco Central Europeu (ECB Data Portal)", "API gratuita do BCE, pedido direto da app (média mensal)", "Botão \"Obter do BCE\" no financiamento. O último valor fica guardado e serve sem internet."],
    ["Taxas de juro médias do crédito à habitação", "Banco de Portugal (BPstat): séries 12533730 (taxa variável) e 12533714 (TAEG)", "API do BPstat, pedido direto da app", "Mostradas ao lado da TAN e da TAEG da proposta, com a diferença em pontos. O spread concreto vem da proposta do banco (FINE)."],
    ["Projeções de inflação", "Banco de Portugal (Boletim Económico; outubro de 2026: 3,1%, 2,4%, 2,0%)", "Introdução manual nos parâmetros 2 vezes por ano (não estão no BPstat)", "Atualizam o condomínio, os seguros e a manutenção no payback do arrendamento. Não servem para projetar o valor do imóvel."],
    ["Taxas de IMI por município", "Portal das Finanças", "Tabela anual guardada na app", "Atualizada uma vez por ano."],
    ["Tabelas de IMT, Imposto do Selo, escalões de IRS", "Código do IMT, Código do Imposto do Selo, Código do IRS e OE", "Tabelas guardadas e versionadas na app", "Com indicação do ano em vigor."],
    ["Custos de escritura e registo", "IRN (Casa Pronta) e tabela de notários", "Tabela guardada e editável", "Valores de referência que o utilizador pode alterar."],
    ["Custos de obra", "Tabela própria de custos unitários, que pode partir do Gerador de Preços CYPE (licença) ou de orçamentos reais", "Tabela guardada e editável, com coeficiente regional", "Não existe fonte pública em tempo real. A tabela deve mostrar a data da última revisão."],
    ["Seguros e condomínio", "Utilizador (apólice ou simulação da seguradora, ata do condomínio)", "Introdução manual", "A IA não estima estes valores. Sem valor, o campo fica \"por preencher\"."],
    ["Dados dos ETF (TER, domicílio, política, dimensão, moeda)", "Documentos dos emitentes (factsheet, KID)", "Decidido (0 €): introdução manual com formulário guiado e importação de ficheiros", "Não há API pública gratuita e fiável. A app mostra a data de cada valor e lembra a revisão (por exemplo a cada 6 meses). Uma API paga só entra se esta decisão for revista."],
    ["Rendibilidade histórica, volatilidade e indicadores de avaliação do índice (P/E)", "Ficha do ETF publicada pelo emitente (factsheet)", "Introdução manual ou importação, com data", "Base do critério \"indicadores de valorização\" das sugestões (6.12). São dados históricos, não previsões."],
    ["Composição dos ETF (posições, setores, países)", "Ficheiros de posições que os emitentes publicam (iShares, Vanguard, Xtrackers, Amundi…)", "Importação do ficheiro CSV ou Excel descarregado", "Permite calcular a exposição real e a sobreposição entre ETF."],
    ["Tracking difference", "Cálculo a partir do relatório anual ou do histórico de preços do ETF e do índice", "Introdução manual (valor do relatório anual do emitente)", "Mostrar o período a que se refere."],
    ["Dependências entre países e setores", "OCDE: tabelas TiVA (comércio em valor acrescentado) e tabelas input-output", "Download gratuito, com atualização anual", "Dá às dependências uma base de dados objetiva, em vez da opinião da IA."],
    ["Carteira na corretora", "Ficheiro de exportação da corretora (CSV)", "Importação de ficheiro", "Para não ter de introduzir tudo à mão."],
  ], [2.2, 2.4, 2.2, 3.2]),
);

// 4. Perfil
c.push(
  H1("4. Perfil do investidor (novo)"),
  P("Vários cálculos dependem de dados pessoais que a versão inicial não pedia: IMT Jovem, limite de 50% de taxa de esforço, englobamento no IRS e câmbio. O perfil é preenchido uma vez e fica guardado só no aparelho."),
  Tab(["Campo", "Para que serve"], [
    ["Data de nascimento", "IMT Jovem (até 35 anos), prazo máximo do crédito em função da idade."],
    ["Residência fiscal (Continente, Açores, Madeira)", "Tabelas de IMT e taxas de IRS aplicáveis."],
    ["Rendimento mensal líquido do agregado", "Taxa de esforço (DSTI) do crédito."],
    ["Outras prestações de crédito", "Taxa de esforço total."],
    ["Escalão de IRS / rendimento coletável estimado", "Englobamento de rendas e mais-valias, ganhos de curto prazo."],
    ["Opção de englobamento (sim/não, por categoria)", "Cálculo do imposto sobre rendas e mais-valias."],
    ["Tolerância ao risco (baixa, média, alta)", "Escolher o cenário de projeção por defeito e assinalar carteiras desequilibradas."],
    ["Corretora principal (comissões, câmbio, custódia)", "Custos reais de compra e venda de ETF."],
    ["Moeda de referência", "Euro por defeito. Conversão das posições noutras moedas."],
    ["Alocação-alvo da carteira de ETF (regiões, setores ou % por ETF)", "Base das sugestões de equilíbrio da carteira (6.12). Há modelos prontos."],
  ], [4, 6]),
);

// 5. Imobiliário
c.push(
  H1("5. Área de Imobiliário"),
  P("A área de imobiliário passa a ter **cinco estratégias**, todas construídas sobre um núcleo comum de campos e cálculos. Assim evita-se repetir texto (como aconteceu com os armazéns, que tinham sido copiados da primeira área) e cada estratégia acrescenta só o que lhe é próprio."),
  Tab(["Estratégia", "O que mede", "Métrica principal"], [
    ["1A. Compra para revenda", "Ganho na venda", "Lucro líquido depois de impostos, ROI, TIR"],
    ["1B. Compra para arrendamento", "Rendimento recorrente", "Yield bruta e líquida, cash-flow mensal, payback"],
    ["2. Compra para reconstrução", "Margem depois da obra", "Valor depois da obra menos custo total, ROI"],
    ["3. Cedência de posição", "Ganho na cedência do contrato-promessa", "Ganho líquido, TIR sobre o capital adiantado"],
    ["4. Armazéns", "Arrendamento ou revenda comercial", "Yield líquida, ROI"],
  ], [3, 3, 4]),
  Esp(),

  H2("5.1 Núcleo comum: identificação do imóvel"),
  Tab(["Campo", "Tipo", "Observações"], [
    ["Morada ou ponto no mapa", "Texto / mapa", "Dá as coordenadas GPS, necessárias para o raio de 2–3 km."],
    ["Município e freguesia", "Lista (preenchida pela morada)", "Ligam aos dados do INE e à taxa de IMI."],
    ["Região", "Continente / Açores / Madeira", "Tabela de IMT."],
    ["Destino", "HPP / habitação secundária / arrendamento / comercial ou industrial", "Define o IMT, os limites do crédito e a fiscalidade."],
    ["Tipologia", "T0 … T5+ (não se aplica a armazéns)", "Filtra os comparáveis."],
    ["Área bruta privativa (m²)", "Número", "Cálculos em €/m²."],
    ["Ano de construção e estado", "Número / lista (novo, bom, a recuperar, ruína)", "Ajusta os comparáveis."],
    ["Valor patrimonial tributário (VPT)", "Número (caderneta predial)", "O IMI calcula-se sobre o VPT, não sobre o preço."],
    ["Em ARU?", "Sim / Não / Não sei", "Benefícios fiscais na reabilitação."],
    ["Certificado energético", "Classe", "Informativo e para a revenda."],
    ["Valor de compra", "€", "Base do IMT e do Imposto do Selo."],
  ], [3, 3, 4]),
  Esp(),

  H2("5.2 Núcleo comum: custos de aquisição e impostos"),
  P("O cálculo é feito pelo motor da app com as tabelas fiscais guardadas. A IA pode apenas explicar o resultado (\"porque é que paga este IMT\")."),
  Tab(["Custo", "Como se calcula", "Notas"], [
    ["IMT", "Tabela do art. 17.º do CIMT, conforme o destino e a região. Outros prédios urbanos (armazéns): 6,5%.", "IMT Jovem: isenção total ou parcial para HPP de compradores até 35 anos, dentro dos limites da tabela."],
    ["Imposto do Selo na compra", "0,8% sobre o maior entre o preço e o VPT", "Também abrangido pela isenção jovem nas mesmas condições."],
    ["Imposto do Selo no crédito", "Percentagem sobre o capital, conforme o prazo (0,6% para prazos de 5 anos ou mais), e 4% sobre os juros", "Só quando há financiamento."],
    ["Escritura e registo", "Tabela de referência editável", "Casa Pronta ou notário."],
    ["Avaliação bancária e comissões de processo", "Valor editável", "Da FINE do banco."],
    ["Comissão de mediação (na compra, se houver)", "% editável + IVA", "Normalmente paga pelo vendedor."],
    ["IMI anual", "VPT × taxa do município", "Taxas entre 0,3% e 0,45% para prédios urbanos."],
    ["AIMI", "Quando a soma dos VPT do proprietário passa o limite legal", "Calculado ao nível do património total, não por imóvel."],
  ], [2.5, 4, 3.5]),
  Esp(),

  H2("5.3 Núcleo comum: valores de mercado e comparáveis"),
  P("A pesquisa \"num raio de 2–3 km\" passa a ter três níveis, mostrados sempre por esta ordem:"),
  N("**Dados oficiais do INE:** valor mediano de venda em €/m² e renda mediana em €/m² na freguesia (ou no município, se não houver dados da freguesia). Aplicados à área do imóvel, dão um valor de referência.", "num3"),
  N("**Comparáveis dos portais:** um botão por plataforma abre a pesquisa já preenchida (zona, tipologia, preço e área à volta do valor do imóvel). Quando encontra um anúncio relevante, o utilizador cola o link (a app reconhece o portal) e indica o preço, a área e a tipologia. A app mostra o **mínimo, o máximo e a mediana**, em € e em €/m², por tipologia e por portal, a posição do imóvel e a diferença para o INE.", "num3"),
  N("**API do Idealista (se o acesso for concedido):** os anúncios da mesma tipologia no raio entram automaticamente, sempre com link e data.", "num3"),
  Caixa("Regra \"não inventar\"", [
    "Se nenhum dos três níveis devolver resultados, a app mostra **\"Não encontrado\"** no mínimo, no máximo e na renda média, e não faz estimativas.",
    "Cada valor aparece com a fonte e a data. Os anúncios ficam identificados como \"preço pedido\" e os dados do INE como \"preço de transação\".",
  ], VERDE_CL),
  Esp(),

  Tab(["Operação", "Plataformas (decididas na fase 2)"], [
    ["Venda", "Idealista, Imovirtual, SUPERCASA, Casa Sapo, RE/MAX, Century 21, ERA e e-Leilões"],
    ["Arrendamento", "As anteriores (exceto e-Leilões) e OLX, CustoJusto, Uniplaces, HousingAnywhere, BQuarto e Roomgo"],
  ], [2.5, 7.5]),
  Esp(),
  ...Bs([
    "**Grupos à parte:** os leilões (e-Leilões), o arrendamento temporário (Uniplaces, HousingAnywhere) e os quartos (BQuarto, Roomgo) medem mercados diferentes. Aparecem separados e não entram nas medianas principais.",
    "**Mapa:** o imóvel tem um marcador próprio e cada anúncio uma etiqueta com o **preço** (venda) ou a **renda por mês** (arrendamento). Raio de 1, 2, 3 ou 5 km, com a opção de comparar só os anúncios dentro dele. As posições vêm da morada (OpenStreetMap) ou de um toque no mapa.",
    "**Pesquisa:** nos portais em que foi possível confirmar o formato do endereço (Imovirtual e RE/MAX), a pesquisa abre diretamente com os filtros; nos outros, abre uma pesquisa no Google limitada a esse portal, que funciona sempre. Nas uniões de freguesias, a pesquisa direta fica ao nível do concelho.",
  ]),
  H2("5.4 Núcleo comum: financiamento"),
  P("Pergunta \"O investimento é financiado?\". Se a resposta for sim, abrem-se estes campos:"),
  Tab(["Campo", "Origem do valor"], [
    ["Montante a financiar", "Utilizador"],
    ["Prazo (anos)", "Utilizador, validado em função da idade"],
    ["Tipo de taxa: variável, fixa ou mista", "Utilizador"],
    ["Indexante: Euribor a 3, 6 ou 12 meses", "Utilizador. O valor atual vem do conector BCE/EMMI."],
    ["Spread / TAN fixa", "Proposta do banco (FINE). Como referência, a app mostra a taxa média de mercado do Banco de Portugal."],
    ["Seguros de vida e multirriscos exigidos pelo banco", "Utilizador"],
    ["Comissões (abertura, processamento mensal)", "Utilizador"],
  ], [5, 5]),
  Esp(),
  P("**Resultados:** prestação mensal (método francês), TAN, TAEG aproximada, montante total imputado ao consumidor (MTIC), plano de pagamentos e a prestação com a Euribor 1, 2 e 3 pontos acima da atual (teste de stress)."),
  P("**Validações (limites macroprudenciais do Banco de Portugal, guardados como parâmetros editáveis):**"),
  ...Bs([
    "LTV (empréstimo face ao valor do imóvel): até 90% na habitação própria permanente e até 80% nos outros destinos.",
    "DSTI (taxa de esforço): todas as prestações não podem passar de 50% do rendimento líquido, calculadas com o choque de taxa de juro definido pelo Banco de Portugal.",
    "Prazo máximo de 40 anos, menor com a idade (por exemplo 37 anos dos 30 aos 35 anos de idade e 35 anos acima dos 35).",
    "Se algum limite for ultrapassado, a app mostra um aviso vermelho (\"Dificilmente aprovado por um banco\") e explica qual o limite em causa.",
  ]),
  P("**Armazéns:** o crédito é comercial e não à habitação. A distinção entre HPP e secundária não existe, os limites acima não se aplicam e o spread é sempre introduzido pelo utilizador."),
  Esp(),

  H2("5.5 Núcleo comum: projeção do valor a 1, 2 e 3 anos"),
  P("Nenhuma entidade oficial publica uma previsão do preço das casas. A app passa por isso a apresentar **cenários com base no histórico da mediana de venda do INE** na freguesia do imóvel (ou no município, se a freguesia não tiver 5 anos de dados). Cada variação anual compara um trimestre com o mesmo trimestre do ano anterior. Os cenários têm nomes que dizem o que são, porque a média de 3 anos pode ser mais baixa do que a de 5 quando o mercado abranda:"),
  Tab(["Cenário", "Taxa anual usada", "Exemplo de leitura"], [
    ["Repetir o pior ano recente", "Pior variação anual dos últimos 5 anos, ou 0% se todas forem positivas", "\"Se o mercado repetir o pior ano recente…\""],
    ["Manter a média de 5 anos", "Média anual dos últimos 5 anos", "\"Se o mercado mantiver a média de 5 anos…\""],
    ["Manter a média de 3 anos", "Média dos últimos 3 anos", "\"Se o mercado mantiver a média de 3 anos…\""],
  ], [2, 4, 4]),
  P("O ecrã mostra o aviso **\"Projeção com base em dados históricos, não é uma previsão\"**. As projeções de inflação do Banco de Portugal entram apenas para atualizar custos ao longo do tempo (condomínio, seguros, manutenção)."),

  H2("5.6 Estratégia 1A: compra para revenda"),
  Tab(["Campos próprios", "Cálculos"], [
    ["Preço de venda esperado\nPrazo até à venda (meses)\nCustos de detenção (IMI, condomínio, seguros, juros)\nComissão de venda (% + IVA)\nPequenas obras de valorização",
     "Custo total = compra + aquisição + detenção + obras + venda\nMais-valia fiscal com coeficiente de desvalorização monetária (se mais de 24 meses)\nIRS: 50% do ganho é englobado (residentes)\nLucro líquido, ROI, TIR e lucro por mês de capital investido\nPreço mínimo de venda para não ter prejuízo"],
  ], [5, 5]),
  Esp(),

  H2("5.7 Estratégia 1B: compra para arrendamento"),
  Tab(["Campos próprios", "Cálculos"], [
    ["Renda mensal esperada (com a renda mediana INE e a dos comparáveis como referência)\nMeses sem inquilino por ano\nManutenção anual (% do valor ou €)\nGestão de arrendamento (%)\nDuração do contrato\nCondomínio, seguro (multirriscos e, opcionalmente, renda)",
     "Yield bruta = renda anual ÷ preço de compra\nYield líquida = (renda anual efetiva − custos − IMI) ÷ (preço + custos de aquisição)\nCash-flow mensal = renda − prestação − custos − imposto\nIRS das rendas: taxa autónoma (geral de 25%, reduzida em contratos longos) ou englobamento, conforme o perfil\nPayback e ROI sobre o capital próprio"],
  ], [5, 5]),
  Esp(),

  H2("5.8 Estratégia 2: compra para reconstrução"),
  P("Pergunta: \"Tem áreas para reconstruir?\". A resposta escolhe um de dois modos, que se excluem um ao outro, para evitar contar a mesma obra duas vezes:"),
  ...Bs([
    "**Obra integral:** custo em €/m² de área bruta × área total, conforme o nível de acabamento (básico, médio, alto).",
    "**Obra por zonas:** lista de trabalhos, cada um medido na unidade certa.",
  ]),
  Tab(["Trabalho", "Unidade", "Observação"], [
    ["Cozinha", "m² + equipamento (vg)", "Móveis e eletrodomésticos como valor global"],
    ["Casa de banho", "unidade (por WC)", "Inclui louças, revestimentos, canalização local"],
    ["Quartos e salas", "m² de pavimento", "Pavimento, rebocos, tetos"],
    ["Pintura", "m² de parede/teto", "Pode ser calculado a partir da área do pavimento"],
    ["Pavimentos", "m²", ""],
    ["Instalação elétrica", "pontos (tomadas e interruptores) + quadro (vg)", "Ou valor global por tipologia"],
    ["Canalização", "pontos de água + valor global", ""],
    ["Caixilharia", "m² de vão ou unidade", ""],
    ["Cobertura e fachada", "m²", ""],
    ["Climatização / AQS", "unidade", ""],
  ], [3, 3, 4]),
  Esp(),
  P("**Fonte dos custos:** uma tabela de custos unitários guardada na app e editável pelo utilizador. Os valores iniciais podem vir do Gerador de Preços CYPE ou de orçamentos reais, e um **coeficiente regional** ajusta-os à localização. A tabela mostra a data da última revisão. Não existe um \"algoritmo\" público com preços de obra em tempo real."),
  P("**Campos e cálculos adicionais:**"),
  ...Bs([
    "Projeto e licenciamento (arquitetura, especialidades, taxas municipais).",
    "Prazo da obra (meses), que serve para calcular os custos de detenção: juros, IMI, seguros.",
    "Margem de imprevistos (por defeito 10–15%, editável).",
    "**Valor depois da obra:** mediana do INE em €/m² × área, ajustada pelo estado \"novo/renovado\", ou comparáveis de imóveis renovados.",
    "**Benefícios de ARU**, quando o imóvel está numa ARU: IVA a 6% nas empreitadas de reabilitação e possíveis isenções de IMI e IMT. Dependem de requisitos e de certificação municipal, por isso a app apresenta-os como \"a confirmar com a câmara\".",
    "**Resultado:** lista de custos por trabalho, total da obra, custo global (imóvel + aquisição + obra + detenção + venda), margem, ROI e TIR. Depois segue para revenda (1A) ou arrendamento (1B).",
  ]),

  H2("5.9 Estratégia 3: compra para cedência de posição"),
  Tab(["Campos próprios", "Cálculos e alertas"], [
    ["Preço do imóvel no contrato-promessa (CPCV)\nSinal e calendário dos reforços (tabela de datas e valores)\nData prevista da escritura\nValor esperado da cedência da posição\nData prevista da cedência\nPromotor (nome, licença de construção, garantia do sinal)",
     "Capital adiantado ao longo do tempo\nGanho = valor da cedência − valores pagos − custos\nFiscalidade própria: o ganho é tributado em IRS e a cedência pode estar sujeita a IMT, conforme o valor pago\nTIR sobre o capital adiantado\nComparáveis: só imóveis de construção nova da mesma tipologia\nLista de verificação do risco do promotor (licença, garantia bancária do sinal, histórico, atrasos)"],
  ], [5, 5]),
  Esp(),

  H2("5.10 Estratégia 4: armazéns"),
  P("Texto próprio, já sem as partes copiadas da área residencial:"),
  ...Bs([
    "**Campos:** área (m²), área de logradouro, pé-direito, tipo (logística, industrial, comercial), acessos para pesados, licença de utilização, estado.",
    "**Sem tipologia T1/T2.** Os comparáveis filtram-se por tipo e por intervalo de área.",
    "**IMT de 6,5%** e Imposto do Selo de 0,8%. Possibilidade de renúncia à isenção de IVA na compra ou no arrendamento a empresas, assinalada como \"a validar com contabilista\".",
    "**Seguro multirriscos comercial ou industrial**, introduzido pelo utilizador. O **condomínio é opcional** (só em parques empresariais).",
    "**Crédito comercial** (ver 5.4).",
    "**Arrendamento:** renda em €/m², com as mesmas métricas da estratégia 1B. As fontes oficiais de rendas comerciais são poucas, por isso os comparáveis são sobretudo introduzidos pelo utilizador.",
  ]),

  H2("5.11 Carteira imobiliária e histórico"),
  ...Bs([
    "Estados possíveis de cada imóvel: **em análise, comprado, em obra, arrendado, à venda, vendido**.",
    "Para cada imóvel em carteira: valor de compra, custo total investido, valor atual, mais-valia ou menos-valia latente (€ e %), dívida em curso e capital próprio.",
    "Botão **\"Reavaliar\"**: atualiza os dados do INE e os comparáveis, recalcula o valor de venda e a renda de mercado, e grava uma nova linha no **histórico de avaliações** (data, fonte, método, valor).",
    "Gráfico da evolução do valor de cada imóvel e da carteira imobiliária total.",
    "Histórico dos imóveis vendidos com o resultado final realizado (lucro, ROI, TIR, impostos pagos).",
  ]),
);

// 6. ETF
c.push(
  H1("6. Área de ETF"),
  H2("6.1 Fluxo de utilização (ordem corrigida)"),
  P("A comparação com a carteira só é feita **se já existir carteira**. Quem está a começar salta o primeiro passo, e as análises que dependem da carteira (sobreposição, efeito no equilíbrio geográfico e setorial) não aparecem. A ordem passa a ser esta:"),
  N("**Carteira atual (opcional):** importação do ficheiro da corretora ou introdução manual (ISIN, quantidade, preço médio, data). Se não houver carteira, este passo é saltado.", "num4"),
  N("**Valor a investir:** montante único e, opcionalmente, um reforço mensal.", "num4"),
  N("**Escolha do universo:** por setor de atividade, por índice (por exemplo S&P 500, MSCI World), por região ou por ETF concreto (ISIN).", "num4"),
  N("**Propostas e escolha:** a IA apresenta propostas de ETF que cumprem os filtros (6.12). O utilizador **escolhe dessas propostas** e **atribui um valor a cada escolha**. Só as escolhas são guardadas; as propostas não escolhidas não ficam registadas.", "num4"),
  N("**Distribuição do valor:** o valor atribuído a cada ETF escolhido (em € ou %), que soma o valor a investir.", "num4"),
  N("**Análise:** exposição por setores e países, custos, projeções, impostos e comparação. A sobreposição e o efeito na carteira atual só aparecem quando existe carteira.", "num4"),
  N("**Registar a compra:** quando o utilizador confirma que comprou, os ETF e os valores passam para a **carteira** (ver 6.11).", "num4"),
  Esp(),
  Caixa("Requisito clarificado (antes: frase incompleta)", [
    "\"Quando escolhemos e adicionamos o valor a esses ETF como compra, deve guardar na carteira. A IA vai sugerindo a aquisição de ETF, tanto pelo equilíbrio da carteira como por setores interdependentes, e que justificam o investimento pela possível valorização.\"",
    "Solução: **registo de compras na carteira** (6.11) e **propostas de aquisição** apresentadas pela IA com base em regras e dados objetivos (6.12).",
    "Decisão (versão 6): a IA avança com propostas, o utilizador escolhe dessas propostas e atribui um valor a cada escolha. **Só os ETF escolhidos são guardados.**",
  ], VERDE_CL),
  Esp(),

  H2("6.2 Catálogo de ETF"),
  P("Catálogo pessoal guardado na app. Cada ETF tem: ISIN, nome, emitente, índice replicado, TER, tracking difference (com o período), domicílio, política (acumulação ou distribuição), dimensão do fundo, moeda do fundo e de negociação, método de replicação, bolsa, data da última atualização e fonte."),
  P("**Filtro UCITS/PRIIPs:** só entram ETF com KID disponível para investidores de retalho na UE. Os ETF domiciliados nos EUA ficam excluídos e, se o utilizador tentar adicionar um, a app explica porquê."),

  H2("6.3 \"ETF interligados\" e dependências: abordagem com dados"),
  P("A ideia de a IA indicar \"ETF interligados\" e \"zonas do globo dependentes\" é substituída por três análises baseadas em dados:"),
  Tab(["Análise", "Como se calcula", "Fonte"], [
    ["Sobreposição de posições entre ETF", "Soma, para cada empresa, do menor peso em cada par de ETF. Mostra-se como % e com as 10 maiores posições em comum.", "Ficheiros de posições dos emitentes"],
    ["Exposição real por setor e país", "Soma ponderada das posições de todos os ETF da carteira", "Ficheiros de posições dos emitentes"],
    ["Dependências entre países", "Peso do valor acrescentado estrangeiro nas exportações de cada país e principais países de origem", "OCDE TiVA"],
    ["Dependências entre setores (ex.: sistemas digitais → energia elétrica)", "Peso de cada setor fornecedor nos consumos intermédios de cada setor", "OCDE, tabelas input-output"],
  ], [3, 4.5, 2.5]),
  P("A IA pode depois **explicar** estes resultados (\"a sua carteira está 40% exposta à tecnologia, que depende sobretudo de…\"), mas usando só estes dados e citando a fonte."),

  H2("6.4 Projeção de juros compostos"),
  ...Bs([
    "**Horizontes iguais em todo o lado:** 1, 5, 10, 20 e 30 anos (projeção, impostos e gráficos).",
    "**Simulação de ganhos em quatro cenários (decidido): 4%, 6%, 8% e 10% ao ano.** A app mostra sempre os quatro lado a lado (tabela e gráfico), para cada horizonte e para o valor investido. As taxas podem ser editadas.",
    "**Taxa líquida:** a app subtrai o TER ponderado da carteira antes de projetar.",
    "**Valores nominais e reais:** os reais são descontados da inflação (por defeito 2%, editável).",
    "Reforço mensal opcional.",
    "Fórmula: VF = C × (1 + r)ⁿ + PMT × [((1 + r_m)^(12n) − 1) ÷ r_m], com r = taxa anual líquida e r_m = taxa mensal equivalente.",
  ]),

  H2("6.5 Custos da carteira"),
  Tab(["Custo", "Apresentação"], [
    ["TER", "Por ETF: % ao ano e € ao ano sobre o valor investido. Total da carteira: TER ponderado (%) e € ao ano. Custo acumulado a 1, 5, 10, 20 e 30 anos."],
    ["Comissão de compra/venda", "Da tabela da corretora definida no perfil."],
    ["Câmbio", "Quando a moeda de negociação não é o euro: % da corretora."],
    ["Spread (bid/ask)", "Valor introduzido ou estimado pela categoria de liquidez. Mostrado como custo de entrada e saída."],
  ], [3, 7]),

  H2("6.6 Impostos"),
  ...Bs([
    "Em Portugal, nos ETF de **acumulação** o imposto só se paga **na venda**. A app pergunta por isso **\"Em que ano pensa vender?\"** e calcula o imposto num cenário de venda total ou parcial em cada horizonte (1, 5, 10, 20 e 30 anos).",
    "**Mais-valias:** taxa liberatória de 28% ou englobamento, conforme o perfil. Ganhos detidos menos de 365 dias são obrigatoriamente englobados quando o rendimento coletável chega ao último escalão.",
    "**ETF de distribuição:** os dividendos são tributados a 28% (ou por englobamento) todos os anos. A projeção desconta esse imposto.",
    "**Domicílio (Irlanda, Luxemburgo):** influencia a retenção sobre dividendos dentro do fundo, que aparece como informação e não como imposto pago pelo investidor.",
    "O imposto depende sobretudo da situação do investidor e muito pouco do ETF, e a app explica isso na zona de dúvidas.",
  ]),

  H2("6.7 Mercado em queda: simulador em vez de estratégia"),
  P("Uma \"estratégia para poupar impostos\" é aconselhamento fiscal personalizado. Fica no seu lugar um **simulador educativo**:"),
  ...Bs([
    "Mostra as menos-valias latentes de cada posição.",
    "Simula o efeito de realizar uma menos-valia: compensação com mais-valias do mesmo ano e reporte de prejuízos para os anos seguintes (só com opção de englobamento), segundo as regras do IRS guardadas na app.",
    "Mostra a regra de rebalanceamento definida pelo utilizador (por exemplo, \"reforçar quando um ETF cai mais de X% abaixo do peso-alvo\").",
    "Aviso fixo: \"Simulação informativa. Não é aconselhamento fiscal nem de investimento. Confirme com um contabilista certificado.\"",
  ]),

  H2("6.8 Comparador de 2 ou 3 ETF"),
  P("**Algoritmo de pontuação (0 a 100), com pesos editáveis:**"),
  Tab(["Critério", "Peso por defeito", "Regra (melhor → pior)"], [
    ["TER", "25%", "Mais baixo é melhor"],
    ["Tracking difference", "20%", "Mais próxima de zero (ou positiva) é melhor"],
    ["Dimensão do fundo", "15%", "Verde: mais de 1 000 M€ · Amarelo: 100 a 1 000 M€ · Vermelho: menos de 100 M€"],
    ["Liquidez / spread", "15%", "Spread mais baixo é melhor"],
    ["Custos de transação e fiscalidade", "15%", "Menor carga total (comissão, câmbio e retenção na fonte dentro do fundo) é melhor"],
    ["Política e moeda", "10%", "Conforme a preferência do perfil (por exemplo acumulação, em EUR)"],
    ["Índice e domicílio", "informativo", "Aparecem lado a lado, sem pontuação"],
  ], [3, 2, 5]),
  Esp(),
  ...Bs([
    "Cada critério é normalizado entre os ETF comparados (o melhor fica com 100 e o pior com 0). Com três ETF, o do meio fica com um valor proporcional.",
    "**Cores:** verde (≥ 67), amarelo (34–66), vermelho (≤ 33), sempre acompanhadas de **símbolos** (▲ melhor, ● intermédio, ▼ pior) e do valor numérico, para serem legíveis por daltónicos.",
    "A **pontuação global** é a média ponderada. O ETF com a melhor pontuação recebe o fundo verde e o pior o fundo vermelho.",
    "**Texto de justificação:** gerado pela IA (ou por um modelo de texto fixo, se a IA estiver desligada) só a partir da tabela de pontuação. Se já existir carteira, inclui o efeito de cada candidato nela: sobreposição, equilíbrio geográfico e setorial.",
  ]),

  H2("6.9 Painel da carteira de ETF"),
  ...Bs([
    "Valor investido e valor atual de cada ETF, ganho ou perda latente.",
    "Gráfico por **setores de atividade**.",
    "Gráfico por **países e regiões**: EUA, Europa, Ásia-Pacífico, mercados desenvolvidos e emergentes.",
    "Gráfico **carteira atual vs projeção**, com seletor de horizonte (5 anos por defeito, também 1, 10, 20 e 30) e com os quatro cenários.",
    "Alertas de concentração, por exemplo \"mais de 60% num só país\" ou \"sobreposição acima de 50% entre dois ETF\".",
  ]),

  H2("6.10 Zona de dúvidas"),
  P("Glossário fixo, revisto, que funciona sem internet. A IA, se estiver ativa, pode responder a perguntas adicionais usando só este conteúdo como base."),
  ...Bs([
    "O que é o spread (bid/ask)?",
    "Câmbio e comissões de compra: o que pago e a quem?",
    "Que impostos pago na venda de um ETF e nos dividendos?",
    "O que é a tracking difference (e a diferença para o tracking error)?",
    "O que é o TER e como afeta o resultado a longo prazo?",
    "Acumulação ou distribuição?",
    "Porque é que o domicílio do ETF importa (Irlanda vs Luxemburgo vs EUA)?",
    "O que são as regras UCITS e o documento KID?",
  ]),

  H2("6.11 Registo de compras e carteira"),
  P("Depois de distribuir o valor pelos ETF escolhidos, o botão **\"Registar compra\"** guarda a operação na carteira. A app **não liga à corretora nem dá ordens**: regista o que o utilizador comprou na corretora."),
  Tab(["Campo do movimento", "Observações"], [
    ["ETF (ISIN)", "Vem da seleção."],
    ["Data da compra", "Por defeito, hoje."],
    ["Valor investido", "Vem da distribuição, editável."],
    ["Preço por unidade e quantidade", "Quantidade = valor ÷ preço (inteira ou fracionada, conforme a corretora)."],
    ["Comissão e câmbio", "Pré-preenchidos com as condições da corretora do perfil."],
    ["Corretora", "Do perfil, editável."],
    ["Origem", "\"Proposta da IA\" ou \"Escolha própria\"."],
  ], [3.5, 6.5]),
  Esp(),
  ...Bs([
    "A carteira é calculada a partir dos movimentos: compras, vendas e dividendos recebidos. Assim tem-se o histórico completo e o valor investido em cada ETF.",
    "Para os impostos, as vendas usam o método **FIFO** (as primeiras unidades compradas são as primeiras vendidas), como determina a lei fiscal portuguesa. O preço médio aparece só como informação.",
    "Também é possível registar compras feitas fora deste fluxo (introdução manual ou importação do ficheiro da corretora).",
  ]),

  H2("6.12 Sugestões de aquisição"),
  P("A IA vai propondo ETF para comprar segundo três critérios: **equilíbrio da carteira**, **setores interdependentes** e **indicadores de valorização**. Para cumprir a regra \"não inventar\", a IA trabalha **sobre os candidatos e os dados calculados pelo motor da app** e só propõe ETF com dados verificados. O utilizador escolhe das propostas e atribui um valor a cada escolha; só as escolhas são guardadas."),
  H3("Critério 1: equilíbrio da carteira"),
  ...Bs([
    "O utilizador define uma **alocação-alvo** no perfil: por regiões (por exemplo EUA 55%, Europa 25%, Ásia-Pacífico 10%, emergentes 10%), por setores, ou por ETF. Há modelos prontos para começar, como \"global por capitalização\" ou \"global com mais Europa\".",
    "A app calcula os **desvios** da carteira atual (com a exposição real, a partir das posições dos ETF) em relação ao alvo.",
    "Com o valor a investir, propõe a distribuição que **mais aproxima a carteira do alvo sem vender nada** (rebalanceamento por reforço).",
  ]),
  H3("Critério 2: setores interdependentes"),
  ...Bs([
    "Para os setores com mais peso na carteira, a app consulta as **tabelas input-output da OCDE** e identifica os setores fornecedores de que mais dependem. Por exemplo, os serviços digitais dependem de eletricidade, semicondutores e telecomunicações.",
    "Se esses setores fornecedores tiverem pouco peso na carteira, a app sugere ETF do catálogo que os cubram, mostrando a dependência em números (por exemplo \"X% dos consumos intermédios do setor A vêm do setor B\", fonte OCDE, ano).",
  ]),
  H3("Critério 3: indicadores de valorização (sem previsões)"),
  P("Ninguém consegue prever a valorização futura, e uma IA que o tentasse estaria a inventar. Em vez disso, a app mostra **indicadores objetivos** que ajudam a avaliar o potencial, sempre com fonte e data:"),
  ...Bs([
    "Rendibilidade histórica do índice a 1, 3, 5 e 10 anos.",
    "Volatilidade e maior queda histórica (risco).",
    "Indicadores de avaliação do índice publicados pelo emitente na ficha do ETF, como o rácio preço/lucro (P/E), comparados com a média histórica do próprio índice (\"mais barato\" ou \"mais caro do que o habitual\").",
    "Rótulo fixo: \"Indicadores históricos. Não garantem resultados futuros.\"",
  ]),
  H3("Como a sugestão é construída e apresentada"),
  ...Bs([
    "**Universo:** só ETF do catálogo (UCITS, com dados verificados). A IA pode propor **ideias** fora do catálogo, por exemplo \"um ETF de utilities europeias\". Essas ideias aparecem como \"por verificar\" e só entram como sugestão depois de o utilizador adicionar o ISIN com os dados do KID ou da ficha do emitente. Isto impede ETF ou dados inventados.",
    "**Pontuação de cada candidato**, com pesos editáveis: redução do desvio à alocação-alvo, cobertura de dependências, custos (pontuação do comparador, 6.8), indicadores de valorização e sobreposição com a carteira atual (penaliza duplicações).",
    "**Apresentação:** sempre 2 ou 3 alternativas, ordenadas pela pontuação, cada uma com o \"porquê\" em números e fontes. O texto é escrito pela IA (ou por um modelo fixo) e validado como em 8.2.",
    "**Linguagem:** \"Candidatos que se ajustam aos critérios que definiu\", nunca \"compre\". A decisão é sempre do utilizador.",
    "**Quando aparecem:** ao introduzir um novo valor a investir, quando um desvio ao alvo passa um limite definido (por exemplo 5 pontos percentuais), e num resumo mensal opcional.",
    "**Desligável:** as sugestões podem ser desligadas nas definições (ver ponto 10).",
  ]),
);

// 7. Património
c.push(
  H1("7. Património consolidado (novo)"),
  ...Bs([
    "Valor total do património: imóveis (valor atual), ETF (valor atual) e liquidez (introduzida pelo utilizador).",
    "Dívida total (créditos em curso) e **património líquido**.",
    "Distribuição entre imobiliário, ETF e liquidez, em gráfico circular.",
    "Evolução mensal do património (a partir do histórico de avaliações e cotações).",
    "Rendimento passivo mensal: rendas líquidas e dividendos.",
    "Resumo fiscal anual estimado: IMI, AIMI, IRS de rendas, mais-valias realizadas.",
  ]),
);

// 8. IA
c.push(
  H1("8. Papel da IA e regras para não inventar"),
  H2("8.1 O que a IA faz e o que não faz"),
  Tab(["A IA faz", "A IA não faz"], [
    ["Explica em linguagem simples os resultados já calculados\nResume dados obtidos das fontes, citando fonte e data\nEscreve a justificação da comparação de ETF\nExplica o porquê de cada sugestão de aquisição gerada pelo motor da app (6.12)\nPropõe ideias de ETF fora do catálogo, marcadas \"por verificar\"\nResponde a dúvidas com base no glossário",
     "Calcula impostos, prestações ou rentabilidades\nPesquisa ou \"descobre\" preços, taxas ou valores\nPreenche campos sem fonte\nPrevê ou garante valorizações futuras\nInventa ETF ou dados de ETF\nDecide compras: a decisão é sempre do utilizador"],
  ], [5, 5]),
  Esp(),
  H2("8.2 Mecanismo de controlo"),
  N("A app envia à IA um pacote estruturado (JSON) só com os dados necessários, cada um com fonte e data, e sem nome, morada exata ou outros dados pessoais (por exemplo, envia a freguesia e não a morada).", "num5"),
  N("A instrução para a IA é fixa: usar apenas os dados enviados, citar a fonte de cada número e responder \"Não encontrado\" quando faltar informação.", "num5"),
  N("**Validação automática:** a app extrai todos os números do texto devolvido e confirma que existem nos dados enviados (com tolerância de arredondamento). Se algum não existir, o texto é rejeitado e aparece \"Explicação indisponível\".", "num5"),
  N("A IA é **opcional** e pode ser desligada. A app continua a funcionar, com textos explicativos de modelo fixo.", "num5"),
  Esp(),
  H2("8.3 Solução decidida: IA na nuvem com plano gratuito"),
  P("**Decisão:** usar um serviço de IA com plano gratuito, sempre opcional. Como a app é distribuída e não tem servidor próprio, **cada utilizador cria a sua própria chave gratuita** e introdu-la nas definições da app. Assim o criador da app não paga a utilização dos outros e não há limites partilhados."),
  Tab(["Opção gratuita", "Como funciona", "Limitações"], [
    ["Google Gemini (Google AI Studio)", "Chave gratuita criada com uma conta Google. Boa qualidade em português.", "Limites de pedidos por minuto e por dia. No plano gratuito a Google pode usar o conteúdo enviado para melhorar os seus produtos."],
    ["Outros fornecedores com plano gratuito (por exemplo Groq, OpenRouter com modelos gratuitos, Mistral)", "Chave gratuita, API semelhante.", "Modelos e limites mudam com frequência. A qualidade em português e em fiscalidade portuguesa varia."],
    ["IA local no computador (por exemplo Ollama)", "Totalmente gratuita e nada sai do aparelho.", "Só no computador (não no telemóvel), precisa de um computador potente e a qualidade é inferior."],
    ["Sem IA", "Textos explicativos de modelo fixo.", "Explicações menos flexíveis."],
  ], [2.8, 3.4, 3.8]),
  Esp(),
  P("**Como fica na app:**"),
  ...Bs([
    "**Dois fornecedores gratuitos, em cadeia:** principal **Google Gemini** e reserva **Groq** (também com plano gratuito e modelos abertos de boa qualidade). Quando o principal esgota o limite gratuito (erro de quota), não responde ou dá erro, a app passa automaticamente para a reserva. No dia seguinte, ou quando o limite do principal for reposto, volta a usar o principal.",
    "**Configuração:** no assistente de IA das definições, a app pede as duas chaves gratuitas, com um guia de 3 passos para cada uma. A chave de reserva é opcional, mas recomendada. A ordem dos fornecedores pode ser trocada.",
    "**Transparência:** cada explicação indica que IA a escreveu (por exemplo \"Explicação: Gemini\" ou \"Explicação: Groq (reserva)\"). Nas definições aparece o estado de cada uma: ativa, limite atingido (com hora prevista de reposição) ou sem chave.",
    "**Mesmas regras para as duas:** o mesmo pacote de dados, sem dados pessoais, e a mesma validação dos números (8.2). Se a resposta da reserva for rejeitada pela validação, vale o texto de modelo fixo.",
    "**Camada de abstração:** o código fala com uma interface única (\"serviço de explicação\"), para que trocar de fornecedor seja só uma opção nas definições. Isto protege a app de mudanças nos planos gratuitos.",
    "**Privacidade:** como no plano gratuito o conteúdo pode ser usado pelo fornecedor, a app **nunca envia dados pessoais** (nome, morada exata, rendimento, valores da carteira identificáveis). Envia só os dados de referência e os resultados do cálculo, como se descreve em 8.2.",
    "**Limites:** se as duas IA tiverem o limite gratuito esgotado, a app mostra o texto de modelo fixo e a mensagem \"IA indisponível de momento\", e o resto continua a funcionar.",
    "**Condições a confirmar antes da fase 4:** os planos gratuitos mudam. Os limites e os termos de utilização devem ser revistos no momento da implementação.",
  ]),
  P("Numa fase posterior pode haver pesquisa assistida com citações (por exemplo, encontrar anúncios recentes com link). Os resultados ficam marcados como \"indicativos\" e o utilizador tem de os confirmar antes de entrarem como comparáveis."),
);

// 9. Segurança
c.push(
  H1("9. Segurança, local das cópias e vários aparelhos"),
  H2("9.1 Proteção no aparelho"),
  ...Bs([
    "Dados cifrados com AES-256-GCM (Web Crypto, incluído no navegador) antes de serem gravados no IndexedDB.",
    "Chave derivada de uma palavra-passe do utilizador com Argon2id. A palavra-passe nunca é guardada.",
    "Desbloqueio biométrico (impressão digital, rosto, Windows Hello, Touch ID) com chaves de acesso (passkeys/WebAuthn). Nos aparelhos que suportam a extensão PRF, a chave de acesso liberta a chave dos dados sem escrever a palavra-passe. Nos outros, a palavra-passe é pedida ao abrir.",
    "Bloqueio automático depois de X minutos sem utilização. A chave só existe na memória enquanto a app está desbloqueada.",
    "App servida só por HTTPS, com política de segurança de conteúdo (CSP) restrita, para impedir código de terceiros.",
  ]),
  H2("9.2 Onde ficam os dados"),
  P("Os dados com que a app trabalha ficam **sempre no aparelho**, cifrados, para a app funcionar depressa e sem internet. O local que o utilizador escolhe é para onde vão as **cópias**, feitas automaticamente. É a partir dessas cópias que se recuperam os dados noutro aparelho ou depois de perder o telemóvel."),
  Esp(),
  H2("9.3 Escolha do local no primeiro arranque"),
  P("Na primeira vez que a app abre, o assistente inicial tem estes passos:"),
  N("**Boas-vindas:** \"Começar do zero\" ou \"Já tenho dados: restaurar uma cópia\".", "num6"),
  N("**Palavra-passe** e **chave de recuperação** (para imprimir ou escrever em papel).", "num6"),
  N("**\"Onde quer guardar as cópias dos seus dados?\"**, com as opções da tabela seguinte. Pode escolher-se um destino automático e manter sempre a possibilidade de descarregar cópias manuais.", "num6"),
  N("**Ligação ao destino escolhido:** início de sessão na conta (Google Drive ou Dropbox) ou escolha da pasta (computador). A app faz logo a primeira cópia e confirma que correu bem.", "num6"),
  N("**Resumo:** \"As cópias dos seus dados estão a ser guardadas em: …\".", "num6"),
  Esp(),
  Tab(["Opção", "Como se liga", "Onde ficam as cópias", "Automático?"], [
    ["**Google Drive**", "Botão \"Ligar Google Drive\": início de sessão na conta Google e escolha (ou criação) de uma pasta no seletor oficial da Google", "Na pasta escolhida, por exemplo \"O meu Drive / Investimentos / Cópias\"", "Sim, em todos os aparelhos"],
    ["**Dropbox**", "Botão \"Ligar Dropbox\": início de sessão na conta Dropbox", "Na pasta própria da app: \"Aplicações / <nome da app>\"", "Sim, em todos os aparelhos"],
    ["**Pasta no computador**", "Botão \"Escolher pasta\": o utilizador escolhe uma pasta do computador (pode ser uma pasta sincronizada pelo OneDrive, Google Drive ou Dropbox para computador)", "Na pasta escolhida", "Sim, no Chrome e no Edge do computador. No Safari e no Firefox, a cópia é descarregada"],
    ["**Só no aparelho, com cópias descarregadas**", "Nada a ligar", "Ficheiro carteira.backup descarregado para a pasta Transferências (computador e Android) ou guardado em Ficheiros e partilhado (iPhone)", "Não: a app lembra \"Última cópia há N dias\""],
  ], [2.2, 3.6, 2.8, 1.8]),
  Esp(),
  Caixa("Porque não se escreve o \"endereço\" da drive", [
    "Por segurança, a ligação ao Google Drive e ao Dropbox não se faz colando um endereço ou link. Um link partilhado daria acesso a qualquer pessoa que o tivesse, e a API não grava ficheiros através dele.",
    "A forma segura e oficial é **iniciar sessão na conta** e **escolher a pasta** no seletor do próprio serviço. O resultado para o utilizador é o mesmo: a drive fica ligada à app e a app mostra sempre a conta e a pasta onde está a guardar.",
    "A app pede só o acesso mínimo: no Google Drive, apenas aos ficheiros e pastas que ela própria cria ou que o utilizador escolhe (acesso drive.file); no Dropbox, apenas à pasta da app. Não vê o resto da drive.",
  ], AMARELO_CL),
  Esp(),
  H2("9.4 Ecrã \"Onde estão os meus dados\""),
  P("Em **Definições → Cópias de segurança**, sempre visível, e com um resumo no ecrã inicial:"),
  Tab(["Informação / ação", "Exemplo"], [
    ["Destino atual", "Google Drive"],
    ["Conta ligada", "nome@gmail.com"],
    ["Pasta", "O meu Drive / Investimentos / Cópias"],
    ["Última cópia", "22/10/2026 às 18:40 · 1,2 MB · correu bem (ou o erro, em vermelho)"],
    ["Cópias guardadas", "10 versões (número editável)"],
    ["**Fazer cópia agora**", "Cópia imediata para o destino"],
    ["**Alterar local**", "Escolher outra pasta, outra conta ou outro destino. A app faz uma cópia no novo local e pergunta se mantém ou apaga as cópias antigas"],
    ["**Desligar**", "Deixa de copiar para este destino (as cópias já feitas ficam lá). A app pede outro destino ou passa a lembrar as cópias manuais"],
    ["**Descarregar cópia**", "Gera sempre um ficheiro cifrado, seja qual for o destino escolhido"],
    ["**Restaurar de uma cópia**", "Lista as cópias disponíveis com data e aparelho de origem"],
  ], [3, 7]),
  Esp(),
  P("Na **pasta do computador**, o navegador só deixa a app saber o **nome** da pasta, não o caminho completo. A app mostra esse nome e a indicação \"pasta escolhida neste computador\"."),
  H2("9.5 Cópia automática e vários aparelhos"),
  ...Bs([
    "Cópia automática ao fechar a app e, no máximo, uma vez por dia. Guardam-se as últimas 10 versões (valor editável).",
    "**Noutro aparelho:** instala-se a app, escolhe-se \"Já tenho dados: restaurar uma cópia\", liga-se o mesmo destino, escolhe-se a cópia e introduz-se a palavra-passe.",
    "**Conflitos:** a versão mais recente ganha, mas a app avisa antes de substituir (\"Existe uma cópia mais recente feita no computador a 18/10 às 21:14. Substituir os dados deste aparelho?\").",
    "Os ficheiros estão sempre **cifrados**. A Google ou a Dropbox guardam apenas um ficheiro ilegível.",
    "Cada utilizador usa a **sua própria** conta. O criador da app nunca tem acesso aos dados de ninguém.",
    "**Requisitos técnicos:** projeto na Google Cloud publicado em \"produção\", com nome, logótipo, página inicial e política de privacidade, e o endereço da app registado como origem autorizada; app registada na Dropbox (com o mesmo endereço). Os acessos pedidos (drive.file e pasta da app no Dropbox) não exigem as verificações demoradas reservadas a acessos amplos.",
    "**Mais tarde:** OneDrive (Microsoft) como destino automático, com o mesmo modelo. Até lá, quem usa OneDrive pode escolher uma pasta sincronizada pelo OneDrive no computador.",
  ]),
  H2("9.6 Recuperação"),
  ...Bs([
    "Na configuração inicial é gerada uma **chave de recuperação** (por exemplo 24 palavras) que o utilizador imprime ou escreve em papel.",
    "Sem a palavra-passe e sem a chave de recuperação, as cópias não podem ser recuperadas, nem pela Google, nem pela Dropbox, nem por ninguém. A app avisa claramente disto.",
  ]),
);

// 10. Legal
c.push(
  H1("10. Aspetos legais e regulamentares"),
  Caixa("Consequência da decisão \"cada pessoa que a descarregar só funciona com os seus dados\"", [
    "Os dados de cada pessoa são privados e ficam com ela, o que é ótimo para a privacidade. Mas, como outras pessoas podem descarregar a app, ela passa a ser **distribuída a terceiros**, e isso tem consequências legais e de publicação que não existiriam numa app só para si. A tabela seguinte já parte desse pressuposto.",
  ], AMARELO_CL),
  Esp(),
  Tab(["Tema", "Situação", "Medida na app"], [
    ["Sugestões de aquisição de ETF (6.12)", "Numa app distribuída, sugerir a cada pessoa ETF concretos para comprar pode ser considerado **consultoria para investimento**, uma atividade regulada pela CMVM. É o ponto legal mais sensível da app.", "As sugestões resultam de regras e critérios **definidos pelo próprio utilizador** (alocação-alvo, pesos), mostram sempre alternativas e o porquê, nunca dizem \"compre\", não preveem valorizações e têm aviso permanente. Podem ser desligadas. Antes do lançamento (fase 7), **confirmar com um jurista** este enquadramento e, se necessário, lançar a versão pública com as sugestões desligadas por defeito."],
    ["Recolha automática nos portais imobiliários", "Proibida pelos termos de utilização (Idealista, Imovirtual, Casa Sapo).", "Usar só a API oficial (com acesso concedido e condições que permitam uso numa app distribuída), dados abertos do INE e comparáveis manuais."],
    ["Aconselhamento fiscal", "A estratégia fiscal personalizada cabe a contabilistas certificados.", "Simulador informativo com avisos."],
    ["Dados pessoais (RGPD)", "Os dados ficam no aparelho e no destino de cópias escolhido por cada utilizador (o seu Google Drive, Dropbox ou computador). O criador da app não os recolhe nem os vê.", "Mesmo assim é obrigatória uma **política de privacidade** pública (exigida pelas lojas e pela Google). A IA nunca recebe dados pessoais."],
    ["Distribuição", "Como PWA, a app é distribuída por um endereço público e não precisa das lojas nem das suas regras. Se um dia for publicada nas lojas (via Capacitor), passam a aplicar-se as contas de programador e os requisitos de revisão do Google Play e da App Store.", "Página pública da app com instruções de instalação, política de privacidade e avisos legais, antes de partilhar o endereço com outras pessoas."],
    ["Chaves de serviços externos (IA, Idealista)", "As chaves gratuitas são pessoais e os limites são por chave.", "Cada utilizador introduz a sua chave de IA. O acesso ao Idealista depende das condições que forem concedidas."],
  ], [2.5, 4, 3.5]),
);

// 11. Plano
c.push(
  H1("11. Plano de implementação por fases"),
  P("Cada fase dá uma versão utilizável. A ordem põe primeiro o que funciona sem dependências externas."),
  Tab(["Fase", "Conteúdo", "Depende de internet?", "Esforço relativo"], [
    ["Já (em paralelo)", "Pedir acesso à API do Idealista. Criar a conta GitHub (código e alojamento gratuito).", "—", "Baixo"],
    ["0. Fundações", "Projeto PWA (TypeScript + React + Vite), instalação no ecrã inicial, funcionamento sem internet, base de dados cifrada, desbloqueio com palavra-passe e chave de acesso, perfil do investidor, tabelas fiscais versionadas. Publicação de teste no GitHub Pages para experimentar no telemóvel.", "Não", "Médio"],
    ["1. Calculadoras e carteiras (MVP)", "As 5 estratégias imobiliárias com introdução manual, custos de aquisição, financiamento com validações do BdP, rentabilidade, assistente inicial com escolha do local das cópias (pasta do computador ou cópia descarregada), ecrã \"Onde estão os meus dados\", carteira imobiliária, catálogo manual de ETF, distribuição, registo de compras na carteira (FIFO), juros compostos a 4%, 6%, 8% e 10%, custos, impostos, zona de dúvidas, exportação/importação cifrada", "Não", "Alto"],
    ["2. Dados oficiais (concluída)", "INE (preços e rendas por freguesia, trazidos pela publicação automática), BCE (Euribor) e BPstat (taxas médias). Selos de fonte e data, uso sem internet. Comparáveis em 14 plataformas com mapa, preço ou renda em cada anúncio e raio. Projeções com cenários. Inflação do Banco de Portugal nos custos.", "Sim (fontes gratuitas)", "Médio"],
    ["3. ETF avançado", "Importação da carteira da corretora e dos ficheiros de posições dos emitentes, exposição por setor e país, sobreposição, comparador com pontuação, painel com gráficos, dados TiVA e input-output da OCDE, alocação-alvo e motor de sugestões de aquisição", "Parcial", "Alto"],
    ["4. IA explicativa", "Camada de abstração, ligação ao Gemini (principal) e ao Groq (reserva, automática quando o principal esgota o limite), ambos gratuitos e com a chave de cada utilizador, pacote estruturado sem dados pessoais, validação dos números, justificações e respostas a dúvidas", "Sim", "Médio"],
    ["5. Cópia automática na nuvem", "Ligação ao Google Drive (início de sessão e escolha da pasta) e ao Dropbox, cópias automáticas com versões, restauro noutro aparelho, resolução de conflitos", "Sim", "Médio"],
    ["6. Ecrã grande e vários aparelhos", "Aproveitar o espaço do computador e do tablet (tabelas e gráficos lado a lado). Testes da cópia e do restauro entre telemóvel e computador, em Android, iPhone, Windows e Mac.", "Não", "Baixo"],
    ["7. Lançamento", "Endereço definitivo, página da app com instruções de instalação, política de privacidade, avisos legais, configuração do ecrã de autorização Google e testes com outras pessoas. Opcional: versão para as lojas com o Capacitor.", "Sim", "Médio"],
    ["8. Extras", "API do Idealista (se for concedida), OneDrive como destino automático, pesquisa assistida com citações, património consolidado completo", "Sim", "Variável"],
  ], [2, 5, 1.6, 1.4]),
);

// 12. Decisões
c.push(
  H1("12. Decisões"),
  H2("12.1 Decisões tomadas"),
  Tab(["Questão", "Decisão", "O que muda na app"], [
    ["Uso pessoal ou distribuição a terceiros?", "Uso individual: cada pessoa que a descarregar só trabalha com os seus próprios dados.", "Sem servidor central nem contas partilhadas (2.1). Como a app é distribuída, é preciso política de privacidade, uma página pública da app e cuidado com o enquadramento CMVM (10). Foi acrescentada a fase 7, Lançamento (11)."],
    ["Plataformas", "Qualquer aparelho, com a app construída como aplicação web instalável (PWA).", "Um só código para Android, iPhone, Windows e Mac, sem lojas nem contas de programador. Tecnologias revistas (2.1, 9.1), fases 0, 6 e 7 ajustadas (11). Lojas mais tarde, se necessário, com o Capacitor."],
    ["IA na nuvem é aceitável?", "Sim, com uma IA gratuita e uma segunda gratuita de reserva, usada quando a primeira esgota o limite.", "Gemini como principal e Groq como reserva, com troca automática, chave gratuita de cada utilizador, camada para trocar de fornecedor e nunca dados pessoais (8.3)."],
    ["Orçamento para dados pagos (ETF)", "0 € (introdução manual).", "Catálogo de ETF manual, com importação dos ficheiros dos emitentes e lembretes de revisão. O fornecedor pago saiu do plano (3, 11)."],
    ["Pedir acesso à API do Idealista?", "Sim.", "Pedido feito já, em paralelo. As condições têm de permitir o uso numa app distribuída. Até lá, comparáveis manuais (3, 5.3)."],
    ["Comparação com a carteira de ETF", "Só quando já existe carteira.", "O passo \"Carteira atual\" é opcional e as análises de sobreposição só aparecem se houver carteira (6.1, 6.8)."],
    ["ETF escolhidos e sugestões da IA (antes: frase incompleta)", "Quando os ETF são escolhidos e o valor é registado como compra, ficam guardados na carteira. A app vai sugerindo aquisições pelo equilíbrio da carteira, pelos setores interdependentes e pelo potencial de valorização.", "Registo de compras com FIFO (6.11). Sugestões geradas por regras e dados objetivos, com indicadores históricos em vez de previsões e a IA a explicar o porquê (6.12). Novo campo de alocação-alvo no perfil (4). Ponto legal a validar antes do lançamento (10)."],
    ["Local onde os dados são guardados", "No primeiro arranque, a app pergunta onde guardar: Google Drive, Dropbox ou cópias no aparelho/computador. Na drive, o utilizador liga a sua conta. A app mostra o local atual e permite alterá-lo.", "Assistente inicial e ecrã \"Onde estão os meus dados\" (9.3, 9.4). A drive liga-se por início de sessão e escolha da pasta, não por endereço colado (mais seguro). Os dados de trabalho ficam sempre no aparelho e o destino recebe as cópias automáticas (9.2). Fases 1 e 5 ajustadas (11)."],
    ["Taxas da simulação de ganhos dos ETF", "4%, 6%, 8% e 10% ao ano.", "A simulação mostra sempre os quatro cenários lado a lado em todos os horizontes (6.4)."],
    ["Plataformas de pesquisa de imóveis (fase 2)", "Venda: Idealista, Imovirtual, SUPERCASA, Casa Sapo, RE/MAX, Century 21, ERA e e-Leilões. Arrendamento: também OLX, CustoJusto, Uniplaces, HousingAnywhere, BQuarto e Roomgo.", "Pesquisa com um toque e registo dos anúncios (5.3). A app não lê os anúncios (sem acesso aberto e proibido pelos termos). Leilões, temporários e quartos à parte."],
    ["Mapa dos comparáveis (fase 2)", "Mostrar o imóvel e os anúncios no mapa, com o valor do imóvel na venda e a renda no arrendamento.", "Mapa OpenStreetMap com etiquetas de preço ou renda e raio de 1 a 5 km (5.3)."],
    ["Dados do INE (fase 2)", "O INE não aceita pedidos do navegador: a publicação automática vai buscá-los e publica-os com a app.", "Sem intermediário nem conta extra (2.1, 3). Atualização todas as segundas-feiras."],
    ["Nomes dos cenários de valorização (fase 2)", "Nomes descritivos em vez de pessimista, base e otimista.", "Onde o mercado abrandou, a média de 3 anos é mais baixa do que a de 5; chamar-lhe otimista seria enganador (5.5)."],
    ["Propostas de ETF e escolhas", "A IA avança com propostas; o utilizador escolhe dessas propostas e atribui um valor a cada escolha. Só os ETF escolhidos são guardados.", "As propostas não escolhidas deixam de ser registadas (6.1, 6.11). A origem de cada compra fica marcada como \"Proposta da IA\" ou \"Escolha própria\" (6.11). Até à fase 4 (IA), as propostas vêm do catálogo filtrado pelo motor da app."],
  ], [2.6, 3.2, 4.2]),
  Esp(),
  H2("12.2 Ainda por confirmar"),
  P("Não há decisões pendentes sobre a especificação. Fora dela, falta apenas validar os parâmetros fiscais do Anexo B com um contabilista (antes do fim da fase 1) e o enquadramento das sugestões de ETF com um jurista (antes da fase 7)."),
);

// Anexo A
c.push(
  H1("Anexo A: Fórmulas"),
  Tab(["Indicador", "Fórmula"], [
    ["Prestação (método francês)", "P = C × i ÷ (1 − (1 + i)^(−n)), com i = taxa anual ÷ 12 e n = número de meses"],
    ["Taxa da prestação variável", "Taxa = Euribor (do prazo escolhido) + spread"],
    ["LTV", "Montante do empréstimo ÷ menor entre o preço e a avaliação bancária"],
    ["DSTI (taxa de esforço)", "Soma das prestações (com o choque de taxa) ÷ rendimento líquido mensal"],
    ["Yield bruta", "Renda anual ÷ preço de compra"],
    ["Yield líquida", "(Renda anual × (12 − meses sem inquilino) ÷ 12 − custos anuais − IMI) ÷ (preço + custos de aquisição)"],
    ["Cash-flow mensal", "Renda efetiva − prestação − condomínio − seguros − manutenção − IMI ÷ 12 − IRS das rendas ÷ 12"],
    ["ROI", "Lucro líquido ÷ capital próprio investido"],
    ["TIR", "Taxa que anula o valor atual de todos os fluxos (saídas e entradas) nas datas reais"],
    ["Payback", "Anos até os fluxos acumulados igualarem o capital próprio investido"],
    ["Margem na reconstrução", "Valor depois da obra − (compra + aquisição + obra + licenças + detenção + custos de venda)"],
    ["Juros compostos", "VF = C × (1 + r)ⁿ, com r = taxa anual − TER ponderado"],
    ["Valor real", "VF real = VF ÷ (1 + inflação)ⁿ"],
    ["Custo anual do TER", "Σ (valor investido no ETF × TER do ETF)"],
    ["Sobreposição entre ETF A e B", "Σ min(peso da empresa em A, peso da empresa em B)"],
    ["Desvio à alocação-alvo", "Peso atual da região ou setor − peso-alvo (em pontos percentuais)"],
    ["Mais-valia de um ETF (FIFO)", "Valor de venda − custo de aquisição das unidades mais antigas vendidas primeiro (com comissões)"],
    ["Distância ao comparável", "Fórmula de Haversine entre as coordenadas do imóvel e as do comparável"],
  ], [3, 7]),
);

// Anexo B
c.push(
  H1("Anexo B: Parâmetros a manter atualizados"),
  P("Todos estes valores ficam numa tabela da app com **valor, data de entrada em vigor, fonte e data da última verificação**. Devem ser revistos pelo menos uma vez por ano, depois da publicação do Orçamento do Estado."),
  Tab(["Parâmetro", "Valor de referência", "Fonte", "Periodicidade"], [
    ["Escalões e taxas de IMT (HPP, secundária, Continente e Regiões Autónomas)", "Tabela do art. 17.º do CIMT", "CIMT / Orçamento do Estado", "Anual"],
    ["IMT de outros prédios urbanos", "6,5%", "CIMT", "Anual"],
    ["Limites do IMT Jovem", "Conforme a tabela em vigor", "CIMT", "Anual"],
    ["Imposto do Selo na aquisição", "0,8%", "Tabela Geral do IS, verba 1.1", "Anual"],
    ["Imposto do Selo no crédito", "Conforme o prazo + 4% sobre os juros", "Tabela Geral do IS, verba 17", "Anual"],
    ["Taxas de IMI por município", "0,3% a 0,45%", "Portal das Finanças", "Anual"],
    ["Limite e taxas do AIMI", "Conforme a lei em vigor", "CIMI", "Anual"],
    ["Taxa autónoma das rendas", "25% geral, com taxas reduzidas em contratos longos", "CIRS", "Anual"],
    ["Mais-valias imobiliárias", "50% do ganho englobado, coeficientes de desvalorização", "CIRS / Portaria anual", "Anual"],
    ["Mais-valias e dividendos mobiliários", "28% ou englobamento", "CIRS", "Anual"],
    ["Escalões de IRS", "Tabela do art. 68.º do CIRS", "CIRS / Orçamento do Estado", "Anual"],
    ["LTV máximo", "90% HPP / 80% outros", "Banco de Portugal (medida macroprudencial)", "Semestral"],
    ["DSTI máximo e choque de taxa", "50% + choque definido pelo BdP", "Banco de Portugal", "Semestral"],
    ["Prazo máximo do crédito", "40 anos, conforme a idade", "Banco de Portugal", "Semestral"],
    ["Custos de escritura e registo", "Tabela de referência", "IRN / notários", "Anual"],
    ["Tabela de custos de obra", "€ por unidade e coeficientes regionais", "CYPE / orçamentos", "Semestral"],
  ], [3.5, 2.8, 2.4, 1.3]),
);

// ---------------------------------------------------------------- DOCUMENTO
const doc = new Document({
  creator: "Filipe Fernandes",
  features: { updateFields: true },
  title: "Aplicação de Investimentos – Especificação revista",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 34, bold: true, color: AZUL, font: "Calibri" },
        paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: AZUL, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 27, bold: true, color: "2F5496", font: "Calibri" },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, color: "2F5496", font: "Calibri" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bul", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ] },
      ...["num", "num2", "num3", "num4", "num5", "num6"].map(r => ({ reference: r, levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] })),
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Aplicação de Investimentos · Especificação revista", size: 16, color: "7F7F7F" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: 16, color: "7F7F7F" })] })] }) },
    children: c,
  }],
});

Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log("OK", OUT); });
