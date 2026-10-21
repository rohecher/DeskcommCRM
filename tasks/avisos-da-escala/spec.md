# Spec — Avisos da escala (WhatsApp e push no app)

Status: needs-triage
Origem: decisão do Roberto em 2026-10-21 ("divulgação é prioridade: notificação via zap — confirmação, alteração etc. — e push no app"). Substitui a exportação para planilha (`tasks/exportar-escala-planilha/`, pausada).
Marcação: **CONFIRMADO** = lido no repositório; **INFERIDO** = dedução; **DECISÃO** = precisa do Roberto.

## 1. Decisões já tomadas (2026-10-21)

1. A escala **não é exportada** por ora. A divulgação é por aviso.
2. **O mês inteiro é aprovado** de uma vez, e a aprovação do mês é o gatilho do primeiro aviso.
3. **Vaga sem nome fica em aberto**, e pode virar **sugestão para o próprio voluntário se oferecer**. Sugestão, não ocupação automática: a liderança decide.
4. Os canais pedidos são o **WhatsApp** (confirmação, alteração, etc.) e o **push no app**.

## 2. O que já existe (CONFIRMADO, 2026-10-21)

| Peça | Estado |
|---|---|
| Voluntário ligado ao CRM | `escala_voluntarios.contact_id` (FK para `contacts`, `on delete set null`) e `telefone`. O comentário da migration 0145 diz: "liga no CRM para o bot achar o WhatsApp" |
| Status da vaga | `escalado`, `confirmado`, `troca_solicitada`, `presente`, `faltou` (migration 0149, `lib/escalas/status.ts`), marcados hoje **à mão pela liderança** |
| Aprovar/publicar o mês | Ação de publicar o mês em `app/app/escalas/_acoes.ts`, com auditoria `escala.mes_publicado` |
| Envio de WhatsApp | `lib/waha/send.ts` e o `sendMessageHandler` do agent-engine (fila, ack, retentativa). Anti-banimento em `lib/waha/throttle.ts` (1 msg a cada 1,2 s mais jitter) |
| Opt-out | `lib/waha/stop-detection.ts` (`STOP`, `PARAR`, `SAIR`) bloqueia o contato |
| **Push no app** | **Não existe.** Sem service worker, sem manifest, sem biblioteca de push. O upstream tem um pacote de PWA e push (mais de 100 arquivos) que o fork nunca recebeu e que depende do i18n |
| Aviso dentro do app | A Central (`agent_inbox_items`) já recebe avisos do sistema, como `message_send_stuck` |

## 3. Desenho em fases

**Fase 1: WhatsApp, o aviso que a liderança pediu.**
- **1a. Convocação ao aprovar o mês.** Cada voluntário recebe uma mensagem com os seus dias e funções do mês e o pedido de confirmação.
- **1b. Resposta do voluntário.** "Confirmo" ou "preciso trocar" muda o status da vaga (`confirmado` ou `troca_solicitada`). Resposta que o sistema não entende vai para a Central da liderança, nunca se perde.
- **1c. Aviso de alteração.** Depois do mês aprovado, trocar a pessoa de uma vaga ou mudar o culto avisa quem entrou e quem saiu.
- **1d. Lembrete antes do culto** (opcional, pergunta 3).

**Fase 2: vaga em aberto vira convite.** Para vaga sem nome, convidar voluntários elegíveis. "Sim, posso" vira uma **sugestão** que a liderança aprova na tela (`escala_slots` não é preenchida sozinha).

**Fase 3: aviso dentro do app.** Realtime e a Central, sem service worker. Barato e funciona com o app aberto.

**Fase 4: push de verdade (PWA).** Só depois, e só se a Fase 1 e a 3 não bastarem. Custo alto e sem base no fork.

### 3a. Quem recebe e em que ritmo (decisão de 2026-10-21)

