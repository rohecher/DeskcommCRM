# Escalas — glossário

> Vocabulário do domínio de escalas (Filhos que Servem). Use estes termos em código,
> testes, commits e conversa com a liderança. Termo novo entra aqui antes de entrar
> no código. Decisões de arquitetura: `docs/decisoes.md`, entrada de 2026-10-16.

## Estrutura

| Termo | Significa | Evitar |
|---|---|---|
| **Culto** | Um encontro com data e dia da semana (domingo 19:00, quinta 19:20). Tabela `escala_cultos`. Estados: `rascunho` → `aprovado` → `publicado`. | "evento", "reunião" |
| **Setor** | Departamento que serve no culto (Atalaias, Cafeteria, Mesa da Comunhão…). 15 canônicos. Tabela `escala_setores`. | "ministério", "área" |
| **Subfunção** | Posição dentro de um setor (Máquina de Cartão, Recepção, Lateral do Altar). Tabela `escala_subfuncoes`. | "cargo", "função" |
| **Vaga** (slot) | Uma subfunção num culto, com ou sem nome. Tabela `escala_slots`. | "turno", "posto" |
| **Voluntário** | Pessoa do cadastro. Tabela `escala_voluntarios`. | "membro" (membro é jornada, não escala) |
| **Líder** | Quem responde por um setor (`escala_lideres`). Pode servir, mas a regra é gerenciar: tem peso negativo no rodízio. | |
| **Casal** | Par confirmado que o motor tenta escalar junto (`escala_casais`). Há subfunções que só aceitam casal. | |

## Estados de uma vaga

| Termo | Significa |
|---|---|
| **Origem** | De onde veio o nome: `gerado` (motor), `fixado` (liderança cravou ANTES de gerar), `manual` (trocou DEPOIS), `externo` (departamento monta sozinho). |
| **Status da vaga** | `escalado` → `confirmado` / `troca_solicitada` → `presente` / `faltou`. Cada um só pode ser marcado em certa janela de datas (`lib/escalas/status.ts`). |
| **Fixado** | Nome cravado numa vaga. É entrada do motor. |
| **Rejeitado / vetado** | Nome recusado numa vaga. O motor não o escolhe ali. |
| **Manual** | Troca feita depois de gerar. NÃO é entrada do motor: a próxima geração a reavalia. |
| **Externo** | Escala de louvor, mídia e dança, que chega pronta. O motor a LÊ para não escalar quem toca no domingo para servir na quinta. |

## Disponibilidade

| Termo | Significa |
|---|---|
| **Status do voluntário** | `ATIVO` entra no rodízio. `INATIVO` saiu. `SUSPENSO` está fora por uma temporada e volta. |
| **Dias permitidos** | Vazio = qualquer dia. Preenchido = só esses. |
| **Setores bloqueados / permitidos** | Bloqueado = nunca. Permitido não vazio = serve SÓ nesses. |
| **Ausência** | Intervalo `ausente_de`–`ausente_ate` (férias, viagem). |
| **Teto mensal** | Máximo de cultos por mês, individual (`max`) ou global. |
| **Reserva** | Pessoa chamada só quando falta gente; tem teto próprio no mês. |
| **Departamento fixo** | Setor de origem. Se for externo (louvor, mídia, dança), a pessoa sai do rodízio geral. |
| **Exceção** | Violação de regra liberada pela liderança. |

## Motor

| Termo | Significa |
|---|---|
| **Gerar** | Montar a proposta de escala. É função pura: dados entram, vagas saem. |
| **Proposta** | Resultado do gerar antes da aprovação. Nada é gravado (`--tela` no Python). |
| **Aprovada / divulgada** | A que a liderança fechou e publicou. É a verdade; a proposta não é. |
| **Afinidade** | Quanto do serviço da pessoa foi naquele setor. Pesa ×2 na nota. |
| **Descanso / rodízio** | Quanto menos ela serviu no mês, mais pontua. Força o rodízio. |
| **Time fixo / pool extra** | Elenco declarado de uma vaga / quem entra mesmo sem histórico nela. |
| **Demanda** | Quantas pessoas por setor, pela mediana dos últimos 8 meses, por dia da semana. |
| **Histórico** | Uma linha por pessoa/culto/setor, extraída das planilhas antigas. |
| **Paridade** | Prova de que o TypeScript decide igual ao Python, nas escalas aprovadas de 13/09 a 15/10. Igualdade estrita. |
| **Oráculo** | O motor Python usado só para gerar o `esperado.json` da paridade. |

## Regras de escrita

- Setor e subfunção são gravados **sem acento** (`INTERCESSAO`, `Maquina de Cartao`). A planilha de divulgação sai em pt-BR.
- Nome de pessoa é exceção: vai com o acento exato do cadastro.
- Nome que não casa com o cadastro **aborta** a importação. Nunca é ignorado em silêncio.
- Fixtures de teste usam pseudônimos (`Voluntario 001`). Nome real nunca entra em commit: o fork é público.
