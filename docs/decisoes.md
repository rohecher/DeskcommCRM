# Decisões

## 2026-10-19 — Garimpo diário do upstream: a rotina propõe, a pessoa aprova

Spec: `tasks/upstream-garimpo/spec.md`. Medido em 2026-10-19, merge-base `48e517070`.

- **DECISÃO — o upstream (`melgarafael/DeskcommCRM`) não é mesclado na `cajado`. Nunca.** O
  fork está 10.545 commits atrás e tem 25 próprios; o upstream fez 285 merges em uma semana.
  O Cajado trocou o vocabulário em 65 arquivos que o upstream também altera e tem domínio
  próprio (escalas). O que entra vem por `git cherry-pick -x`, item a item, com aprovação.
- **DECISÃO — a rotina diária só lê e propõe.** Um workflow agendado do GitHub Actions no
  fork faz `git fetch upstream`, lista os PRs novos, classifica cada arquivo por zona
  (vermelha, amarela, verde) e abre uma **PR** com o relatório bruto em
  `tasks/upstream-garimpo/`. Não aplica código, não dá push na `cajado`, não dá merge. O
  workflow tem só `contents` e `pull-requests` e nenhum segredo. A classificação de valor
  (ajuda o bot, segurança/LGPD, confiabilidade, só vendas) fica numa sessão do Claude, à
  parte. Alternativa descartada: schedule do Dokploy. O contêiner do app roda um comando
  de shell, não tem IA, e não foi confirmado que tenha `git`, `gh` ou rede para o GitHub;
  a rotina também não precisa da VPS.
- **DECISÃO — a branch padrão do fork passa a ser a `cajado`** (2026-10-19). O cron do
  GitHub só dispara pela branch padrão, e a `main` do fork está parada em `48e517070`
  (2026-08-10, ancestral do upstream). A `cajado` é a branch de produção. Efeito: PRs novas
  abrem contra ela por padrão.
- **DECISÃO — zonas, calculadas e não escolhidas à mão.** Vermelha: `lib/escalas/`,
  `app/app/escalas/`, `lib/branding.ts`, docs de domínio, `CLAUDE.md`/`AGENTS.md`, o bloco
  `VARREDURA anon` do baseline; a rotina nunca propõe tocar. Amarela: arquivo que o fork já
  modificou contra o merge-base; o ganho funcional entra e o texto de tela volta ao
  vocabulário pastoral. Verde: arquivo que o fork não tocou.
- **DECISÃO — migration do upstream nunca entra com o número original.** As `0144` a `0149`
  do upstream são outras que as do fork (`0144_followup_timing_plan` contra
  `0144_organizacao_nova_nasce_igreja`), e o upstream já está na `0683`. Renumera para depois
  da última do fork, entra como apêndice no `baseline.sql` ANTES do bloco `VARREDURA anon`,
  com linha no `MANIFEST.md`. O `baseline.sql` do upstream não é importado.
- **DECISÃO — todo texto de tela trazido do upstream passa por tradução e por
  `humanizer-pt-br`.** Termo comercial (`negócio`, `venda`, `lead`, `cliente`, `Ganho`,
  `Perdido`, `pedido`, `carrinho`) vira o termo de `docs/dominio-nao-e-venda.md`. PR que só
  serve ao produto de vendas (Nuvemshop, pedido, cobrança, planos) é descartado e listado em
  uma linha.
- **PENDÊNCIA — o que a liderança considera "valor" além do bot** (divulgação e auditoria da
  escala). Resposta do Roberto em 2026-10-19: "não sei". Até lá o critério é bot,
  segurança/LGPD e confiabilidade. `needs-info` na spec.
- **PENDÊNCIA — ritmo de aplicação** (teto de itens por semana) e **quem além do Roberto
  aprova** um candidato. Sem resposta.
- **PENDÊNCIA — centralizar o vocabulário pastoral em um módulo** reduziria o conflito a
  cada cherry-pick nos 65 arquivos. É mudança estrutural e pede decisão própria; não está
  decidida aqui.
- **RISCO — a `cajado` faz deploy automático.** Item trazido do upstream que toca schema,
  RLS ou worker chega a produção no merge. Antes de abrir a PR: `pnpm gov:verify` e
  `pnpm test:db`, ambos com o `.env` fora do caminho (ele carrega credenciais reais do
  Upstash e deixa 6 testes vermelhos que o CI não vê).

## 2026-10-16 — Escalas: o TypeScript é o produto, o Python é histórico

