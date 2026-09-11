# tarefa-atual.md — Fase 0: Fundação

> Escopo fechado. Ler inteiro antes de começar. Qualquer coisa fora do "Escopo desta fase"
> não é pra fazer aqui, mesmo que pareça óbvio ou rápido — vira ruído na revisão do Claude.

## Objetivo desta fase

Sair de "DeskcommCRM genérico clonado" para "Cajado rodando, com vocabulário de igreja,
conectado ao WhatsApp de uma igreja piloto, com os três papéis básicos funcionando".
Nada de domínio novo (sem ministérios, sem escalas, sem jornada, sem EAD) — isso é fase 2+.
Aqui é só fundação.

## Pré-requisito antes de tocar em código

Consultar o MCP context7 pra confirmar a versão atual de Next.js, Supabase JS,
`@supabase/ssr` e demais libs do `package.json` do DeskcommCRM. Não assumir versão por
memória de treino. Se o context7 não tiver a lib ou vier incompleto, **parar e sinalizar**
antes de seguir com suposição — não é decisão pra tomar sozinho nesta fase.

## Escopo desta fase (fazer só isto)

### 1. Fork e ambiente
- [ ] Fork do `melgarafael/DeskcommCRM` para o repositório do Cajado
- [ ] Renomear o projeto: `package.json` (`name`), título do app, favicon/metadata básico
  — **não** mexer em lógica, só identidade
- [ ] Subir ambiente local: `.env.example` copiado e preenchido, Supabase local ou projeto
  de dev criado, migrations do `baseline.sql` aplicadas sem erro
- [ ] Confirmar que o app sobe (`npm run dev`) e a tela de login aparece sem erro de console

### 2. Vocabulário (jsonb, não código)
- [ ] Localizar onde o vocabulário de pipeline é definido/seedado (`vocabulary` jsonb —
  ver `supabase/baseline.sql`, coluna de pipelines)
- [ ] Trocar o vocabulário padrão do tenant seed/demo para o de igreja:
  - `lead` → `Visitante` / `lead_plural` → `Visitantes`
  - `deal` → `Acompanhamento`
  - `won` → `Membro` / `lost` → `Afastado`
  - `stage` → `Etapa da Jornada` / `stage_plural` → `Etapas`
- [ ] **Não** criar campo novo nem migration nova pra isso — o mecanismo de vocabulário
  configurável já existe, é só popular diferente
- [ ] Verificar que as telas que exibem esse vocabulário (kanban, listagem) refletem a
  troca sem quebrar nenhum texto hardcoded que não devia estar hardcoded (se achar um,
  anotar em `docs/decisoes.md` como pendência, não corrigir arquitetura aqui)

### 3. WhatsApp da igreja piloto
- [ ] Subir instância WAHA (seguir o setup já documentado no DeskcommCRM, não inventar
  configuração nova)
- [ ] Conectar o número da igreja piloto (QR pairing)
- [ ] Confirmar mensagem de teste indo e voltando (enviar pelo admin, receber e ver
  aparecer no inbox)
- [ ] Confirmar que o throttle/anti-banimento padrão do CRM está ativo (não desligar,
  não ajustar valores nesta fase)

### 4. Papéis (RBAC)
- [ ] Mapear os 3 papéis existentes pro nome de igreja, só como label de exibição:
  `admin` → "Pastor/Administrador", `manager` → "Líder de Ministério",
  `agent` → "Secretaria"
- [ ] Criar os usuários de teste da igreja piloto com esses papéis
- [ ] Confirmar que RLS/RBAC já herdado continua funcionando: um `manager` não vê o que
  não devia, um `admin` vê tudo — **não escrever teste novo de RLS aqui**, só confirmar
  manualmente que o comportamento herdado não quebrou com as mudanças acima

## Fora de escopo (não fazer nesta fase, mesmo que pareça fácil)

- Qualquer tabela nova (`ministries`, `scales`, `journey_events`, `courses`, etc.) — fica
  pra fase 2+
- Qualquer alteração no motor de fluxo (`lib/followup/`) — fica pra fase 1
- Qualquer tela nova fora do que já existe no CRM — nesta fase só troca texto/label
- Qualquer decisão de nomenclatura de schema que não esteja listada acima — se aparecer
  necessidade, **parar e sinalizar** em vez de decidir sozinho
- Deploy de produção — esta fase é ambiente de dev/staging

## Critério de pronto

- [ ] App sobe local sem erro
- [ ] Login funciona com os 3 papéis de teste
- [ ] Kanban/pipeline mostra vocabulário de igreja, não vocabulário de venda
- [ ] Mensagem WhatsApp de teste vai e volta pelo número da igreja piloto
- [ ] `docs/decisoes.md` atualizado com qualquer decisão tomada nesta fase (mesmo pequena)
- [ ] `docs/schema.md` **não muda** nesta fase — se mudou, é sinal de que saiu do escopo

## Copy e texto voltado ao usuário

Qualquer string nova voltada a pessoa (label de tela, mensagem de teste no WhatsApp) passa
pela skill `humanizer-pt-br` antes de considerar pronta. Nome de variável, comentário,
commit message ficam fora dessa regra.

## Quando parar e chamar o Claude Code

- Context7 não achou a lib ou veio incompleto
- Vocabulário hardcoded em lugar que deveria ser dinâmico (achado, não corrigido aqui)
- RLS/RBAC herdado parece ter quebrado com alguma mudança
- Qualquer dúvida sobre "isso é fundação ou já é domínio novo" — se está em dúvida, é sinal
  de que passou do escopo

## Modo de trabalho

Modo **caveman**: implementação direta, sem embelezar, sem refatorar o que já existe além
do necessário pro escopo acima. O Claude Code revisa depois (modo ponytail) — não adianta
o Codex tentar deixar tudo perfeito agora, é retrabalho se a revisão pedir outro caminho.
