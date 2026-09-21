-- ============================================================================
-- 0146 — LIDERANÇA DA IGREJA NÃO É LIDERANÇA DE SETOR
--
-- A 0145 fez `escala_lideres.setor_id` obrigatório, e a importação dos dados
-- reais mostrou duas linhas que não caberiam: o PASTOR da igreja (Gildásio
-- Mercedes) e o COORDENADOR dos Filhos que Servem (Roberto Hecher). No
-- `lideres.csv` eles aparecem com os setores inventados `PASTOR` e `GERAL`,
-- que existem só porque a planilha precisava de algo naquela coluna.
--
-- As duas saídas ruins eram: criar setores `PASTOR` e `GERAL` de mentira (eles
-- apareceriam no cadastro de setores e no seletor de vaga, oferecendo escalar
-- alguém para "Pastor") ou descartar as duas linhas na importação.
--
-- Descartar é o pior dos dois, e não por gosto: quando um voluntário avisa que
-- não vem, quem é notificado é o líder do setor — e sete dos quinze setores
-- não têm líder cadastrado. Sem liderança geral, o aviso não tem para quem ir.
--
-- NULL = lidera a igreja/o ministério inteiro, não um setor. `papel` continua
-- dizendo qual é a função ("PASTOR", "COORDENADOR FILHOS QUE SERVEM"), e a
-- regra de score do motor segue inalterada: só papel começando em "LIDER" pesa
-- (`PAPEL_LIDERANCA`), então ninguém passa a servir mais por causa disto.
--
-- O ÍNDICE PRECISA MUDAR JUNTO. `unique (setor_id, voluntario_id)` com
-- `setor_id` NULL não barra nada: em SQL dois NULLs não são iguais, então a
-- mesma pessoa entraria vinte vezes como liderança geral e a tela mostraria
-- vinte linhas idênticas. Dois índices parciais cobrem os dois casos.
-- ============================================================================

alter table public.escala_lideres alter column setor_id drop not null;

comment on column public.escala_lideres.setor_id is
  'Setor que a pessoa lidera. NULL = liderança da igreja/ministério inteiro (pastor, coordenador geral), que é quem recebe o aviso quando o setor não tem líder próprio.';

drop index if exists public.escala_lideres_setor_voluntario_key;

create unique index if not exists escala_lideres_setor_voluntario_key
    on public.escala_lideres using btree (setor_id, voluntario_id)
    where setor_id is not null;

create unique index if not exists escala_lideres_geral_voluntario_key
    on public.escala_lideres using btree (organization_id, voluntario_id, papel)
    where setor_id is null;

notify pgrst, 'reload schema';
