# Command Reference

The `aw` CLI is the command layer for Artworks Studio OS. It manages the
studio workspace, productions, production documentation, and version
control. The studio home defaults to `~/.artworks` and is redirected with
the `AW_HOME` environment variable.

## `aw --help`

Shows the full command surface.

## `aw version`

Prints the installed CLI version.

## `aw doctor`

Reports the health of the local environment: CLI version, studio home,
whether the studio is initialized, production count, and the active
production.

## `aw studio init`

Initializes the studio home (default `~/.artworks`, override with
`AW_HOME`). Creates the capability directories (`projects/`, `config/`,
`templates/`, `assets/`) and a `studio.json` marker. Idempotent — safe to
re-run. Pass `--force` to reinitialize unconditionally.

## `aw project new <NAME>`

Creates a new production at `<studio>/projects/<NAME>/` with the canonical
directory tree (`docs/`, `assets/`, `prompts/`, `storyboards/`,
`keyframes/`, `renders/`, `audio/`, `exports/`, `automation/`) and a
human-readable `project.json` manifest. The new production becomes active.
If no name is given, `UNTITLED` is used.

- `--path <DIR>` — create the production in `<DIR>/<NAME>` instead of the
  studio home. The studio home does not need to be initialized in this mode.

Refuses to overwrite an existing production.

## `aw project open <NAME>`

Opens an existing production, setting it as active. With no argument (or
`active`), opens the currently active production.

## `aw project list`

Lists all productions in the studio, marking the active one with `*`.

## `aw docs bootstrap`

Populates the active production's `docs/` directory with the full
production-bible set: Production, Story, Character, Environment, Prop,
Camera, and VFX bibles, plus Editing Notes and a Storyboard. Each file
carries the house metadata header (`Version` / `Status` / `Audience`) and
an `End of Document` trailer. Idempotent — existing files are never
overwritten.

- `--project <NAME>` — operate on a non-active production.

## `aw docs validate`

Validates the active production's documentation: checks that `project.json`
is well-formed JSON with required fields, and that every Markdown document
has the required metadata header and `End of Document` trailer. Exits with
a non-zero status if any issue is found.

- `--project <NAME>` — operate on a non-active production.

## `aw git sync`

Records the current state of the active production as a single commit.
Initializes a git repository if one is not present, stages all files, and
commits with a timestamped message (`sync: <project> <timestamp>`).
Reports gracefully when there is nothing to commit or git is unavailable.

- `--project <NAME>` — operate on a non-active production.

## Environment variables

| Variable        | Default       | Purpose                                |
|-----------------|---------------|----------------------------------------|
| `AW_HOME`       | `~/.artworks` | Location of the studio workspace.      |
| `AW_ENVIRONMENT`| `production`  | Runtime environment label.             |
