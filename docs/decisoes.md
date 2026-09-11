# Decisões

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
