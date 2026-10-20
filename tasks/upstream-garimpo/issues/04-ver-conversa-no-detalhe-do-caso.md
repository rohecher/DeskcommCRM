# 04 — Link «Ver conversa» no detalhe do caso

Status: ready-for-agent
Type: task
Origem: https://github.com/melgarafael/DeskcommCRM/pull/3082 (merge `0f1d33344`), relatório de 2026-10-20
Zona: verde
Valor: ux-neutra

## Por que traz

Na tela Casos, o detalhe passa a ter o link para a conversa que originou o caso, sem precisar procurar o contato na caixa de entrada. Pequeno (3 arquivos, 24 linhas), mas fica a um clique de quem cuida do caso.

## O que toca

`app/app/ai/cases/_components/CaseDetail.tsx` e o teste.

## Conflito esperado

Baixo. Nenhum arquivo amarelo ou vermelho.

## Tradução necessária

O rótulo «Ver conversa» já é neutro. A nota do upstream diz "conversa do cliente": não copiar essa frase para lugar nenhum do Cajado.

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada: `upstream/3082-ver-conversa-no-detalhe-do-caso`.
2. `git cherry-pick -x -m 1 0f1d33344` (o commit é o merge do PR no upstream). **Não trazer** `.changes/*.md`: o fork não usa esse diretório.
3. Conflito em arquivo amarelo: manter a lógica do upstream e o vocabulário do Cajado. Conflito em arquivo vermelho: parar e mudar para `needs-info`.
4. Texto de tela novo passa pelo `humanizer-pt-br` e pela varredura de termo comercial (`negócio`, `venda`, `lead`, `cliente`, `pedido`, `Ganho`, `Perdido`).
5. Gates, com o `.env` fora do caminho: `pnpm gov:verify`. PR para a `cajado`; o merge faz deploy.

## Comments
