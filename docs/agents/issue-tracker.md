# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `tasks/`. `plan/` belongs to the gov-loop (`plan/features.json`): never write tickets there.

## Conventions

- One feature per directory: `tasks/<feature-slug>/`
- The spec is `tasks/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `tasks/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `tasks/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `tasks/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `tasks/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `tasks/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Privacidade (fork público)

Nada em `tasks/` contém nome real de voluntário, líder ou membro. O fork é público e commit é para sempre. Fixtures, exemplos e tickets usam só pseudônimos (`Voluntario 001`, `Voluntario 002`…).

## Observação

`tasks/todo.md` é o workflow de construção existente e continua como está; specs novas vão em `tasks/<feature-slug>/`.
