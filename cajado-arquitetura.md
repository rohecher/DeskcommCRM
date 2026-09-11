# Cajado — Arquitetura sobre o DeskcommCRM

> Sistema operacional de cuidado pastoral. O DeskcommCRM vira a base; o Cajado é a
> camada de igreja. Comunicação 100% via WhatsApp conduzida por bots; app mobile leve
> só pra consulta; dashboard pra líderes e pastores acompanharem sem correr atrás.

---

## 0. Decisão fundadora

Não construir do zero. **Fazer fork/base do DeskcommCRM** e reescrever o vocabulário e
o domínio pra igreja. A razão é simples: a parte cara do Cajado — motor de fluxos de
decisão, WhatsApp bidirecional com anti-banimento, multi-tenancy com RLS testado em CI,
agente de IA que classifica resposta livre e alimenta dashboard — **já existe e roda**.
O que falta é o domínio de igreja (ministérios, escalas, jornada de vida, EAD), que é
trabalho de modelagem em cima de um chassi pronto, não de infraestrutura.

O que se **reaproveita** do CRM (não reescrever):

| Peça do CRM | Vira no Cajado |
|---|---|
| `organizations` + RLS por tenant | Cada igreja é um tenant isolado |
| Vocabulário configurável de pipeline (`vocabulary` jsonb) | "lead → Visitante", "won → Membro", "stage → Etapa da jornada" |
| Motor de fluxos visual (`lib/followup/` + React Flow) | Jornada do visitante/membro/voluntário desenhada em nós |
| Nó `ai_classify` | Captura e classifica resposta livre ("vai/não vai", "gostei/não gostei") |
| WAHA (`lib/waha/`, `lib/channels/adapters/waha.ts`) | Todo o canal WhatsApp: envio, recebimento, throttle, STOP |
| Automações QUANDO/SE/ENTÃO (`lib/automation/`) | Regras simples de gatilho (aniversário, tag, mudança de etapa) |
| Agente com RAG por tenant (`lib/ai/rag/`) | Bot que conversa, tira dúvida da igreja, move a pessoa de etapa |
| RBAC server-side (`admin`/`manager`/`agent`/`viewer`) | Pastor/líder/coordenador/voluntário |
| Customer 360 + métricas | Dashboard de acompanhamento de pessoas |
| MCP server interno (`app/api/mcp/`) | Tools que o bot chama: avançar jornada, confirmar escala |
| Audit log append-only + LGPD workers | Rastreabilidade e conformidade (dado sensível de fiel) |
| `@react-pdf/renderer` | Certificado de EAD |

O que é **domínio novo** (construir):

- Ministérios / áreas / funções
- Escalas (template recorrente, geração, confirmação, troca de vaga)
- Jornada de vida como configuração de fluxo (reusa o motor, mas precisa dos campos)
- EAD (cursos, módulos, aulas, provas, certificado)
- Check-in via QR Code
- App mobile de consulta (Expo)

---

## 1. Princípios de arquitetura

1. **A pessoa comum nunca precisa de app.** Visitante, membro e voluntário são atendidos
   pelo WhatsApp. O bot é a interface. O app é um **bônus de consulta**, não a porta de entrada.
2. **A comunicação é o produto; o app é acessório.** Toda a régua de relacionamento
   (confirmar escala, pesquisa pós-culto, cobrança de relatório, aviso, boas-vindas) vive
   em fluxos no WhatsApp.
3. **Resposta livre vira dado estruturado, sem digitação manual.** O `ai_classify` fecha
   o loop: a pessoa responde com o texto dela, o sistema classifica, o dashboard atualiza.
   O pastor não corre atrás — a informação chega curada.
4. **Um chassi, muitas igrejas.** Multi-tenant desde a fundação. O que é do CRM já é
   multi-tenant; o domínio novo nasce com `organization_id` e RLS.
5. **Fluxo é dado, não código.** Cada igreja desenha a própria jornada no builder visual.
   Trocar "Café Connect → Imersão → Batismo" por outro caminho é configuração.

---

