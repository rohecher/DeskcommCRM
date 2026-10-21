# Spec — Exportar a escala do mês para planilha (divulgação)

Status: wontfix (pausada em 2026-10-21; reabrir se a divulgação voltar a ser por planilha)
Origem: `docs/decisoes.md`, entrada de 2026-10-16, pendência 1 (`exportar.py`). Medido em 2026-10-21.
Marcação: **CONFIRMADO** = lido no código ou no repositório; **INFERIDO** = dedução; **DECISÃO** = precisa do Roberto.

## 1. Problema

O fluxo mensal ainda depende do Python para uma coisa: gerar a planilha de divulgação a partir da escala aprovada. O `motor-legado/exportar.py` (212 linhas, fora do git porque tem nomes reais) lê a escala confirmada e o louvor e monta um `.xlsx` com **uma aba por culto**. Enquanto isso for assim, `motor-legado/` não pode ser arquivado (CONFIRMADO, `docs/decisoes.md`).

## 2. Objetivo

Um botão na tela do mês, em `/app/escalas`, que baixa `ESCALA AAAA-MM.xlsx` com o mesmo conteúdo que o `exportar.py` gera hoje. Paridade primeiro; melhorias depois.

### Não-objetivos

- Não gera escala nova: só exporta o que já está no banco.
- Não faz a auditoria da escala fechada (`auditar.py`): é a pendência 4, outra spec.
- Não importa planilha de volta (pendência 3).

## 3. O que o `exportar.py` faz (CONFIRMADO, lido em 2026-10-21)

1. Lê a escala **confirmada** e a escala do louvor (departamento externo), filtrando pelo mês ou datas pedidas. Sem nada confirmado, avisa e não gera.
2. Uma aba por culto, nomeada `QUI 17-09` / `DOM 20-09` (dia abreviado, dia e mês).
3. Linha 1: `DOMINGO 20/09/2026 - culto 19:00` (horário por dia: quinta 19:20, domingo 19:00). Linha 3: cabeçalho `SETOR | FUNÇÃO | NOME`.
4. Monta pela **estrutura de setores**, não pelo que foi preenchido: **vaga sem nome sai como `—`** (cinza), para a equipe ver que falta gente. Há subfunções com quantidade diferente na quinta e no domingo.
5. Ordem de leitura da liderança (Intercessão, Atalaias, Boas-vindas, Cozinha, Mesa da Comunhão, Culto Kids, Estacionamento, Cafeteria, Auxílio Pastoral, Coordenação do Culto), diferente da ordem de alocação do motor.
6. **Setor desligado no culto** vira a linha `NÃO HAVERÁ` + motivo, cinza.
7. Rótulos bonitos em pt-BR (acento, "AUXILIAR OS PASTORES", "Cozinheiro(a)"). Nome de pessoa **nunca** é reescrito.
8. Seção do louvor ao fim da aba, com faixa amarela, e a "Paleta de roupas" quando existe.
9. Visual: cabeçalho azul-escuro com texto branco, faixa azul-clara na primeira linha de cada setor, bordas finas, larguras 24/34/36, painel congelado abaixo do cabeçalho.
10. Ao terminar, avisa **vagas sem nome por culto** e **cultos sem escala de louvor**.

## 4. O que o app já tem (CONFIRMADO)

| Peça do `exportar.py` | Já existe em TypeScript |
|---|---|
| Rótulos bonitos | `lib/escalas/formato.ts` (`bonito`) |
| Horário por dia | `lib/escalas/repo.ts:67` |
| Cultos do mês com as vagas | `lib/escalas/consultas.ts` (cultos do mês, em ordem de data, já com as vagas) |
| Setor desligado | `escala_setor_off` (migration 0145), lido em `consultas.ts` e `repo.ts` |
| Paleta do louvor | `lib/escalas/louvor-banco.ts` (campo `paleta`) |
| Status do culto | `rascunho` → `aprovado` → `publicado` (`lib/escalas/tipos.ts`) |

**Não existe:** biblioteca de planilha em `package.json` (nem `xlsx`, nem `exceljs`), a ordem de leitura dos setores, nem rota de download.

## 5. Desenho

