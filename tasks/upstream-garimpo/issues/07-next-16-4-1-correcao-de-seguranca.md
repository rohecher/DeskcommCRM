# 07 — Subir o Next.js de 16.2.12 para 16.4.1 (correção de segurança de 14/10)

Status: ready-for-agent
Type: task
Origem: https://github.com/vercel/next.js/releases/tag/v16.4.1 e nota #3054 do upstream, relatório de 2026-10-20 (avaliação dos 9 itens que aplicam limpo)
Zona: verde (dependência, sem código do upstream)
Valor: seguranca-lgpd — PRIORIDADE 1

## Por que traz

O Next publicou em 14/10/2026 uma atualização fora de ciclo. O fork está na 16.2.12 e não recebe os conserto. Aplicabilidade medida no repositório: **Server Actions** (DoS, High, GHSA-p3m5-59mp-jv5r): o fork tem 30 arquivos com `"use server"`, então **se aplica**; uma requisição forjada pode travar o processo. `use cache` (RCE, Critical, GHSA-673q-mjm6-r5xr): o fork não usa Cache Components, **não se aplica**. Otimização de imagem com SVG (RCE, Critical, CVE-2026-96889): o fork tem `images.unoptimized: true` e não usa `next/image`; **inferido** que o caminho não é alcançável, não provado. O `sharp` do lock é o 0.35.3 e o corrigido é o 0.35.5+.

## O que toca

`package.json` (`"next": "^16.2.12"` já aceita a 16.4.1) e `pnpm-lock.yaml`. Nenhum código do upstream é copiado.

## Risco e conflito esperado

Médio: salto de duas minors. Quebras possíveis em build, no Turbopack e nos testes de componente. O upstream já roda a 16.4.1 com a mesma base de código, o que ajuda. Provar com `pnpm build`, `gov:verify` e o `e2e` do CI. Depois do deploy, o domínio tem que responder 307 (não 404).

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada.
2. `pnpm update next@16.4.1` e conferir no lock que o `sharp` resolvido é >= 0.35.5.
3. `pnpm build` (produção) além dos gates. Se algo quebrar, não forçar: anotar aqui e voltar a `needs-info`.

Gates, com o `.env` fora do caminho: `pnpm gov:verify` e `pnpm build`; o `e2e` roda no CI. PR para a `cajado`; o merge faz deploy.

## Comments
