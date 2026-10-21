# 02 — Função pura que monta o modelo da planilha (regra + paridade)

Status: wontfix
Type: task
Spec: `tasks/exportar-escala-planilha/spec.md`

## O que fazer

`lib/escalas/planilha.ts`: `montarPlanilhaDoMes(cultos, setoresOff, louvor)` devolve abas e linhas. Regras do item 3 da spec: nome da aba, título com horário, vaga vazia `—`, setor desligado `NÃO HAVERÁ` + motivo, ordem de leitura da liderança, rótulos via `bonito`, seção do louvor com paleta, quantidade por dia. Devolve também os **avisos** (vagas sem nome por culto, cultos sem louvor).

## Aceite

- Teste de paridade com um mês de fixture em **pseudônimos**, contra a saída do Python (gerar o `esperado` uma vez, como no `escalas-paridade`).
- Nome de pessoa nunca passa por `bonito`.
- Sem I/O. Sem nome real no repositório.

## Comments

- 2026-10-21: pausado. A divulgação deixou de ser por planilha (ver spec, "Decisão de 2026-10-21").