## 2. Visão de camadas

```
┌────────────────────────────────────────────────────────────────┐
│  CANAIS (entrada/saída)                                        │
│  WhatsApp (WAHA)  ·  App mobile (Expo)  ·  Web admin (Next.js) │
└───────────────┬────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────┐
│  APP — Next.js 16 (App Router)  [herdado do DeskcommCRM]       │
│  UI (web admin) + Route handlers /api/v1/* + MCP + webhooks    │
│  proxy.ts (borda) → Zod → guard RBAC → resolveActiveOrg → RLS  │
└───────────────┬────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────┐
│  DOMÍNIO                                                        │
│  [herdado] pipelines · followup(fluxos) · ai/rag · automation  │
│  [novo]    ministerios · escalas · jornada · ead · checkin     │
└───────────────┬────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────┐
│  EVENTOS + WORKERS                                             │
│  event_log (Postgres) → cron drena → workers                  │
│  [herdado] ai-response · ai-sentiment · rag-indexer · lgpd     │
│  [novo]    escala-lembrete · pesquisa-pos-culto · aniversario │
└───────────────┬────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────┐
│  DADOS — Supabase Postgres + RLS (fn_user_org_ids)            │
│  Auth · Realtime · Storage                                    │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend

### 3.1 Stack (mantém o do CRM)

| Camada | Tecnologia | Origem |
|---|---|---|
| Runtime app | Next.js 16 App Router (route handlers) | herdado |
| Banco | Supabase Postgres 15 + RLS | herdado |
| Auth (liderança) | Supabase Auth + `@supabase/ssr`, MFA pra admin | herdado |
| Auth (app da pessoa) | Magic link via WhatsApp → sessão leve | **novo, simples** |
| Fila | `event_log` + cron drena workers | herdado |
| IA | Vercel AI SDK (Anthropic primário) + RAG pgvector | herdado |
| WhatsApp | WAHA Plus (NOWEB) | herdado |
| Cache/rate limit | Upstash Redis | herdado |
| Storage | Supabase Storage (avatar, QR, material EAD, certificado) | herdado |
| Push mobile | Expo Push | **novo** |

> **Sobre Cloudflare Workers + Hono do documento original do Volutariado:** cai fora.
> O DeskcommCRM já resolve o backend inteiro em Next.js. Não vale manter duas plataformas
> de backend. Cloudflare continua útil só como DNS/CDN e, se quiser, Storage de material
> estático pesado — mas a lógica vive no Next.

### 3.2 Modelo de papéis

O RBAC de 4 papéis do CRM mapeia direto. Não invente papéis novos sem necessidade:

| Papel CRM | Papel Cajado | Vê |
|---|---|---|
| `admin` | Pastor / Administrador | Tudo da igreja |
| `manager` | Líder de ministério / Coordenador | Sua área + pessoas sob cuidado |
| `agent` | Servo com função de secretaria / recepção | Fila de atendimento, cadastro |
| `viewer` | — (opcional) | Leitura de relatórios |

**A pessoa cuidada (visitante/membro/voluntário) NÃO é um "usuário" com login pleno.**
Ela é um **contato** (o `contacts` do CRM). Papel dela ("visitante", "membro", "voluntário")
é **estado na jornada**, não papel de RBAC. Isso evita o erro do documento original, que
misturava tudo num enum `role` só.

### 3.3 Vocabulário (a chave do multi-nicho vira multi-igreja)

O CRM guarda vocabulário por pipeline num jsonb. O padrão já existe:

```jsonc
// hoje (venda)
{ "lead": "Cliente", "won": "Pago", "stage": "Etapa" }

