# 01 — Coletor diário do upstream em GitHub Actions

Status: ready-for-agent
Type: task
Blocked by: nada. Decisão A aplicada em 2026-10-19 (branch padrão do fork = `cajado`).

## O que fazer

Workflow `.github/workflows/upstream-garimpo.yml` com `on: schedule` (cron diário de manhã, horário de Brasília convertido para UTC) e `workflow_dispatch` (rodar à mão). Ele só **lê** o upstream e escreve em `tasks/upstream-garimpo/`.

Passos (spec §5.1 a 5.4):
1. `git remote add upstream https://github.com/melgarafael/DeskcommCRM.git` e `git fetch upstream` (sem token, o repo é público).
2. Ler `tasks/upstream-garimpo/ultimo-analisado.txt`. Primeira execução: usar a tag mais recente do upstream, não a base de 2026-08-10.
3. Listar os PRs mesclados no intervalo, com arquivos e o fragmento `docs/release/*.md` quando existir.
4. Calcular a zona de cada arquivo (verde, amarela, vermelha) com `scripts/upstream-garimpo/zonas.ts`.
5. Gravar `relatorios/AAAA-MM-DD.json` e abrir **uma PR** para a `cajado` com esse arquivo e o marcador atualizado. Dia sem PR novo: relatório de uma linha, sem erro.

Permissões mínimas do workflow: `contents: write` e `pull-requests: write`, nada além. Sem segredos.

## Decisão (resolvida em 2026-10-19: opção A)

O cron só dispara pela branch padrão do repo. Hoje a padrão é `main`, parada em `48e517070`. Opções:
- **A (recomendada):** mudar a branch padrão do fork para `cajado`. É a branch de produção, então faz sentido. Efeito: PRs novas passam a abrir contra `cajado` por padrão, e os workflows de `main` (`ci.yml` roda em `push` para `main`) continuam como estão.
- **B:** colocar o workflow também na `main` parada e fazê-lo dar `checkout` da `cajado`. Funciona, mas mantém uma branch morta com um arquivo vivo.

## Critérios de aceite

- `workflow_dispatch` manual gera o relatório do dia e abre a PR sem tocar em nada fora de `tasks/upstream-garimpo/`.
- O workflow não tem segredo nem permissão de escrita além das duas acima.
- Nenhum nome real de voluntário no relatório (regra do fork público).

## Comments

- 2026-10-19: `scripts/upstream-garimpo/zonas.ts` pronto (passo 4) e testado. Aplicado aos 288 arquivos que o upstream mexeu em 2026-10-16: 278 verdes, 9 amarelas, 1 vermelha (`supabase/baseline.sql`). Coletor (`coletar.ts`, `coleta.ts`) e workflow (`.github/workflows/upstream-garimpo.yml`) escritos. Prova local de 2026-10-16: 37 itens em 1 s (25 verdes, 12 amarelas, 0 vermelhas). **Falta:** primeira execução no GitHub (`workflow_dispatch`) e o caveat abaixo.
- Caveat: PR aberta com o `GITHUB_TOKEN` não dispara outros workflows, então o `verify` não roda nela. Se a `cajado` exigir `verify` para mesclar, a PR do garimpo fica bloqueada. Conferir em Settings → Branches; saída: PAT do Roberto num segredo, ou dispensar o check para `tasks/**`.
