# 06 — No servidor único, o cadastro por convite funciona quando o e-mail é só pela Resend

Status: needs-info
Type: task
Blocked by: resposta à pergunta abaixo
Origem: https://github.com/melgarafael/DeskcommCRM/pull/3060 (merge `9f61de8d2`), relatório de 2026-10-20
Zona: amarela
Valor: confiabilidade

## Por que traz

Na instalação de servidor único do kit, o serviço de login só sabia mandar e-mail pelo SMTP. Quem configurou só a Resend recebia o convite, mas a pessoa convidada não conseguia criar a conta. É primeira impressão de quem instala, 178 linhas.

## O que toca

`components/auth/SignupForm.tsx`, `app/actions/auth/signUp.ts`, `hostgator-setup-kit/_common.sh`, `lib/i18n/dicionario.ts` e `traducoes/en.json`.

## Conflito esperado

Arquivo amarelo: `components/auth/SignupForm.tsx` (o fork já o alterou).

## Tradução necessária

A tela de cadastro ganha mensagem nova ("o envio de e-mails da instalação não está configurado"). Passar pelo `humanizer-pt-br`.

## Pergunta aberta (Roberto)

A produção do Cajado usa o Supabase do **servidor único** (o que o instalador sobe na VPS) e manda e-mail **só pela Resend**? Se não, este item não muda nada para vocês e vira `wontfix`. Eu não sei responder pelo repositório. Resposta "não sei" é aceita: o ticket fica aqui.

## Como aplicar (spec §6)

1. Branch nova a partir da `cajado` atualizada: `upstream/3060-convite-cria-conta-so-com-resend`.
2. `git cherry-pick -x -m 1 9f61de8d2` (o commit é o merge do PR no upstream). **Não trazer** `.changes/*.md`: o fork não usa esse diretório.
3. Conflito em arquivo amarelo: manter a lógica do upstream e o vocabulário do Cajado. Conflito em arquivo vermelho: parar e mudar para `needs-info`.
4. Texto de tela novo passa pelo `humanizer-pt-br` e pela varredura de termo comercial (`negócio`, `venda`, `lead`, `cliente`, `pedido`, `Ganho`, `Perdido`).
5. Gates, com o `.env` fora do caminho: `pnpm gov:verify`. PR para a `cajado`; o merge faz deploy.

## Comments