// Cajado (jornada de vida)
{
  "lead": "Visitante", "lead_plural": "Visitantes",
  "deal": "Acompanhamento", "won": "Membro", "lost": "Afastado",
  "stage": "Etapa da Jornada", "stage_plural": "Etapas"
}
```

Cada igreja pode ajustar (uma chama "Célula", outra "Pequeno Grupo"). Zero código novo:
é dado.

### 3.4 Domínio novo — schema

Todas as tabelas novas seguem as convenções não-negociáveis do `CLAUDE.md` do CRM:
`organization_id uuid not null`, RLS via `fn_user_org_ids()`, `created_at/updated_at`,
audit em mutação, dinheiro (se houver) em `_cents`.

```
── MINISTÉRIO ────────────────────────────────────────────
ministries       (organization_id, name, leader_user_id, min/max_volunteers, is_active)
areas            (organization_id, ministry_id, name, min/max_volunteers)
functions        (organization_id, area_id, name)
contact_ministry (organization_id, contact_id, ministry_id, area_id, function_id, status)
                 → liga a PESSOA (contato) ao ministério/área/função

── ESCALA ────────────────────────────────────────────────
events            (organization_id, name, type, start_time, end_time,
                   is_recurring, recurrence_rule jsonb /*RRULE*/)
event_occurrences (organization_id, event_id, date, status)
scale_templates   (organization_id, event_id, required_areas jsonb /*[{area_id,qty}]*/)
scales            (organization_id, template_id, occurrence_id, date, status /*draft|published|locked*/)
scale_assignments (organization_id, scale_id, contact_id, area_id, function_id,
                   status /*pending|confirmed|rejected|swap*/, confirmed_at)
scale_swaps       (organization_id, assignment_id, from_contact_id, to_contact_id, status)

── JORNADA ───────────────────────────────────────────────
(reusa pipelines/stages do CRM como espinha; estas complementam)
journey_events    (organization_id, contact_id, kind, step_ref, payload jsonb, occurred_at)
                  → timeline de vida da pessoa (check-in, batismo, avançou etapa…)
checkins          (organization_id, contact_id, type, event_occurrence_id nullable,
                   method /*qr|manual|app*/, checked_at)

── EAD ───────────────────────────────────────────────────
courses      (organization_id, name, required_for_step nullable, order)
modules      (organization_id, course_id, name, order)
lessons      (organization_id, module_id, title, content_type /*video|text|pdf*/,
              content_url, content_text, order)
exams        (organization_id, module_id, pass_score /*default 70*/)
exam_questions (organization_id, exam_id, prompt, options jsonb, correct_index)
contact_progress (organization_id, contact_id, lesson_id, completed_at)
contact_exam_attempts (organization_id, contact_id, exam_id, score, passed, attempted_at)
certificates (organization_id, contact_id, course_id, pdf_url, issued_at)
```

**Nota de convenção:** o CRM tem 89 handlers usando `createAdminClient` (service role, bypassa
RLS) protegidos por revisão humana, não por lint. Ao criar handlers novos do domínio de
igreja, resolver `organization_id` **sempre de fonte confiável** (cookie/JWT/token de webhook),
**nunca do body**. É a regra de ouro herdada — quebrá-la é vazamento entre igrejas.

### 3.5 Estender o motor de fluxo (a única mudança no core herdado)

O nó `condition` do motor de fluxo hoje só enxerga campos de venda
(`lead_stage`, `tag`, `steps_taken`, `last_outcome`). Pro Cajado, estender o enum em
`lib/followup/graph-schema.ts` (+ leitura em `node-handlers.ts`) pra incluir:

```
journey_step        (etapa atual da pessoa)
ministry_status     (ativo/inativo num ministério)
scale_status        (confirmado/recusado na escala do dia)
training_status     (aprovado/reprovado/em curso)
presence_last_event (esteve/faltou no último culto)
```

É mudança **localizada e aditiva** — não reescreve o motor, só amplia o que ele sabe ler.

### 3.6 MCP tools novas (o que o bot sabe fazer)

O CRM expõe o sistema como tools MCP pro agente. Adicionar as do domínio de igreja:

```
avancar_jornada(contact_id, para_etapa)
confirmar_escala(assignment_id) / recusar_escala(assignment_id, motivo?)
abrir_troca_de_escala(assignment_id)
registrar_checkin(contact_id, tipo, evento?)
matricular_em_curso(contact_id, course_id)
registrar_resposta_pesquisa(contact_id, pesquisa, resultado)
sinalizar_para_lider(contact_id, motivo)   ← quando o bot detecta algo que precisa de humano
```

O `sinalizar_para_lider` é o coração pastoral: quando a IA percebe desânimo, ausência
repetida ou pedido de ajuda, ela não resolve sozinha — abre um caso pro líder. É o mesmo
padrão de handoff IA→humano que o CRM já tem, renomeado.

---

## 4. Os fluxos de relacionamento (o que você descreveu)

Cada um destes é um grafo no builder visual. Nós disponíveis:
`trigger · wait · condition · ai_classify · action(template|ai_message) · end`.

### 4.1 Confirmação de escala

```
trigger: escala publicada
  → action[template]: "Você está escalado pro culto de domingo (Louvor). Confirma? Responde SIM ou NÃO."
  → wait[fixed 24h]
  → ai_classify [classes: confirma, recusa, ambiguo]
       ├ confirma → confirmar_escala → end(confirmado)
       ├ recusa   → recusar_escala + abrir vaga + sinalizar_para_lider → end(recusado)
       └ ambiguo/timeout → action[ai_message: "reforça com gentileza pedindo um sim ou não"]
                          → wait[fixed 6h] → se nada → sinalizar_para_lider → end(sem_resposta)
