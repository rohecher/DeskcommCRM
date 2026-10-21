# 11 — Escolher quem a liderança avisa, pelo cadastro

Status: needs-triage
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

## Blocked por: pergunta abaixo

Quando alguém responde "tive dificuldade", **as pessoas escolhidas** recebem o aviso com o texto. A escolha é feita na tela de avisos, **a partir do cadastro** (nomes, não números digitados). Sem ninguém escolhido, o aviso vai para a Central, para nada se perder.

## Decisão do Roberto (2026-10-21)

O cadastro é o dos **Filhos que Servem** (voluntários e líderes com telefone). Dá para escolher **mais de uma pessoa**: a escolha guardada é uma lista de ids, e todas recebem o aviso. Sem ninguém escolhido, o aviso vai para a Central, para nada se perder.

## Aceite

- Lista só mostra quem tem telefone ou contato; aceita várias pessoas e remove duplicadas. Escolha guardada por id, nunca por nome. Isolamento entre organizações testado.

## Comments