- **DECISÃO — `lib/escalas/` é o motor; o Python deixa de receber regra nova.** O
  `gerar.py` (1.030 linhas) foi ensinado pela liderança uma escala errada por vez, e o
  porte para TypeScript foi provado por paridade estrita (`tests/unit/escalas-paridade.test.ts`)
  nas dez escalas aprovadas de 13/09 a 15/10. Regra nova entra no TS, com teste. O Python
  só roda para regenerar o `esperado.json` da paridade, e só até o TS cobrir o fluxo mensal
  inteiro (lista abaixo).
- **DECISÃO — o Python mora em `motor-legado/`, ignorado pelo git.** O `gerar.py` tem nomes
  reais de voluntários fixos no código (`TIME_FIXO`, `RESERVA`) e este fork é público.
  Commit é para sempre. Os fixtures versionados usam pseudônimos (`Voluntario 001`), e
  o glossário está em `docs/escalas-glossario.md`.
- **PENDÊNCIA — o que o app ainda não faz e o Python faz** (verificado em 2026-10-16: não
  há `xlsx`/`exceljs` no `package.json`, nem extração de histórico em `lib/escalas/`):
  1. `exportar.py` — planilha de divulgação a partir da escala aprovada.
  2. `extrair.py` + `perfil.py` — histórico a partir das planilhas antigas de escala.
  3. `consolidar.py` / `importar.py` — ida e volta com o Excel do cadastro. No app o
     cadastro passa a ser a tela `/app/escalas/voluntarios`.
  4. `auditar.py` — conflito com louvor, repetição, decência, carga, contra a escala fechada.
  Quando 1 e 4 existirem no app, o fluxo mensal não depende mais do Python e o
  `motor-legado/` pode ser arquivado.
- **RISCO — a `cajado` faz deploy automático** (`publish-image.yml` + Dokploy). Mudança em
  `lib/escalas/` ou em migration `escala_*` chega a produção no push. `gov:verify` não cobre
  `test:db` nem `test:e2e` (`docs/harness-audit.md`): rode ambos antes de mergear.

## 2026-09-11 — Organização nova nasce igreja (resolve pendência do gatilho)

- **DECISÃO — o gatilho de seed deixa de semear e-commerce (migration 0144):** a
  entrada de 2026-08-14 registrava `fn_seed_default_pipeline_for_org` como pendência
  ("não foi tocado nesta sessão"). Era o único caminho pelo qual uma igreja que
  instalasse o kit abriria o produto e veria "Pedidos → Carrinho abandonado": o funil
  piloto só estava certo porque foi renomeado à mão. Eram **duas** origens, e corrigir
  uma só deixaria a outra de pé — o corpo do gatilho e o DEFAULT da coluna
  `crm_pipelines.vocabulary` (que vale para todo funil criado sem `vocabulary`
  explícito, inclusive pela UI). Agora semeia `Jornada` com
  `Visitante / Em acompanhamento / Membro / Afastado`, espelhando `ETAPAS_INICIAIS`
  — o funil semeado e o criado na tela deixam de divergir. Slugs preservados.
- **DECISÃO — sem backfill:** organização que já existe não é renomeada. Nome de etapa
  é exibição (o código lê slug e `is_won`/`is_lost`), e reescrever dado que o dono pode
  ter customizado é pior que deixar um rótulo velho. A migration muda o que NASCE.
- **CONFIRMADO — provado em banco real:** `scripts/test-db.sh` num
  `pgvector/pgvector:pg17` do zero, install (`ON_ERROR_STOP=1`) e update
  (re-aplicação) verdes, com `tests/invariants/org-nova-nasce-igreja.test.ts` 6/6.
  Nota de ambiente: o script chama `vitest` puro, então precisa de
  `PATH="$PWD/node_modules/.bin:$PATH"` — sem isso ele aplica o baseline, imprime
  `vitest: command not found` e **pula a suíte inteira**.

## 2026-09-11 — Vocabulário fora do kanban

- **DECISÃO — onde há funil em contexto, usar o mecanismo, não string nova:**
  `FilterBar` passou a receber `vocabulary` (que `app/app/pipelines/[id]/_client.tsx`
  já resolvia) em vez de ganhar "Membros/Afastados" hardcoded.
- **DECISÃO — onde não há funil, texto estático de igreja:** empty states,
  notificações, escopos de token, webhooks, LGPD, painel de evolução e configurações
  de funil. IDs de escopo (`leads:read`) e paths de regra (`lead.title`) **não** mudam:
  são contrato, não rótulo.
- **PENDÊNCIA — o agente ainda fala venda:** `lib/agent-engine/**` e `lib/ai/**` têm
  "negócio"/"cliente" dentro de prompt de modelo e copy de guardrail. Mudar ali muda
  comportamento do agente, não só leitura de tela — é Fase 1, junto do motor de fluxo.