```

### 4.2 Pesquisa "servir no dia seguinte" / pós-culto

```
trigger: culto encerrado + 2h
  → action[ai_message: "pergunta de forma leve se foi ao culto e o que achou"]
  → wait[smart min 2h max 48h]
  → ai_classify [classes: positivo, negativo, nao_foi, sem_resposta]
       ├ positivo → action[template: agradece] → end
       ├ negativo → registrar_resposta_pesquisa + sinalizar_para_lider → end
       ├ nao_foi  → registrar ausência + (se 2ª seguida) sinalizar_para_lider → end
       └ sem_resposta → end(silencio)  ← o silêncio também é dado
```

### 4.3 Cobrança de relatório do líder

```
trigger: recorrente (toda segunda 9h)
  → action[template: "Bom dia! Como foi o ministério neste fim de semana? Me manda um resumo."]
  → wait[fixed 48h]
  → ai_classify [classes: relatorio_completo, relatorio_parcial, sem_resposta]
       ├ completo → extrai e grava → end
       ├ parcial  → action[ai_message: pede o que faltou] → wait → end
       └ sem_resposta → escala pro pastor → end
```

### 4.4 Jornada de vida do visitante (a esteira principal)

```
trigger: novo visitante cadastrado (QR ou recepção)
  → action[template: boas-vindas + convite Café Connect]
  → wait[smart]
  → ai_classify [vai, nao_vai, sem_resposta]
       ├ vai → aguarda check-in → se compareceu → avancar_jornada(Imersão)
       ├ nao_vai → nutre → reoferece em 7 dias
       └ sem_resposta 7d → sinalizar_para_lider("visitante esfriando")
  → ... (Imersão → Batismo/Membro → Convite voluntariado → Treinamento → Ativo)
```

Cada igreja edita essa esteira. É a jornada configurável do documento original, só que
rodando num motor que já existe em vez de um que você teria que escrever.

### 4.5 Aniversário

Não precisa de fluxo do builder — é automação simples QUANDO/SE/ENTÃO já existente:
`QUANDO data = aniversário ENTÃO enviar WhatsApp + avisar líder`.

---

## 5. Frontend

### 5.1 Web admin (líderes e pastores) — herda do CRM

Já existe base (inbox, kanban, dashboards, gestão de time). Estender com telas do domínio:

```
web (Next.js — o próprio app do CRM):
  /app/dashboard              [herdado, adaptar]  visão pastoral: pessoas, jornada, saúde
  /app/inbox                  [herdado]           conversas WhatsApp ao vivo
  /app/jornada                [herdado, kanban]   pipeline = etapas da jornada de vida
  /app/fluxos                 [herdado]           builder visual dos fluxos de relacionamento
  /app/pessoas                [herdado, contatos] cadastro + customer 360 (agora "membro 360")
  /app/ministerios            [NOVO]              ministérios, áreas, funções, voluntários
  /app/escalas                [NOVO]              calendário, templates, gerar, confirmar, trocas
  /app/eventos                [NOVO]              cultos/eventos recorrentes (RRULE)
  /app/ead                    [NOVO]              cursos, módulos, aulas, provas, turmas
  /app/relatorios             [herdado, estender] frequência, aniversários, engajamento
  /app/config                 [herdado]           vocabulário, papéis, número WhatsApp, templates