- **Escopo semanal.** O disparo vai **só para quem está na escala da semana**, e não para o mês inteiro. O mês continua sendo aprovado de uma vez; a convocação é que sai semana a semana. Hoje são cerca de 35 pessoas por culto, mas a conta precisa valer para uma igreja de 1.500 voluntários.
- **O ritmo se calcula.** `lib/escalas/disparo.ts` (feito, 10 testes): `capacidadePorHora` = o menor entre o teto configurado (padrão 25) e o limite diário do número dividido pelas horas da janela (300 por dia em 15 horas = 20 por hora). `planejarDisparo` distribui as mensagens em **blocos por hora**, na janela de 7h às 22h e **sem domingo**, e devolve quando termina e **se cabe no prazo**. Se não couber, o plano **diz isso à liderança** em vez de estourar o ritmo.
- **Mostrado antes de enviar:** "N pessoas vão receber. Começa em X e termina em Y."
- **Padrões a confirmar:** a convocação da semana abre **segunda às 7h**; o prazo para terminar é **24 horas antes do primeiro culto da semana**. Ambos ficam na tela de avisos.
- O envio continua passando pelo que já existe: janela, limite diário, espaçamento (5 s em envio em massa), `PARAR`.

### 3b. Pesquisa pós-culto (decisão de 2026-10-21)

Desenho-base: `cajado-arquitetura.md` §4.2. Decidido com o Roberto:

- **Uma pergunta só**, com resposta por número (regra simples, sem IA): "Deu tudo certo no seu serviço de domingo? 1 (sim, tudo certo), 2 (tive dificuldade) ou 3 (não consegui ir)."
- **1** marca a vaga como `presente`. **3** marca `faltou`. Hoje a liderança marca isso à mão.
- **2** pede uma segunda mensagem: "O que aconteceu? Pode escrever do seu jeito." A resposta em texto livre **só é registrada**, a conversa **termina** e as **pessoas escolhidas são avisadas**. Sem pontuação por IA.
- **Sem resposta em 48 horas:** o silêncio é registrado (é dado).
- **Dois cultos seguidos** sem resposta, ou duas faltas seguidas, abrem um **atendimento no kanban** (regra do Roberto de 2026-10-21 e do desenho original).
- Dispara algumas horas depois do culto (padrão: 2 h, parametrizável).

### 3c. Configurações dos avisos (uma tela só: `/app/escalas/avisos`)

Cada seção nasce **junto com o aviso que a lê**, nunca antes (configuração sem consumidor engana). Tudo em `escala_config`, chave `avisos`, validado com Zod, com padrões que funcionam sem configurar, só gerente ou mais edita, com auditoria e "voltar ao padrão".

- **Número** (feito). **Quando avisar**: convocação, lembretes (um dia antes, no dia), pesquisa pós-culto, troca urgente no dia. **Por onde**: WhatsApp; push desabilitado ("em breve"). **Quando ninguém responde**: quantos cultos seguidos. **Quem é avisado**: escolhido **pelo cadastro** (ver ticket 11).
- **Textos fixos e humanizados** no começo; editáveis só se a liderança pedir. O ritmo de envio, a janela de 7h a 22h e o `PARAR` **não** são configuráveis: protegem o número da igreja.

## 4. Restrições que valem para tudo

- **Trigger nunca faz HTTP.** O aprovar do mês emite linha em `event_log`; um worker consome e envia (doutrina do `CLAUDE.md`).
- **Idempotência.** Aprovar duas vezes ou o worker reiniciar não pode mandar a mesma convocação duas vezes (`unique (organization_id, external_id)` e captura `23505`).
- **Anti-banimento.** Throttle, janela 7h a 22h e evitar domingo; um mês aprovado com 100 voluntários vira uma fila de minutos, não um disparo único.
- **Opt-out e LGPD.** Quem mandou `PARAR` nunca recebe. O telefone foi dado para a escala: a finalidade do aviso precisa estar dentro disso. Toda mensagem enviada grava auditoria.
- **Texto de tela e de mensagem** passa pelo `humanizer-pt-br`, com o vocabulário de igreja (`docs/escalas-glossario.md`). Nome de pessoa nunca é reescrito.
- **Sistema vivo.** Voluntário que não responde em N dias não some: aparece na Central da liderança com o próximo passo.
- **Nada de nome real** em fixture ou teste (fork público).

