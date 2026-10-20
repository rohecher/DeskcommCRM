# Descartados do garimpo

Um registro por item que a rotina decidiu não trazer, com o motivo. Só acrescenta; não apaga.

## 2026-10-20

| PR | Título | Motivo |
|---|---|---|
| #2638 | Dialeto MySQL do banco externo (Spec 23, 4a-2a) | Integração de dados externos; sem uso pastoral |
| #2640 | MySQL 8 de verdade num workflow informativo (4a-2b) | Idem; é só CI do recurso acima |
| #2639 | Tela do motor e do aviso de privilégio (4b) | Idem |
| #3079 | Gemini 4 Argon no catálogo de modelos, preço de 01/12/2026 | O Cajado usa Anthropic como primário (`CLAUDE.md`). **INFERIDO** que não usa Gemini; migration `0703` e baseline a portar se isso mudar |
| #3085 | Release 1.86.0 | Versão do produto deles, não nossa |
| #3086 | Changelog do #3052 na 1.86.0 | Idem |

Avaliação dos 9 itens que aplicam limpo (2026-10-20):

| PR | Título | Motivo |
|---|---|---|
| #3017 | Respostas prontas do integrador preenchem `{{nome}}` com o nome do perfil | Vale só para o integrador por API; baixo valor para a igreja. Reavaliar se o integrador entrar em uso |
| #3066 | Seletores continuam funcionando com tradução do navegador | Caso de borda de quem traduz a página; baixo valor |
| #2735 | Spec 25: receitas prontas do banco externo | Documento do recurso de banco externo |
| #1930 | Passkey (WebAuthn), fatia 1: config do self-host | Funcionalidade nova de login, só a primeira fatia; não pedida |
| #3054 | Nota de release do Next 16.4.1 | A nota é só texto; o que importa é a subida do Next, no ticket 07 |

