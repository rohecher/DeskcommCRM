-- ============================================================================
-- 0148 — A ORDEM DO HISTÓRICO É INSUMO DO DESEMPATE, ENTÃO PRECISA SER GUARDADA
--
-- Medido ao portar o motor: a escala gerada a partir do banco escolhe AS MESMAS
-- PESSOAS que a gerada a partir da planilha (0 de 210 vagas com conjunto
-- diferente), mas 56 das 324 linhas saem em ordem trocada dentro da vaga.
--
-- A razão é que a ordem de leitura do histórico é usada como critério de
-- desempate. `perfis` é um dicionário construído na ordem em que o histórico
-- apresenta as pessoas, e o motor percorre os candidatos nessa ordem com
-- ordenação ESTÁVEL — duas pessoas com a nota idêntica saem na ordem em que
-- apareceram. Na planilha essa ordem é a das abas; num `select` é a do
-- `order by`. Sem uma coluna que preserve a original, as duas divergem.
--
-- POR QUE ISSO IMPORTA, SE AS PESSOAS SÃO AS MESMAS
--
--   1. A marca "casal" é gravada na SEGUNDA linha da dupla. Trocar a ordem troca
--      qual das duas linhas aparece marcada na escala publicada.
--   2. A escala é divulgada. Reimportar o histórico mudaria a ordem dos nomes
--      numa escala que a igreja já viu, sem nenhuma regra ter mudado — e ninguém
--      saberia dizer por quê.
--
-- A ALTERNATIVA QUE NÃO ESCOLHI, E POR QUÊ
--
-- O desempate poderia ser explícito (por nome, por exemplo), o que seria mais
-- honesto que "a ordem da planilha". Mas isso MUDA o resultado: as dez escalas
-- de setembro e outubro que a liderança aprovou e divulgou sairiam diferentes.
-- Trocar um critério de desempate é mudança de regra, não de forma, e quem
-- decide isso é quem monta a escala na igreja — não a migration que está
-- consertando o porte. Fica registrado aqui como a pergunta a fazer, não como
-- decisão tomada.
--
-- NULLABLE porque o histórico já importado não tem a informação: para ele o
-- `repo` cai no critério cronológico, que é o comportamento de hoje. Quem
-- reimportar passa a ter a ordem da planilha preservada.
-- ============================================================================

alter table public.escala_historico add column if not exists ordem integer;

comment on column public.escala_historico.ordem is
  'Posição da linha na fonte (planilha), preservada porque o motor usa a ordem de leitura do histórico como desempate entre candidatos de nota igual. NULL = importado antes da 0148; o motor então ordena por ano/mês/dia.';

-- O índice cobre exatamente o `order by` do carregamento do motor.
create index if not exists escala_historico_org_ordem_idx
    on public.escala_historico using btree (organization_id, ordem);

notify pgrst, 'reload schema';
