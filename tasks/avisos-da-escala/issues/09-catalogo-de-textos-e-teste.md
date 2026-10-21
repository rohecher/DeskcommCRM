# 09 — Um arquivo com todos os textos dos avisos e o teste que os vigia

Status: done
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

## Blocked by: nada (pode andar sozinho)

`lib/escalas/textos-de-aviso.ts` com **todas** as mensagens (convocação, lembretes, pesquisa, troca urgente, aviso à liderança), já passadas pelo `humanizer-pt-br`. Um teste confere: variáveis conhecidas (`{nome}`, `{data}`, `{setor}`…), sem espaço duplo nem aspas curvas, tamanho dentro do limite do WhatsApp, sem vocabulário de venda (`cliente`, `pedido`, `venda`) e ortografia com `hunspell` pt_BR (disponível na máquina; nomes próprios e termos da igreja numa lista de exceções).

## Aceite

- Texto novo fora do arquivo reprova o teste de varredura (nenhuma frase de aviso espalhada pelo código).
- Sabotagem: um erro de grafia plantado faz o teste ficar vermelho.

## Comments

- 2026-10-21: feito em `feat/aviso-numero-da-escala`. `lib/escalas/textos-de-aviso.ts` (10 textos, já pelo `humanizer-pt-br`) e `tests/unit/escalas-textos-de-aviso.test.ts` (35 testes). 5 sabotagens plantadas (grafia, variável desconhecida, palavra de venda, aspas curvas, espaço duplo) fazem o teste falhar. **Limite:** o `hunspell` só existe na máquina local; no runner do GitHub a ortografia é pulada.
