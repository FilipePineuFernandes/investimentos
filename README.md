<p align="center"><img src="public/logotipo.png" alt="Training Teach & Coach Investments" width="360" /></p>

# Investimentos: Imobiliário e ETF

Aplicação web instalável (PWA) para simular e acompanhar investimentos em imobiliário e ETF.
Os dados ficam no aparelho, cifrados; as cópias vão para o local que o utilizador escolher.

A especificação completa está no documento Word "Especificação revista - Aplicação de investimentos"
na pasta acima desta. O script que o gera está em `docs/gerar-especificacao.cjs`
(`npm i --no-save docx` e depois `node docs/gerar-especificacao.cjs "../Especificação revista - Aplicação de investimentos.docx"`).

## Endereço

App publicada: **https://filipepineufernandes.github.io/investimentos/**

Cada envio para o ramo `main` testa, compila e publica a app automaticamente
(`.github/workflows/publicar.yml`). Código: https://github.com/FilipePineuFernandes/investimentos

## Comandos

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências (só da primeira vez) |
| `npm run dev` | Abre a app em modo de desenvolvimento em http://localhost:5173 |
| `npm test` | Corre os testes automáticos |
| `npm run build` | Gera a versão publicável na pasta `dist/` |
| `npm run preview` | Serve a versão publicável em http://localhost:4173 |
| `node scripts/copiar-ocr.mjs` | Copia para `public/ocr` o leitor de texto da nota de IRS (corre sozinho antes de `dev` e `build`; os ficheiros não vão para o repositório) |
| `node scripts/dados-ine.mjs` | Atualiza os preços e rendas do INE em `public/dados/ine.json` (a publicação automática fá-lo sozinha) |

## Perfil e nota de liquidação de IRS

- A **data de nascimento** é pedida uma só vez em cada aparelho e depois fica fixa (há «Corrigir engano» para um erro de escrita).
- A **nota de liquidação de IRS** (fotografia ou PDF) preenche o rendimento da taxa e o quociente familiar (2 = tributação conjunta de um casal), usados nas contas de IRS de rendas, mais-valias de ETF, revenda e cedência. Só se guardam números e datas.
- Regra de validade: a nota dos rendimentos do ano A serve até 31 de agosto de A+2; a partir de 1 de setembro de A+2 a app pede a do ano A+1 (`src/calculo/notaIrs.ts`).
- A leitura corre no aparelho: `src/leitura/` (Tesseract para fotografias, pdf.js para PDF). A fotografia é lida em três larguras e as contas da própria nota (por exemplo rendimento global − deduções = coletável) escolhem e confirmam os valores; o utilizador confirma sempre no ecrã.
- **Corretora principal**: resumo no perfil com o botão «Alterar dados da corretora»; comissão fixa, percentual, mínima e máxima por ordem, câmbio e custódia anual (esta entra nas projeções como o TER).

## Fase 2: dados oficiais

- **INE** (preços de venda e rendas por freguesia e município): o INE não aceita pedidos diretos do
  navegador, por isso `scripts/dados-ine.mjs` vai buscá-los na publicação (e todas as segundas-feiras)
  e grava `public/dados/ine.json`, publicado com a app e guardado para uso sem internet.
- **BCE** (Euribor a 3, 6 e 12 meses): pedido direto da app (`src/dados/euribor.ts`), guardado com a data.
- Valores de mercado e projeção a 1, 2 e 3 anos: `src/calculo/mercado.ts`, ecrã `ValoresMercado.tsx`.

## Estrutura

```
src/
  seguranca/cripto.ts     Cifragem: AES-256-GCM, Argon2id, código de recuperação
  dados/bd.ts             Base de dados local (IndexedDB, Dexie)
  dados/cofre.ts          Palavra-passe, desbloqueio e recuperação
  dados/repositorio.ts    Guardar e ler registos cifrados
  dados/copias.ts         Cópias de segurança: ficheiro, pasta do computador, restauro
  dados/perfil.ts         Perfil do investidor
  dados/parametros.ts     Parâmetros fiscais com fonte e data (Anexo B)
  ecras/                  Ecrãs da app
  componentes/            Peças de interface reutilizáveis
```

