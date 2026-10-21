# 08 — Pesquisa pós-culto: uma pergunta com 1, 2 e 3

Status: needs-info
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

## Blocked by: 02 e 03 (envio e leitura da resposta)

Seção 3b da spec. Disparo algumas horas depois do culto (padrão 2 h). Resposta **1** marca `presente`, **3** marca `faltou`, **2** pede o texto livre, registra, encerra e avisa quem foi escolhido (ticket 11). Sem resposta em 48 h, registra o silêncio. Dois cultos seguidos sem resposta (ou duas faltas seguidas) abrem atendimento no kanban.

## Aceite

- Números reconhecidos sem IA; texto livre nunca é pontuado.
- Marcar `presente`/`faltou` respeita a regra de calendário de `lib/escalas/status.ts` (só do dia do culto em diante).
- Idempotente: reprocessar não manda a pergunta duas vezes.

## Comments