```

**Dashboard pastoral** (a peça que você mais quer): não é dashboard novo do zero. É o
customer 360 + métricas do CRM apontados pros outcomes dos fluxos. Cartões-alvo:

- Visitantes que esfriaram (sem resposta há N dias)
- Taxa de confirmação de escala da semana
- Ausências consecutivas (quem sumiu do culto)
- Pessoas sinalizadas pra cuidado pastoral (fila de `sinalizar_para_lider`)
- Progresso da jornada por etapa (funil)
- Aniversariantes do mês

### 5.2 App mobile (a pessoa) — Expo, leve

**Escopo deliberadamente pequeno.** O app NÃO é onde a comunicação acontece — é consulta.

```
mobile (Expo + Expo Router):
  (auth)
    login.tsx      → digita telefone → recebe magic link no WhatsApp → entra
                     (SEM OTP custom, SEM senha; a sessão é leve e curta)
  (tabs)
    index.tsx      → minha próxima escala, minha etapa na jornada, avisos
    escala.tsx     → minhas escalas; botão CONFIRMAR / MARCAR AUSÊNCIA / PEDIR TROCA
    jornada.tsx    → onde estou na jornada de vida (read-only, motivacional)
    ead.tsx        → meus cursos, aulas (vídeo), provas
    perfil.tsx     → meus dados, avatar
  qrcode.tsx       → meu QR de check-in
