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

## 4. Restrições que valem para tudo

- **Trigger nunca faz HTTP.** O aprovar do mês emite linha em `event_log`; um worker consome e envia (doutrina do `CLAUDE.md`).
- **Idempotência.** Aprovar duas vezes ou o worker reiniciar não pode mandar a mesma convocação duas vezes (`unique (organization_id, external_id)` e captura `23505`).
- **Anti-banimento.** Throttle, janela 7h a 22h e evitar domingo; um mês aprovado com 100 voluntários vira uma fila de minutos, não um disparo único.
- **Opt-out e LGPD.** Quem mandou `PARAR` nunca recebe. O telefone foi dado para a escala: a finalidade do aviso precisa estar dentro disso. Toda mensagem enviada grava auditoria.
- **Texto de tela e de mensagem** passa pelo `humanizer-pt-br`, com o vocabulário de igreja (`docs/escalas-glossario.md`). Nome de pessoa nunca é reescrito.
- **Sistema vivo.** Voluntário que não responde em N dias não some: aparece na Central da liderança com o próximo passo.
- **Nada de nome real** em fixture ou teste (fork público).

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
