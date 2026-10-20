# 09 — Mensagem junto da passagem para humano não derruba mais a trava do contato

Status: ready-for-agent
Type: task
Origem: https://github.com/melgarafael/DeskcommCRM/pull/2969 (merge `cc9c4f42b`, issue #2884), relatório de 2026-10-20 (avaliação dos 9 itens que aplicam limpo)
Zona: amarela (migration + baseline)
Valor: bot-comunicacao e confiabilidade

## Por que traz

Quando uma mensagem chega no mesmo instante em que o contato é passado para humano, o banco podia derrubar uma das duas operações por travamento mútuo. Se a derrubada fosse a passagem para humano, **a trava não era gravada e o agente seguia respondendo** a quem já devia estar com uma pessoa. É o cuidado pastoral falhando em silêncio. Agora as duas seguem a mesma ordem de locks.

## O que toca

Migration `20261019000000_0681_uma_ordem_de_locks_para_marcar_mensagem_e_travar_o_contato.sql`, `supabase/baseline.sql`, teste de invariante.

## Risco e conflito esperado

A migration precisa de **número novo** (a `0681` do upstream vira a próxima do fork, hoje `0150`, ou a seguinte se o ticket do nome do celular for antes). Entra no `baseline.sql` como apêndice **antes** do bloco `VARREDURA anon`, com linha no `MANIFEST.md` e `revoke` das duas origens de EXECUTE em função nova. Função em `public` nasce exposta: seguir o item 9 da doutrina de migrations. Risco médio (schema).

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada.
2. Ler a migration e o diff do baseline; **reescrever** como migration do fork + apêndice idempotente (não cherry-pick do baseline).
3. Conferir `revoke execute ... from public, anon` em toda função tocada.

Gates, com o `.env` fora do caminho: `pnpm gov:verify` **e `pnpm test:db`** (install + update + invariantes, incluindo a varredura de anon). PR para a `cajado`; o merge faz deploy.

## Comments