## Estado

Fase 0 (fundações) concluída:

- Assistente inicial: palavra-passe, código de recuperação, local das cópias, perfil.
- Base de dados cifrada; bloqueio automático após 5 minutos sem utilização.
- Cópias: ficheiro descarregado ou pasta no computador (Chrome/Edge), com as últimas N versões.
- Ecrã "Onde estão os meus dados" com alterar local, desligar, descarregar e restaurar.
- Parâmetros fiscais iniciais (a confirmar por contabilista).
- Google Drive (opcional): os dados cifrados sincronizam com a conta Google da pessoa (`src/nuvem/`). A app só pede o acesso `drive.file`
  (ficheiros criados por ela). Cada registo tem hora de alteração e juntam-se os dois lados sem perder nada (`fusao.ts`); o que se apaga fica registado
  para apagar também nos outros aparelhos. Aparelho novo: «Já tenho dados no Google Drive» e só pede a palavra-passe. O ID de cliente OAuth está em
  `src/nuvem/googleDrive.ts` (é público); a origem autorizada na Google Cloud tem de ser o endereço onde a app é publicada.

Por fazer na fase 0: desbloqueio com impressão digital ou rosto (chaves de acesso / WebAuthn).
O Dropbox entra numa fase seguinte.

Fase 1 (em curso): motor de cálculo em `src/calculo/`, com testes.

- `imt.ts`: IMT por escalões (Continente e regiões autónomas), IMT Jovem, Imposto do Selo na compra.
- `credito.ts`: prestação, plano de pagamentos, MTIC, TAEG aproximada, teste de stress,
  limites do Banco de Portugal (LTV, DSTI com choque de taxa, prazo conforme a idade).
- `aquisicao.ts`: custos de aquisição (impostos, escritura e registo, crédito, mediação) e IMI.
- `imovel.ts`: junta os cálculos acima a partir dos dados guardados do imóvel e do perfil.
- `irs.ts`: escalões do IRS, englobamento e taxas autónomas das rendas.
- `revenda.ts`: estratégia 1A (mais-valia, IRS, lucro, ROI, TIR, preço mínimo de venda).
- `arrendamento.ts`: estratégia 1B (yields, IRS das rendas, cash-flow, ROI, payback).
- `reconstrucao.ts`: estratégia 2 (obra integral ou por zonas, imprevistos, detenção, margem).
- `cedencia.ts`: estratégia 3 (ganho, IRS, TIR com as datas reais, verificações do promotor).
- `util.ts`: arredondamento ao cêntimo e TIR com datas.
- `etf.ts`: ISIN, regras do catálogo (UCITS, KID), juros compostos, custos de compra, TER,
  impostos na venda e simulação em quatro cenários (4%, 6%, 8%, 10%).
- `carteiraEtf.ts`: posições de ETF por FIFO, ganhos latentes e realizados, dividendos, IRS das vendas por ano.
- `carteira.ts`: carteira imobiliária (valor atual, mais-valia latente, dívida em curso,
  capital próprio, evolução, resultado dos vendidos).

Ecrãs: lista de imóveis e ficha do imóvel com as cinco estratégias (armazéns = destino
comercial ou industrial). A tabela pessoal de custos de obra (`dados/custosObra.ts`) guarda
os custos unitários usados e sugere-os nas obras seguintes. A lista de imóveis mostra o resumo
da carteira e o gráfico da evolução (`componentes/GraficoLinha.tsx`, SVG sem bibliotecas).

ETF: catálogo pessoal (`dados/etf.ts`), simulação com propostas do catálogo, escolha e valor
por ETF (só os escolhidos contam), registo da compra na carteira, carteira calculada a partir
dos movimentos com FIFO (`calculo/carteiraEtf.ts`, `dados/movimentosEtf.ts`) e zona de dúvidas.
