# O Cajado não é um CRM de vendas — leia antes de tocar em pipeline/lead/stage

> Doc de tradução de domínio. Objetivo único: impedir que uma sessão futura (Claude,
> Codex, humano lendo o código pela primeira vez) olhe pra `crm_leads.value_cents`,
> `pipeline.vocabulary.won`, "Ganho/Perdido" ou qualquer rastro do nome original
> (DeskcommCRM) e conclua "isso aqui é venda". Não é. Isso aqui é **cuidado com vidas**.

## A regra

O Cajado nasceu como fork do DeskcommCRM (CRM de vendas: lead → deal → pipeline → won/lost).
O motor técnico foi reaproveitado de propósito — RLS, WhatsApp, fluxo, IA, tudo já pronto
e testado. **O domínio foi trocado, não o motor.** Toda palavra, campo ou tela que ainda
carrega vocabulário comercial precisa ser lida com o significado pastoral, nunca o literal:

| Termo no código/schema | Significado literal (herdado) | Significado real no Cajado |
|---|---|---|
| `lead` | Cliente em potencial | **Visitante** — pessoa que chegou, ainda não é membro |
| `deal` | Negócio/venda em andamento | **Acompanhamento** — o processo de cuidado com essa pessoa |
| `pipeline` | Funil de vendas | **Jornada** — o caminho de vida na igreja |
| `stage` | Etapa do funil | **Etapa da jornada** — onde a pessoa está nesse caminho |
| `won` (`is_won`) | Negócio fechado, cliente pagou | **Membro** — a pessoa deu o passo (batismo, decisão, o que a igreja definir) |
| `lost` (`is_lost`) | Negócio perdido | **Afastado** — a pessoa se distanciou, não "perdemos a venda" |
| `value_cents` | Valor do pedido em centavos | **Não tem equivalente pastoral direto.** Ver seção abaixo — não inventar significado, deixar claro que é campo herdado sem uso natural aqui |
| `expected_close_date` | Previsão de fechamento do negócio | Idem — sem tradução natural; ver seção abaixo |
| `crm_lead_activities` | Histórico de interações comerciais | **Timeline de cuidado** — todo contato, conversa, decisão registrada |
| `won_lost_mutex` / etapa terminal obrigatória | Garantir que todo negócio "fecha" (ganha ou perde) | Garantir que toda jornada tem um **desfecho registrável** — não é sobre fechar venda, é sobre a igreja nunca perder de vista onde uma pessoa parou |

## Por que a etapa "won" continua obrigatória (não é resquício de venda)

`lib/pipelines/pipeline-editing.ts` trava todo funil novo com exatamente 1 etapa `is_won`
e 1 `is_lost`, e o teste (`pipeline-editing.test.ts`) protege isso. **Isso não é sobre
fechar negócio** — é sobre o sistema sempre ter um estado terminal onde uma pessoa "pousa".
Sem isso, `/leads/[id]/win` (usado por qualquer automação/bot que precise marcar "esta
pessoa se tornou membro") responde 422 e a jornada nunca fecha um ciclo — o board vira
lista infinita sem desfecho, o que é pior pastoralmente, não só tecnicamente: ninguém
sabe quem "chegou lá" e quem "se afastou".

Conclusão prática: manter a etapa de desfecho (`Membro`/`Afastado`) em todo funil novo é
a escolha certa, e trocar o nome pra vocabulário de igreja (já feito) resolve o desconforto
de "isso parece venda" sem abrir mão da garantia técnica.

## Campos sem tradução pastoral direta (`value_cents`, `expected_close_date`)

Esses campos existem no schema porque o motor é compartilhado com o DeskcommCRM (ver
DIRC em `CLAUDE.md`: mudar schema é migration, não é trivial). Não force um significado
pastoral neles agora — opções, na ordem de preferência quando alguém precisar decidir:

1. **Deixar opcional e sem uso na UI de igreja** (o que já é hoje — `NewLeadDialog` não
   obriga preenchimento). Zero trabalho, zero confusão.
2. **Reaproveitar pra outra coisa própria de igreja** — ex.: `expected_close_date` como
   "data prevista de decisão/batismo" — mas isso é **decisão de produto**, registrar em
   `docs/decisoes.md` antes, não assumir sozinho.
3. **Esconder o campo por vocabulário** — se uma igreja nunca usa "valor", esconder o
   input na UI quando `vocabulary` não define um label pra ele. Também é decisão de
   produto, não fazer por conta própria numa sessão de bug fix.

## Regra de ouro pra qualquer sessão futura

Antes de "consertar" algo que parece estranho (campo de dinheiro num CRM de igreja, etapa
"Ganho" numa jornada espiritual, "pedidos" na URL): **pare e pergunte se é resquício
esperado do fork ou bug de verdade.** A maior parte do que parece estranho é o primeiro
caso — documentado aqui e em `docs/decisoes.md` — e mexer sem entender gera trabalho
duplicado ou quebra uma trava proposital (como a etapa `is_won` acima).

Ver também [`cajado-arquitetura.md`](../cajado-arquitetura.md) seção 3.3 (vocabulário) e
[`docs/decisoes.md`](decisoes.md) pro histórico de decisões já tomadas nessa tradução.
