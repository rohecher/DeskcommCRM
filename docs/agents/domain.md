# Domain Docs

Como as skills de engenharia devem consumir a documentação de domínio deste repo. Single-context.

## Antes de explorar, leia

- **`docs/escalas-glossario.md`**: o glossário (no lugar do `GLOSSARY.md`).
- **`docs/decisoes.md`**: as decisões (no lugar de `docs/adr/`). Leia as entradas que tocam a área do trabalho.

Se um arquivo não existir, siga em frente sem avisar.

## Use o vocabulário do glossário

Nomeie conceitos de domínio (título de ticket, teste, proposta) com o termo do glossário, sem cair nos sinônimos que a coluna "Evitar" proíbe.

## Termo novo e decisão nova entram nos docs antes do código

- Termo novo entra em `docs/escalas-glossario.md` **antes** de entrar no código, como diz o cabeçalho do glossário.
- Decisão estrutural nova entra em `docs/decisoes.md` **antes** de codar, sem sobrescrever em silêncio uma decisão já registrada.

## Sinalize conflito com decisão registrada

Se a sua saída contradiz uma entrada de `docs/decisoes.md`, diga isso explicitamente em vez de sobrescrever:

> _Contradiz a decisão de AAAA-MM-DD (…), mas vale reabrir porque…_
