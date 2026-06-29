# CONTRIBUTING

Before contributing, read:

1. START-HERE.md
2. WHY.md
3. CONTEXT.md
4. PRINCIPLES.md
5. DECISIONS.md
6. README.md
7. docs/philosophy.md
8. docs/vision.md
9. docs/prd.md

Do not begin implementation until the production context is understood.

Before every change, ask whether it helps filmmakers, supports storytelling, reduces production friction, preserves the single source of truth, and keeps AI as the crew.

## Contribution workflow

This project follows an **issue → branch → pull request** flow. It keeps
history clean, makes work reviewable, and lets anyone join in.

### 1. Start from an issue

Every change traces back to an issue. If one doesn't exist, open one first:

- **Bug?** Use the 🐛 Bug report template.
- **New capability?** Use the ✨ Feature request template and note the
  roadmap phase if you know it.

Wait for triage before starting non-trivial work. An issue that says
"help wanted" / is assigned to a phase is ready to pick up.

### 2. Create a branch

Branch from `main`. Name it after the work, not the person:

```
git checkout main
git pull
git checkout -b feat/<short-slug>     # feature
git checkout -b fix/<short-slug>      # bugfix
git checkout -b docs/<short-slug>     # documentation
```

One branch = one concern. Don't bundle unrelated changes.

### 3. Implement

- Follow the structure and conventions in `docs/structure.md`.
- Match the house documentation style (metadata header + `End of Document`
  where applicable).
- Write tests. No exceptions (see `docs/structure.md` repository rules).
- Keep commits focused. We use Conventional Commits:

  ```
  feat(scope): summary         # a new capability
  fix(scope): summary          # a bug fix
  docs(scope): summary         # documentation only
  refactor(scope): summary     # no behavior change
  test(scope): summary         # tests only
  chore(scope): summary        # tooling, deps
  ```

  Common scopes: `aw` (the CLI), `platform`, `ui`, `db`, `sdk`, `docs`.

### 4. Verify locally

Before pushing, everything must be green. From the repo root:

**CLI (`aw/`):**

```
cd aw
uv run ruff check .
uv run black --check .
uv run pytest
```

**Platform (`src/`):**

```
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

CI runs the same on Ubuntu and Windows. If it's red locally, it'll be red
on GitHub.

### 5. Open a pull request

Push your branch and open a PR against `main`. The PR template will prompt
you to link the issue (`Closes #123`), summarize the change, and confirm
verification.

- Keep the PR scoped to its issue.
- CI must pass before review.
- A maintainer merges once approved. We use **squash-and-merge** to keep
  `main` linear: each merged PR is one commit.

### 6. Close the loop

When the PR merges, the linked issue closes automatically. Update
`CHANGELOG.md` (or `aw/CHANGELOG.md`) for user-facing changes.

## Branch lifecycle

- `main` is always shippable and always green.
- Feature branches are short-lived and deleted after merge.
- Long-running work lives on its own branch and is kept up to date with
  `main` via rebase.

## Need help?

Open a discussion in the Discussions tab for questions and ideas that
aren't issues. Read `DECISIONS.md` for the rationale behind architectural
choices before proposing alternatives.