- **NOTA — chaves mortas no `vocabulary`:** o jsonb grava oito chaves, mas
  `lib/kanban/vocabulary.ts` só lê quatro (`lead`, `deal`, `won`, `lost`).
  `lead_plural`, `deal_plural`, `stage` e `stage_plural` não são lidas por ninguém.
  Não removidas aqui (o DEFAULT da coluna já tinha as oito); decidir na Fase 1 se
  viram leitura de verdade ou saem.

## 2026-08-31 — Pendência registrada (fora de escopo Fase 0)

- **PENDÊNCIA — formulário de cadastro de visitante (app futuro):** quando o app mobile do
  visitante existir (Fase 3 em `cajado-arquitetura.md`), o cadastro precisa capturar nome
  completo, telefone, e-mail, sexo, decisões (entregou vida a Jesus, reconciliação) e
  perguntas de pesquisa (como conheceu a igreja etc.), **com campos personalizáveis por
  igreja**. Mecanismo já existe e é o certo pra isso: `custom_fields jsonb` em `crm_leads`
  + schema declarativo em `pipeline.settings.fields` (Zod dinâmico) — doutrina do
  `CLAUDE.md`, zero migration nova. Nome/telefone/e-mail são campo core de `contacts`;
  sexo/decisões/pesquisa entram como `custom_fields` configuráveis. Não implementar
  agora — é domínio novo, fora do escopo fechado da Fase 0 (`docs/tarefa-atual.md`).

## 2026-08-31 — Labels de papel (RBAC)

- **CONFIRMADO — rótulos de papel:** `lib/schemas/team.ts` ganhou `ROLE_LABELS`
  (`admin` → "Pastor/Administrador", `manager` → "Líder de Ministério", `agent` →
  "Secretaria", `viewer` → "Leitura"). Aplicado nas 3 telas que mostravam o papel cru
  (`admin`/`manager`/`agent`): `app/app/team/_components/TeamMembersClient.tsx`,
  `app/app/team/invite/_components/InviteForm.tsx`,
  `app/onboarding/invite-team/_form.tsx`. Puramente label — RBAC/RLS/checks continuam
  usando o nome técnico do papel, sem migration. `typecheck` limpo.

## 2026-08-31 — WhatsApp piloto confirmado

- **CONFIRMADO — WAHA CORE local conectado:** sessão `org_720d04ec_f19e14` pareada via QR
  com o número `557399430485` ("Avivar Church"). Mensagem real ida e volta testada: celular
  pessoal (`+5527996539224`) mandou "Oi"/"Paz" pro número da igreja, chegou no Inbox com
  contato e telefone corretos (resolvido via `@lid` + `remoteJidAlt`, ver `lib/waha/ingest.ts`).
  Critério de pronto da Fase 0 pro WhatsApp: **satisfeito**.
- **NOTA — achado de doutrina (não é bug):** `.env.example`/`CLAUDE.md` diziam "cliente
  manda plaintext, container recebe hash SHA512". Na imagem `devlikeapro/waha:noweb`
  usada (CORE, versão 2026.8.1), o comportamento real é o oposto — `lib/waha/client.ts`
  já documentava isso corretamente antes desta sessão. `WAHA_API_KEY` do app precisa ser
  o MESMO hash que o container usa, não o plaintext original. Doc desatualizada, código já certo.
- **PENDÊNCIA — conversa fantasma:** teste de self-chat (mensagem enviada via API pro
  próprio número da igreja, antes do teste real) criou um contato/conversa extra
  (`557399430485` sem nome) que não representa pessoa real. Arquivar/limpar antes de
  considerar o ambiente "limpo" pra demo.

## 2026-08-14 — Fase 0