1. **Função pura** `montarPlanilhaDoMes(cultos, setoresOff, louvor)` que devolve um modelo de abas e linhas, sem tocar em arquivo. É onde mora a regra (itens 2 a 8 acima) e é o que se testa com paridade.
2. **Gerador** do `.xlsx` a partir desse modelo, com os estilos do item 9.
3. **Rota** `GET /app/escalas/exportar?mes=AAAA-MM` (route handler) com cookie de sessão, `getUser()`, cliente **sem** service role (RLS faz o isolamento) e `mes` validado com Zod. Auditoria `escala.exportada` com `resourceId: null` e o mês no `metadata` (nome de voluntário é dado pessoal).
4. **Botão** "Baixar planilha" no cabeçalho do mês, com os avisos do item 10 mostrados **antes** do download.

### Biblioteca de planilha — DECISÃO técnica

Recomendo **ExcelJS** (estilos, larguras e painel congelado). O pacote `xlsx` (SheetJS) no npm está parado em versão antiga e teve alertas de segurança; hoje, o fork acabou de limpar 69 alertas, então não vale importar outro. Antes de instalar, conferir a versão atual no Context7 (regra da camada Cajado) e rodar `pnpm audit` nela.

## 6. Perguntas abertas (`needs-info`; "não sei" é aceito)

1. **Quem pode baixar?** Sugiro `manager` ou mais (liderança). A planilha tem nome de voluntário.
2. **Quais cultos entram?** O Python usa a escala "confirmada". Sugiro `aprovado` e `publicado`; `rascunho` fica de fora, ou entra marcado "RASCUNHO".
3. **A divulgação é só essa planilha?** Se a liderança também usa imagem, PDF ou texto para WhatsApp, isso muda o escopo. **Resposta de 2026-10-19 sobre o que a liderança usa: "não sei".**
4. **O botão exporta o mês inteiro, ou também intervalo de datas** (o Python aceita `2026-09-13 2026-09-17`)?
5. **Vaga sem nome**: bloqueia o download, avisa e baixa mesmo assim, ou só baixa? Sugiro avisar e deixar baixar.

## 7. Critérios de aceite

- Para um mês de fixture com pseudônimos (`Voluntario 001`…), o modelo da função pura é **igual** ao que o Python produziria (paridade, como `tests/unit/escalas-paridade.test.ts` faz com o motor).
- O `.xlsx` abre no LibreOffice e no Excel, com uma aba por culto, vagas vazias em `—`, setor desligado em `NÃO HAVERÁ`, louvor com paleta.
- Usuário sem permissão recebe 403 e **não** vaza nome; outra organização não vê nada (teste com 2 tenants).
- Download provado **pela tela**, com Playwright, num banco fresco (doutrina de QA visual).
- Nenhum nome real em fixture, teste ou commit (regra do fork público).

## 8. Living System Checklist (resposta curta)

- **Entrada:** botão em `/app/escalas`. **Saída:** arquivo `.xlsx`.
- **Log:** auditoria `escala.exportada`. **Tela:** o botão e os avisos de vaga vazia.
- **Anti-morte:** o botão fica no cabeçalho do mês, que é a tela que a liderança já abre todo mês.
- **Laço de retorno:** se a planilha sai errada, a liderança volta a usar o Python. O sinal é o `motor-legado/` continuar sendo aberto. A paridade em teste é o que previne isso.

## Decisão de 2026-10-21 (Roberto)

**"Não será permitido, no momento, exportar a escala."** A divulgação passa a ser por **aviso no WhatsApp e push no app**, e não por planilha. Respostas dadas às perguntas do item 6:

1. Quem pode baixar: ninguém, por ora.
2. Quais cultos entram: o **mês inteiro aprovado** (não culto a culto).
3. Divulgação: prioridade é notificação por WhatsApp (confirmação, alteração etc.) e push no app. Ver `tasks/avisos-da-escala/spec.md`.
5. Vaga sem nome: fica **em aberto**, e pode virar sugestão para o próprio voluntário se oferecer.

Nada desta spec foi implementado. Os tickets 01 a 05 ficam `wontfix` (pausados). O `motor-legado/exportar.py` continua sendo o único exportador, e `motor-legado/` não pode ser arquivado por causa dele (ver `docs/decisoes.md`).

