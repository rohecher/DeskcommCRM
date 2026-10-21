# Spec — Garimpo diário do upstream

Status: needs-triage
Fonte do que está medido: `git fetch upstream` em 2026-10-19, merge-base `48e517070` (2026-08-10).
Marcação: **CONFIRMADO** = medido no repo; **INFERIDO** = dedução; **DECISÃO** = precisa de resposta do Roberto.

## 1. Problema

O Cajado é fork do DeskcommCRM (`melgarafael/DeskcommCRM`). O upstream libera trabalho todo dia e parte dele melhora o Cajado de verdade (ex.: tudo que ajuda o bot a conversar melhor: roteadores de IA, "a IA recebe o anúncio do contato", correções de WAHA, segurança, LGPD). Hoje ninguém olha. O fork já está **10.545 commits atrás** (CONFIRMADO) e tem 25 commits próprios.

Merge em massa não serve: o Cajado trocou o vocabulário (negócio→acompanhamento, papéis pastorais) em 65 arquivos que o upstream também mexe, e tem domínio próprio (escalas). A rotina precisa **garimpar**, não sincronizar.

## 2. Objetivo

Uma rotina diária que (a) lê o que entrou no upstream desde a última análise, (b) separa o que agrega valor ao Cajado do que é só do produto de vendas, (c) entrega para a liderança técnica um relatório curto e tickets prontos, e (d) quando um item é aprovado, aplica na `cajado` **sem mexer na estrutura do projeto** e **mantendo tudo no vocabulário cristão/pastoral**.

### Não-objetivos

- Não faz merge do `upstream/main` na `cajado`. Nunca.
- Não aplica nada sozinha. A rotina diária **só lê e propõe**; aplicar é um passo separado, com aprovação.
- Não faz push, não abre PR e não dá merge sozinha (o hook `block-dangerous-git.sh` já barra push, e isso continua valendo).
- Não reescreve a estrutura do Cajado para "ficar parecido com o upstream".

## 3. Fatos medidos que moldam o desenho

