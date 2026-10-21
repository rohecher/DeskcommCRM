# 01 — Escolher e instalar a biblioteca de planilha

Status: wontfix
Type: task
Spec: `tasks/exportar-escala-planilha/spec.md`

## O que fazer

Recomendação da spec: **ExcelJS**. Conferir a versão atual no Context7 e rodar `pnpm audit` nela; **não** usar o pacote `xlsx` (SheetJS no npm), que está parado e teve alertas. Instalar com `pnpm add`, sem mexer em mais nada.

## Aceite

- `package.json` e lockfile com a biblioteca; `pnpm gov:verify` verde; `pnpm audit` sem alerta de runtime novo.
- Lembrar: o `pnpm` local expira na rede desta máquina. Se acontecer, usar o workflow `atualizar-dependencia` (pacote e versão exata).

## Comments

- 2026-10-21: pausado. A divulgação deixou de ser por planilha (ver spec, "Decisão de 2026-10-21").