```

Stack mobile: Expo Router · React Query (server state) · Zustand (estado local) ·
expo-secure-store (token) · expo-camera (QR) · Expo Push. Sem Tamagui obrigatório —
NativeWind mantém consistência com o Tailwind do web.

> **Por que não OTP custom como no doc original:** OTP + JWT ES256 + blacklist em KV +
> refresh rotation é muita engenharia de auth pra um app que só mostra escala. Magic link
> via WhatsApp (a pessoa clica num link que o bot manda) dá sessão suficiente com uma
> fração do código, e reaproveita o canal WhatsApp que já existe.

### 5.3 Check-in por QR

Rota pública no Next (padrão dos webhooks de captação que o CRM já tem):
`POST /api/v1/checkin/[token]` — o QR do culto/aula aponta pra cá, a pessoa escaneia pelo
app, registra presença. Presença é gatilho de fluxo (avança jornada, conta pra frequência).

---

## 6. Eventos e workers novos

Seguindo o padrão do CRM (`event_log` + cron drena, trigger Postgres nunca faz HTTP):

```
escala-lembrete.worker      → 24h antes do evento, dispara fluxo de confirmação
pesquisa-pos-culto.worker   → após event_occurrence.status=completed, dispara pesquisa
aniversario.worker          → varre aniversariantes do dia
jornada-silencio.worker     → detecta quem não responde há N dias → sinaliza
ead-liberacao.worker        → aprovado na prova → libera próximo módulo / avança jornada
certificado.worker          → curso completo → gera PDF (@react-pdf/renderer) → Storage
```

---

## 7. Segurança e LGPD (dado de fiel é sensível)

Herda tudo do CRM e reforça:

- RLS em toda tabela nova (isolamento entre igrejas testado como gate de CI — o CRM já faz
  isso com 56 arquivos de invariante; as tabelas novas entram nesse mesmo teste).
- Audit append-only em mutação (quem moveu quem na jornada, quem viu dado de quem).
- LGPD: export e anonimização já existem como workers. Dado religioso é **sensível** pela
  LGPD (art. 5º, II) — a base de anonimização-preferida-sobre-delete do CRM já está alinhada.
- **Atenção herdada:** rate limit do CRM cobre poucos endpoints. Pro Cajado, garantir rate
  limit no `login` (magic link) e no `checkin` público antes de produção.

---

## 8. Roadmap sugerido

Diferente do documento original (que começava pelo app e pelo auth), aqui a ordem segue o
valor: **primeiro o que já existe rende, depois o domínio novo, o app por último.**

### Fase 0 — Fundação (1–2 semanas)
- [ ] Fork/base do DeskcommCRM, subir ambiente
- [ ] Trocar vocabulário pra igreja (Visitante/Membro/etapas)
- [ ] Conectar WhatsApp (WAHA) da igreja piloto
- [ ] Papéis: pastor/líder/secretaria

### Fase 1 — Relacionamento no WhatsApp (2–3 semanas) ← entrega valor cedo
- [ ] Estender `condition` node com campos de igreja
- [ ] Desenhar fluxo de jornada do visitante
- [ ] Fluxo de pesquisa pós-culto
- [ ] Dashboard pastoral v1 (esfriando, sinalizados, funil de jornada)
- [ ] Automação de aniversário

### Fase 2 — Ministérios e escalas (3–4 semanas)
- [ ] Schema ministérios/áreas/funções + telas admin
- [ ] Schema escalas + gerador + templates
- [ ] Fluxo de confirmação de escala (WhatsApp)
- [ ] Fluxo de cobrança de relatório do líder
- [ ] MCP tools: confirmar/recusar/trocar escala

### Fase 3 — App mobile de consulta (2–3 semanas)
- [ ] Auth magic-link via WhatsApp
- [ ] Tabs: home, escala (confirmar/ausência), jornada, perfil
- [ ] Check-in por QR
- [ ] Push Expo

### Fase 4 — EAD (3–4 semanas)
- [ ] Cursos/módulos/aulas/provas
- [ ] Liberação progressiva + nota mínima
- [ ] Certificado PDF
- [ ] Gate de jornada por curso concluído

### Fase 5 — Polish e piloto (2 semanas)
- [ ] Relatórios avançados de engajamento
- [ ] Rate limit nos endpoints públicos
- [ ] Testes E2E das jornadas críticas
- [ ] Piloto real na Avivar

---

## 9. Riscos e decisões em aberto

1. **Épico de fluxos ainda em desenvolvimento no CRM.** A "Onda 8" do follow-up está
   marcada como em andamento na doc interna. Ler o `HANDOFF.md` antes de apostar tudo —
   pode faltar o gatilho por mudança de etapa, que é central pra jornada.
2. **Escala é o domínio mais complexo e genuinamente novo.** Não tentar encaixar no kanban.
   Modelo de dados próprio (template recorrente + geração + troca de vaga).
3. **Fork vs. base viva.** Decidir se o Cajado é um fork que diverge do CRM ou se você
   mantém sincronia com o upstream. Fork diverge rápido; base viva exige disciplina de manter
   o domínio de igreja isolado em pastas próprias (`lib/ministerios`, `lib/escalas`, `lib/jornada`).
4. **EAD por WhatsApp não funciona bem.** Vídeo e prova exigem tela — por isso EAD é a única
   parte que **precisa** do app (ou de uma view web mobile). Confirma que é assim que você quer.
5. **Custo do WhatsApp em escala.** WAHA (não-oficial) é barato mas tem risco de banimento;
   o CRM já mitiga com throttle/jitter/janela. Pra muitas igrejas, avaliar migrar pro Meta
   Cloud API (o CRM já tem adapter `meta-cloud.ts`).

---

## 10. Ambiente de desenvolvimento — três modelos no CLI

A divisão de trabalho que você definiu, com o estado atual das ferramentas (ago/2026):

| Papel | Ferramenta | Modelo | Quando usar |
|---|---|---|---|
| Arquitetura e revisão | **Claude Code** | Opus | Schema, decisão estrutural, revisão de PR, edge case difícil (modo *ponytail*) |
| Implementação em massa | **Codex CLI** | GPT-5.x | Execução fase por fase guiada por AGENTS.md (modo *caveman*) |
| Válvula de cota | **OpenCode Go** | GLM-5.2 | Quando Claude ou Codex batem no teto — segue trabalhando sem esperar reset |

### 10.1 Claude Code + Codex simultâneos

Os dois são CLIs independentes; rodar em paralelo é só uma questão de terminais separados.
O jeito prático é um multiplexer (tmux) ou dois painéis do terminal:

```bash
# painel 1 — Claude Code (arquitetura/revisão)
cd ~/cajado && claude

