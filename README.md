# Investimentos: Imobiliário e ETF

Aplicação web instalável (PWA) para simular e acompanhar investimentos em imobiliário e ETF.
Os dados ficam no aparelho, cifrados; as cópias vão para o local que o utilizador escolher.

A especificação completa está no documento Word "Especificação revista - Aplicação de investimentos"
na pasta acima desta. O script que o gera está em `docs/gerar-especificacao.js`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências (só da primeira vez) |
| `npm run dev` | Abre a app em modo de desenvolvimento em http://localhost:5173 |
| `npm test` | Corre os testes automáticos |
| `npm run build` | Gera a versão publicável na pasta `dist/` |
| `npm run preview` | Serve a versão publicável em http://localhost:4173 |
| `node scripts/gerar-icones.mjs` | Volta a gerar os ícones da app em `public/` |

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

Por fazer na fase 0: desbloqueio com impressão digital ou rosto (chaves de acesso / WebAuthn).
Google Drive e Dropbox entram na fase 5.

Fase 1 (em curso): motor de cálculo em `src/calculo/`, com testes.

- `imt.ts`: IMT por escalões (Continente e regiões autónomas), IMT Jovem, Imposto do Selo na compra.
- `credito.ts`: prestação, plano de pagamentos, MTIC, TAEG aproximada, teste de stress,
  limites do Banco de Portugal (LTV, DSTI com choque de taxa, prazo conforme a idade).
- `aquisicao.ts`: custos de aquisição (impostos, escritura e registo, crédito, mediação) e IMI.
- `imovel.ts`: junta os cálculos acima a partir dos dados guardados do imóvel e do perfil.
- `irs.ts`: escalões do IRS, englobamento e taxas autónomas das rendas.
- `revenda.ts`: estratégia 1A (mais-valia, IRS, lucro, ROI, TIR, preço mínimo de venda).
- `arrendamento.ts`: estratégia 1B (yields, IRS das rendas, cash-flow, ROI, payback).

Ecrãs: lista de imóveis e ficha do imóvel com as estratégias 1A e 1B.
