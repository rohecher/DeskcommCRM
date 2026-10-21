# 05 — Botão "Baixar planilha" e os avisos antes do download

Status: needs-info
Type: task
Spec: `tasks/exportar-escala-planilha/spec.md`

## Blocked by: 04 e a pergunta 5 da spec

## O que fazer

No cabeçalho do mês (`CabecalhoDoMes.tsx`), o botão e, antes de baixar, os avisos do item 10 da spec (vagas sem nome por culto, cultos sem louvor). Texto de tela passa pelo `humanizer-pt-br`.

## Aceite

- Provado **pela tela**, com Playwright, num banco fresco: clicar, baixar, abrir o arquivo e conferir as abas. Evidência em `.superpowers/evidence/`.
- Atualizar `docs/testing/user-journey-map.md`.

## Comments