## 4b. Respostas do Roberto (2026-10-21)

1. **Número do aviso:** uma **tela para vincular o número** usado nos avisos. Feita: `/app/escalas/avisos` (ticket 01, abaixo).
2. **Domingo:** sim, aviso de troca **urgente do próprio dia** pode sair no domingo, entre 7h e 22h.
3. **Lembrete parametrizável:** um dia antes, no dia, e **pesquisa pós-culto**. Cada um liga e desliga, com a antecedência configurável.
4. **Sem resposta:** **dois cultos seguidos sem resposta** abrem um **atendimento no kanban** (não só um aviso na Central).
5. **Consentimento (pergunta 8):** sim, os voluntários **já concordaram** em receber aviso por WhatsApp. A primeira mensagem é a própria convocação, sem pedir permissão antes. O `PARAR` continua valendo.
6. **Pergunta 5 da seção abaixo (telefones):** ainda sem contagem (ticket 01 da lista antiga).

## 5. Perguntas abertas (`needs-info`; "não sei" é aceito)

1. **De qual número sai o aviso?** O mesmo WhatsApp do atendimento da igreja ou um número só da escala? Muda o risco de banimento do número principal.
2. **Domingo.** A regra anti-banimento diz evitar domingo, e o culto é domingo à noite. O aviso de alteração urgente pode sair no domingo? Sugiro: só alteração urgente de culto no mesmo dia, em janela de 7h a 22h.
3. **Lembrete antes do culto**: sim ou não, e quando (véspera? no dia?).
4. **Prazo de resposta**: depois de quantos dias sem resposta o voluntário aparece na Central? Sugiro 3 dias.
5. **Todos os voluntários têm telefone?** Eu não vejo os dados reais; precisa de uma contagem de quantos têm `telefone` e `contact_id`.
6. **Quem aprova a sugestão de vaga em aberto**: o líder do setor ou a liderança geral?
7. **Push**: a Fase 4 (PWA) pode ficar para depois da Fase 3?
8. **Consentimento**: os voluntários já aceitaram receber aviso por WhatsApp? Se não, a primeira mensagem tem de pedir.

## 6. Critérios de aceite da Fase 1

- Aprovar o mês enfileira exatamente **uma** convocação por voluntário com telefone, e nenhuma para quem pediu `PARAR`.
- A resposta "confirmo" muda a vaga para `confirmado`; "preciso trocar" para `troca_solicitada`; texto não entendido cria aviso na Central.
- Reprocessar o worker não duplica mensagem (teste de idempotência).
- Dois tenants não se enxergam (teste de isolamento).
- Provado **pela tela e por um receptor real**, num banco fresco, com WAHA local (doutrina de QA visual). Mock não conta.
- `pnpm test:db` verde.

## 7. Laço de retorno (invariante 7)

Se o aviso sai errado ou não chega, a liderança volta a avisar no grupo à mão. O sinal é a Central: aviso que falhou ou voluntário sem resposta aparece lá, com o motivo.

## Progresso

- **Número dos avisos (decisão 1): feito** em `feat/aviso-numero-da-escala`. Guarda o id da sessão em `escala_config.aviso_canal_id`, sem migration. `lib/escalas/aviso.ts`, ação `salvarCanalDeAviso`, tela `/app/escalas/avisos`. Falta provar **pela tela** com Playwright num banco fresco (doutrina de QA visual).
- Próximo: convocação ao aprovar o mês (ticket 02), que **lê esse número** e não envia nada se ele não estiver escolhido.