- **CONFIRMADO — ambiente:** o banco de desenvolvimento usa o Supavisor em modo Session Pooler, porta 5432, porque a conexão direta do Supabase depende de IPv6. O `supabase/baseline.sql` foi aplicado com `ON_ERROR_STOP=1` depois das extensões já previstas em `scripts/test-db.sh` (`uuid-ossp`, `pgcrypto`, `vector`, `citext` e `pg_trgm`).
- **CONFIRMADO — desenvolvimento local:** `next.config.ts` fixa `turbopack.root` em `process.cwd()`. Sem isso, um `package-lock.json` fora do repositório fazia o Next.js observar `C:\Users\rober` e encerrar com `TurbopackInternalError: PathNotFound`.
- **CONFIRMADO — identidade:** a marca base é `Cajado`; `package.json`, metadata e `lib/branding.ts` já refletem esse nome. O favicon básico vive em `app/icon.svg`.
- **CONFIRMADO — vocabulário:** o mecanismo continua sendo `crm_pipelines.vocabulary` (`jsonb`), sem campo ou migration nova. `scripts/seed-crm-vivo.ts` já contém `Visitante/Visitantes`, `Acompanhamento/Acompanhamentos`, `Membro`, `Afastado`, `Etapa da Jornada/Etapas`.
- **CONFIRMADO — textos do kanban:** `Novo Lead`, `Cliente`, `Pedido`, `Lead criado` e `Lead atualizado` eram strings de exibição. As duas últimas eram toasts, sem uso como chave de evento, automação, webhook, log ou comparação. O kanban já recebia `pipeline.vocabulary` pelo `useBoard` e já tinha `resolveVocabulary`; os componentes passaram a consumir esse mecanismo existente, sem campo, migration ou mudança de automação.
- **CONFIRMADO — alcance do vocabulário:** os mesmos rótulos dinâmicos foram propagados ao formulário aberto pelo Inbox e aos textos acessíveis do cartão. `pnpm typecheck` passou. A conferência visual no Chrome continua pendente porque o controlador de desktop não conseguiu anexar ao navegador aberto nesta execução; não há aprovação visual presumida.
- **PENDÊNCIA — nomenclatura da listagem:** `app/app/kanban/page.tsx` mantém o título `Pipelines` por dependência declarada de testes E2E. Uniformizar esse nome exige decisão e atualização conjunta dos testes.
- **CONFIRMADO — usuários de teste:** o modo `--phase0` de `scripts/seed-e2e-credentials.ts` cria somente os perfis pedidos nesta fase (`admin`, `manager` e `agent`) e preserva o seed padrão com `viewer`. Os três usuários foram criados na organização `e2e-test-org`, com e-mail confirmado, associação ativa e senha comum registrada apenas no arquivo local gitignored `.e2e-creds.json`. O admin recebeu um fator TOTP verificado, conforme a política obrigatória de MFA.
- **CONFIRMADO — e-mail do admin de teste:** o admin usa `roberto.hecher@automonte.com.br`. A troca foi feita no mesmo usuário, preservando UUID, associação `admin` ativa e o fator TOTP verificado. O seed reconhece o endereço anterior apenas para migrar instalações já semeadas e não criar um segundo admin.
- **CONFIRMADO — funil piloto da igreja:** o único pipeline do tenant `e2e-test-org` foi renomeado de `Pedidos` para `Jornada`. Seu `vocabulary` usa `Visitante/Visitantes`, `Acompanhamento`, `Membro`, `Afastado` e `Etapa da Jornada/Etapas`. O slug interno continua `pedidos` para evitar mudança além do nome de exibição.
- **DECISÃO — etapas na Fase 1:** as oito etapas herdadas do e-commerce foram preservadas sem renomear, reordenar ou remover. O desenho da jornada real de visitante, membro e voluntário pertence à Fase 1, junto do motor de fluxo; antecipá-lo na Fase 0 criaria regra de produto ainda não decidida.
- **CONFIRMADO — ação de criação:** na listagem de funis, o botão de criação usa o rótulo de exibição `Nova jornada`. A ação e o modelo interno de pipeline permanecem inalterados.
- **CONFIRMADO — exemplo de criação:** o campo de nome do funil usa exemplos adequados ao contexto de igreja: `Jornada de Vida`, `Escalas` e `Discipulado`.
- **DECISÃO — etapas padrão de todo funil novo:** `ETAPAS_INICIAIS` (`lib/pipelines/pipeline-editing.ts`) mudou de nomes neutros (`Novo/Em andamento/Ganho/Perdido`) pra `Visitante/Em acompanhamento/Membro/Afastado`. Antes eram neutros de propósito (comentário no código): o objetivo era não repetir, no funil criado à mão, o mesmo erro do seed automático de e-commerce ("Carrinho abandonado") que não serve pra qualquer nicho. Como o Cajado não é mais um CRM genérico — é um produto de igreja — o argumento de neutralidade não se aplica mais: todo tenant que rodar este código é igreja. Decisão tomada com o usuário depois de eu sinalizar o conflito com a doc anterior. Slugs (`novo/em_andamento/ganho/perdido`) preservados, só o rótulo mudou — sem migration, sem campo novo. Afeta **todo funil novo criado manualmente em qualquer tenant**, não só o piloto. O gatilho SQL `fn_seed_default_pipeline_for_org` (que semeia "Carrinho abandonado" em org nova) não foi tocado nesta sessão — fica como pendência se quiser unificar.
- **CONFIRMADO — placeholder do título de lead:** `components/kanban/NewLeadDialog.tsx` trocou o exemplo `"combo presente"` (e-commerce) por `"pós-culto de domingo"`.
