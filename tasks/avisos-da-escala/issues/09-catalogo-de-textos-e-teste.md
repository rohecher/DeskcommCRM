# 09 — Um arquivo com todos os textos dos avisos e o teste que os vigia

Status: needs-info
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

## Blocked by: nada (pode andar sozinho)

`lib/escalas/textos-de-aviso.ts` com **todas** as mensagens (convocação, lembretes, pesquisa, troca urgente, aviso à liderança), já passadas pelo `humanizer-pt-br`. Um teste confere: variáveis conhecidas (`{nome}`, `{data}`, `{setor}`…), sem espaço duplo nem aspas curvas, tamanho dentro do limite do WhatsApp, sem vocabulário de venda (`cliente`, `pedido`, `venda`) e ortografia com `hunspell` pt_BR (disponível na máquina; nomes próprios e termos da igreja numa lista de exceções).

## Aceite

- Texto novo fora do arquivo reprova o teste de varredura (nenhuma frase de aviso espalhada pelo código).
- Sabotagem: um erro de grafia plantado faz o teste ficar vermelho.

## Comments
