# 12 — 69 alertas de vulnerabilidade abertos no Dependabot

Status: needs-triage
Type: task
Origem: Dependabot do `rohecher/DeskcommCRM`, ligado em 2026-10-20 (estava desligado; ninguém via esses alertas)
Zona: verde (dependências, sem código do upstream)
Valor: seguranca-lgpd

## O que é

Ao ligar "Dependabot alerts" e "Dependabot security updates", o GitHub listou **69 alertas abertos**: 4 críticos, 23 altos, 34 médios, 8 baixos. **54 são de dependência de runtime**, 15 só de desenvolvimento.

Pacotes de runtime com alerta crítico ou alto (a quantidade é de alertas, não de versões): `next` ×4 (ver ticket 07), `@modelcontextprotocol/sdk` ×3, `fast-uri` ×5, `undici` ×2, `sharp` ×2, `brace-expansion` ×2, `browserslist` ×2, `proxy-addr` ×1 (crítico), `nanoid`, `source-map-js`.

## O que falta saber

- Quais são alcançáveis no Cajado. Ainda **não avaliei** nenhum (só o Next, e parcialmente). `@modelcontextprotocol/sdk` ×3 merece olhar: o CRM expõe MCP.
- Se o Dependabot vai abrir uma PR por alerta ou agrupar. Ele abre as PRs sozinho; cada uma é uma PR para a `cajado` e o merge faz deploy.

## Como tratar

1. Deixar o Dependabot abrir as PRs; triar por severidade e por runtime.
2. Cada PR: `pnpm gov:verify`, `pnpm build` e o `e2e` do CI. Subida de major (ex.: `undici`, `vite`) pode quebrar: nunca mesclar em lote.
3. Alerta que não é alcançável: fechar no Dependabot como "não usado", com o motivo escrito aqui.

## Comments
