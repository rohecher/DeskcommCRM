# 01 — Contar quantos voluntários têm telefone e contato

Status: ready-for-human
Type: task
Spec: `tasks/avisos-da-escala/spec.md`

Pergunta 5 da spec. Rodar no banco de produção, **só contagem** (sem listar nome):

```sql
select count(*) total,
       count(*) filter (where telefone is not null and telefone <> '') com_telefone,
       count(*) filter (where contact_id is not null) com_contato
from escala_voluntarios where status = 'ATIVO';
```

Se menos da metade tem telefone, a Fase 1 começa por completar o cadastro, não por mandar mensagem.

## Comments