# painel 2 — Codex (implementação da fase atual)
cd ~/cajado && codex
```

Convenção pra não pisarem um no outro no mesmo repo:
- **Claude Code** trabalha na branch de arquitetura/revisão e nos `docs/` (decisões, schema).
- **Codex** trabalha na branch da fase corrente, seguindo o `AGENTS.md` daquela fase.
- Commits pequenos e frequentes; o Claude revisa o que o Codex produziu antes do merge.
- `git worktree` é o truque que evita conflito: cada CLI num worktree/branch diferente do
  mesmo repositório, sem um sobrescrever o arquivo aberto do outro.

```bash
# um worktree por frente de trabalho
git worktree add ../cajado-impl feature/fase-2-escalas   # Codex trabalha aqui
git worktree add ../cajado-arch  chore/revisao           # Claude Code aqui
```

### 10.2 GLM-5.2 como válvula de cota

O GLM-5.2 (Z.ai, aberto sob MIT, contexto de ~1M tokens) expõe endpoint compatível com a
API da Anthropic, então dá pra usá-lo **dentro do próprio Claude Code** trocando só a
variável de ambiente — ou via OpenCode Go, que foi o caminho de $10/mês que você citou.

Dois caminhos, escolha um:

**A) OpenCode Go ($5 no 1º mês, depois $10/mês)** — CLI própria (escrita em Go), traz um
bundle de modelos abertos (GLM-5.2, DeepSeek, Qwen, Kimi) com cota em valor de dólar:
```bash
# dentro do OpenCode (TUI)
/connect        # escolhe OpenCode Go, cola a API key do OpenCode Zen
/models         # lista os modelos; seleciona glm-5.2
```

**B) GLM Coding Plan da Z.ai (a partir de $18/mês, Lite)** — se quiser GLM direto no
Claude Code, aponta o `ANTHROPIC_BASE_URL` pro endpoint da Z.ai:
```bash
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="<sua-chave-z.ai>"
claude --model glm-5.2
```

> Diferença prática: OpenCode Go é mais barato ($10) e dá variedade de modelos, mas é
> outra CLI. O plano Z.ai custa mais ($18 Lite) porém roda dentro do Claude Code que você
> já conhece. Pra "válvula de cota" pura, o OpenCode Go de $10 é o que fecha com o que
> você descreveu.

**Regra de ouro:** GLM entra como escape de cota pra tarefa rotineira. Arquitetura e
revisão continuam no Opus — não terceirize decisão estrutural pro modelo mais barato.

### 10.3 AGENTS.md por fase

Cada fase do roadmap (seção 8) ganha um `AGENTS.md` que o Codex segue. É o padrão que você
já usa: escopo fechado, critério de pronto explícito, e o Claude Code revisa a saída. O
`CLAUDE.md` do repositório fica com as regras permanentes (context7 antes de lib, humanizer
em copy, modos caveman/ponytail/improve); o `AGENTS.md` fica com a tarefa da vez.

---

## 11. Resumo de uma frase

O Cajado é o DeskcommCRM com o vocabulário e o domínio trocados de "vender" para "cuidar":
o mesmo motor que qualifica um lead e o move no funil passa a acompanhar um visitante e a
conduzi-lo até voluntário ativo — capturando cada resposta, sinalizando o que precisa de um
pastor, e deixando a tecnologia chegar onde o tempo do líder não alcança.