| Fato | Valor | Consequência |
|---|---|---|
| Fork vs upstream | 10.545 atrás, 25 à frente (CONFIRMADO) | Sincronizar tudo é inviável |
| Volume do upstream | 285 merges entre 2026-10-12 e 2026-10-19; versão `v1.83.0` (CONFIRMADO) | ~40 PRs/dia: a triagem tem que ser automática e barata |
| O que o fork mudou | 132 arquivos, +65.364 / −259 (CONFIRMADO) | Quase tudo é **aditivo** (escalas, kanban, docs): a maior parte do upstream aplica limpo |
| Arquivos do upstream que o fork **modificou** | 65 (CONFIRMADO), em sua maioria strings de vocabulário | Zona de conflito real. Ex.: `lib/audit/actions.ts` tem 423 commits do upstream desde a base |
| **Colisão de migrations** | Upstream tem `0144`–`0149` diferentes das do fork (`0144_followup_timing_plan` vs `0144_organizacao_nova_nasce_igreja`) e já está na `0683` (CONFIRMADO) | Migration do upstream **nunca** entra com o número original. Renumera para depois da última do fork (hoje `0149`), e vira apêndice no `baseline.sql` ANTES do bloco `VARREDURA anon` |
| `baseline.sql` | O fork tem apêndice próprio e mexeu na ordem da varredura | Nunca importar o `baseline.sql` do upstream. Portar só o bloco da migration escolhida |
| **Quase nada aplica limpo** | Simulação de cherry-pick (`git merge-tree`) sobre 105 itens do upstream de 16/10 em diante: **9 limpos (≈9%)**. Arquivos que mais conflitam: `lib/i18n/dicionario.ts` (43), `lib/i18n/traducoes/en.json` (19), `zh-CN.json` (12), `supabase/baseline.sql` (11), `CRMSidePanel.tsx` (6), `lib/audit/actions.ts` (6) (CONFIRMADO, 2026-10-20) | O upstream criou um sistema de i18n depois da base do fork; o fork nunca o recebeu, então todo PR de tela conflita. **A zona sozinha enganava**: 2 dos 3 itens "verdes e pequenos" do primeiro lote (#3092, #3077) dependiam de peças que o fork não tem. O coletor passa a simular o cherry-pick e mostra "Aplica limpo?" |
| Fragmentos de release | O upstream publica `docs/release/*.md` por PR (CONFIRMADO) | Boa fonte de resumo em linguagem de produto para o classificador |

## 4. As três zonas

A zona de cada arquivo é **calculada**, não decidida à mão.

- **Vermelha — a rotina nunca propõe tocar.** `lib/escalas/**`, `app/app/escalas/**`, `scripts/importar-escalas.ts`, `lib/branding.ts`, `docs/decisoes.md`, `docs/escalas-glossario.md`, `docs/dominio-nao-e-venda.md`, `docs/agents/**`, `CLAUDE.md`, `AGENTS.md`, o bloco `VARREDURA anon` do `baseline.sql` (que o upstream não tem). Se um PR do upstream toca nisso, o relatório marca "conflita com zona vermelha" e para.
- **Amarela — aplica, mas com cuidado.** Inclui `supabase/baseline.sql` e `supabase/migrations/MANIFEST.md`: todo PR de schema os toca, então vermelho esconderia correção valiosa (medido em 2026-10-16: 8 de 37 PRs ficariam vermelhos só por isso). O conteúdo do upstream nunca é importado, é **portado à mão** (§6.3). Também: Arquivos que o fork já modificou em relação ao merge-base: `git diff --name-only <merge-base> HEAD` menos as vermelhas (hoje 65). O ganho funcional entra; as strings de UI voltam ao vocabulário pastoral.
- **Verde — cherry-pick limpo.** Arquivo que o fork não tocou. É onde mora o grosso do valor (workers, agent-engine, WAHA, rotas de API, segurança).

## 5. A rotina diária (só leitura)

Roda uma vez por dia, de manhã. Cada passo é um comando ou um prompt pequeno, para a outra IA não precisar de contexto da sessão.

1. **Marcador.** Lê `tasks/upstream-garimpo/ultimo-analisado.txt` (SHA do último `upstream/main` analisado). Primeira execução: começa nas últimas 24h do upstream, não na base de 2026-08-10 (que são 10 mil commits).
2. **Fetch.** `git fetch upstream` (pode demorar; precisa de timeout largo).
3. **Lista.** PRs mesclados no intervalo: `git log <marcador>..upstream/main --merges`. Para cada um: número, título, arquivos, e o fragmento `docs/release/*.md` se existir.
4. **Zona.** Classifica cada arquivo do PR em verde, amarela ou vermelha (§4). O PR herda a **pior** zona.
5. **Valor.** Classifica o PR em uma destas, com uma frase de motivo:
   - `bot-comunicacao`: agente de IA, prompts, follow-up, roteador, WAHA, anti-banimento, entrega de mensagem. **Prioridade 1** (é o caso do JEV).
   - `seguranca-lgpd`: correção de vulnerabilidade, LGPD, RLS, audit. **Prioridade 1.**
   - `confiabilidade`: worker, cron, lock, idempotência, perda de mensagem.
   - `ux-neutra`: melhoria de tela que não depende de vocabulário comercial.
   - `so-vendas`: Nuvemshop, pedido, carrinho, cobrança, planos, campanha comercial. **Descartar**, mas listar numa linha.
   - `precisa-decisao`: não dá para saber sem o Roberto.
6. **Varredura de vocabulário.** Para PR com string de tela nova: procura termos comerciais (`negócio`, `venda`, `lead`, `cliente`, `Ganho`, `Perdido`, `pedido`, `carrinho`, `cobrança`, `funil de vendas`). Cada achado vira uma linha "traduzir para X" no ticket.
7. **Migration.** PR com migration entra marcado "renumerar" (§3) e "apêndice no baseline antes da varredura".
8. **Saída.**
   - `tasks/upstream-garimpo/relatorios/AAAA-MM-DD.md`: no máximo uma página. Topo: "N PRs, M candidatos". Depois uma tabela (PR, zona, valor, ação sugerida). No fim, uma linha por descartado.
   - Um ticket por candidato em `tasks/upstream-garimpo/issues/NN-slug.md` com `Status: needs-triage`, link do PR, zona, arquivos, tradução necessária e conflito esperado.
   - Atualiza o marcador **só no fim e só se o relatório foi escrito**, para um dia falho não pular PRs.

## 6. A aplicação (passo separado, com aprovação)

Só roda para ticket com `Status: ready-for-agent`, ou seja, aprovado.

1. Branch nova a partir da `cajado` atualizada (doutrina de higiene de branches): `upstream/<numero-do-pr>-<slug>`.
2. `git cherry-pick -x` dos commits do PR. Se conflitar num arquivo amarelo: resolve mantendo a lógica do upstream e o vocabulário do Cajado. Se conflitar em vermelho: para e vira `needs-info`.
3. Migration: renumera, escreve o apêndice idempotente no `baseline.sql` antes da varredura, linha no `MANIFEST.md` (doutrina do `CLAUDE.md`).
4. Textos de tela e mensagens: passam pelo `humanizer-pt-br` (regra da camada Cajado).
5. Gates, sempre com o `.env` fora do caminho (ele carrega credenciais reais do Upstash e deixa 6 testes vermelhos): `pnpm gov:verify` e, se mexeu em schema/RLS, `pnpm test:db`.
6. Commit com `-x` preservando a origem; PR para a `cajado` descrevendo o PR de origem. O push é seu (o hook barra o meu).

## 7. Critérios de aceite da spec

- Rodar a rotina num dia real gera relatório com todos os PRs do dia classificados, sem tocar em nenhum arquivo fora de `tasks/upstream-garimpo/`.
- Nenhum PR de zona vermelha aparece como "aplicar".
- Toda string comercial nova aparece com tradução proposta.
- Toda migration aparece com número novo e posição no baseline.
- Um dia sem item novo não gera erro nem PR vazia: o coletor avisa no log. O workflow também não roda se já há PR `garimpo/*` em aberto.
- Nenhum nome real de voluntário em `tasks/` (regra do fork público).

## 8. Perguntas abertas (`needs-info` — responder "não sei" é aceito)

1. **Quem aprova um candidato?** Só o Roberto, ou a liderança técnica também?
2. **O que "agrega valor" além do bot?** A lista do §5.5 foi inferida. Falta confirmar o que a liderança realmente usa na divulgação e na auditoria. **Resposta (2026-10-19): "não sei". `needs-info`**: até a liderança dizer, o critério fica só com bot, segurança/LGPD e confiabilidade.
3. **Frequência.** Diário todo dia, ou só em dia útil? Resumo semanal para a liderança?
4. **Onde roda a rotina?** Sessão manual do Claude Code, agendamento (`/schedule`) ou CI no fork? Muda quem tem acesso à rede e ao `gh`. **Resposta (2026-10-19): GitHub Actions agendado no fork** (alternativa ao schedule do Dokploy, aprovada pelo Roberto). O workflow roda o coletor (§5.1 a 5.4, sem IA) e abre PR/issue com o relatório bruto; nunca dá push direto. A classificação de valor (§5.5 a 5.7) fica numa sessão do Claude, opcionalmente via `/schedule`. Ver ticket 01. Ponto aberto, CONFIRMADO em 2026-10-19: o workflow agendado só dispara pela branch **padrão** do repo, e a padrão de `rohecher/DeskcommCRM` é `main`, parada em `48e517070` (2026-08-10, ancestral do upstream, 22 commits atrás da `cajado`). Decisão pendente: ver ticket 01.
5. **Ritmo de aplicação.** Teto de PRs aplicados por semana, para não virar a fonte de instabilidade da produção?
6. **Registro de decisão.** Esta rotina é decisão estrutural nova. Pela regra do `CLAUDE.md`, ela entra em `docs/decisoes.md` **antes** de qualquer código. Quer que eu proponha o texto da entrada?
7. **Estrutura para diminuir conflito futuro.** Hoje o vocabulário pastoral está espalhado em 65 arquivos do upstream. Centralizar em um único módulo de vocabulário reduziria o conflito a cada cherry-pick, mas é mudança estrutural. Vale abrir como decisão separada?

8. **O fork deve adotar o sistema de i18n do upstream?** É a causa de ~40% dos conflitos medidos (`dicionario.ts` conflita em 43 de 105 itens). Adotar é mudança estrutural grande (toca praticamente toda tela) e o Cajado é só em português; não adotar significa portar à mão cada item de tela, no estilo do arquivo (como foi feito no #3082). Precisa de decisão própria em `docs/decisoes.md`.

## 9. Tickets previstos (ainda não criados)

1. Script `scripts/upstream-garimpo/zonas.ts`: calcula as zonas (§4) e testa com os 65 arquivos de hoje.
2. Script de coleta (§5.1 a 5.4) que gera o JSON do dia.
3. Prompt do classificador (§5.5 a 5.7), com 10 PRs reais de exemplo.
4. Gerador do relatório e dos tickets (§5.8).
5. Procedimento de aplicação (§6) como skill ou runbook em `docs/runbooks/`.
6. Primeira execução supervisionada com os PRs de 2026-10-16.

## Revisão de 2026-10-21

O garimpo deixou de ser diário e de listar tudo. Agora é **semanal** (segunda, 07:17 em Brasília) e **filtrado**: só correção, segurança e mudança pequena (`ehCandidato` em `scripts/upstream-garimpo/coleta.ts`). Motivo e números: `docs/decisoes.md`, entrada de 2026-10-21. Aplicado ao relatório real de 21/10, o filtro reduz 34 itens a 13 candidatos.

