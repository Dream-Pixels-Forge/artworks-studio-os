<!--
Thanks for contributing! Fill in the sections below. Text in <!-- … -> comments
won't appear in the published PR.

Read CONTRIBUTING.md before opening this PR. Every change should help filmmakers,
support storytelling, reduce production friction, preserve the single source of
truth, and keep AI as the crew.
-->

## Summary

<!-- One or two sentences: what does this PR change and why? -->

## Motivation

<!-- Why is this needed? Link the issue it closes, if any. -->

Closes #<issue number>

## What changed

<!-- Bullet list of the meaningful changes. Skip generated files. -->

-

## Verification

<!-- How did you confirm this works? Check the boxes that apply. -->

- [ ] CLI: `uv run ruff check . && uv run black --check . && uv run pytest` (in `aw/`)
- [ ] Platform: `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (in repo root)
- [ ] Manually verified in the running app / CLI

## Checklist

- [ ] The change follows the house documentation style (metadata header + `End of Document` where applicable)
- [ ] No new dependencies added without reason (or they are explained above)
- [ ] `CHANGELOG.md` / `aw/CHANGELOG.md` updated if user-facing
- [ ] Tests added or updated to cover the change
