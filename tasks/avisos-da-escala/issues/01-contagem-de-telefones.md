# 01 — Contar quantos voluntários têm telefone e contato

Status: done
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

- 2026-10-21 (Roberto, banco de produção): **101 voluntários ativos, 100 com telefone** (99%). `com_contato` não informado. A Fase 1 pode começar por mandar mensagem. O voluntário sem telefone aparece na Central da liderança, com o próximo passo: completar o cadastro.
