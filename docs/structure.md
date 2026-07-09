# Artworks Studio OS — Repository Structure

## Summary

This document defines the canonical structure of the Artworks Studio OS repository. The repository is organized around capabilities, not technologies. Every directory represents a responsibility within the platform. This structure is intended to scale from the first prototype to enterprise deployments without major reorganization.

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Foundation |
| Document Type | Engineering |

## Repository Layout

```text
artworks-studio-os/
├── START-HERE.md
├── WHY.md
├── README.md
├── LICENSE
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CONTEXT.md
├── DECISIONS.md
├── PRINCIPLES.md
├── docs/
├── src/
├── aw/                 # Python CLI sidecar
├── scripts/            # build tooling (e.g. build-native.mjs)
├── assets/             # branding, banners
├── plugins/            # reference plugins (example-hello)
└── .github/
```

> Test files live alongside the source they cover (`*.test.ts` /
> `*.test.tsx` next to the module under test), not in a separate `tests/`
> tree.

## Source Layout

The capability layout below is the *logical* model — the responsibilities
the code is organized around. The physical Electron process split that
hosts those capabilities is mapped in the **Platform Mapping** section
(`src/main`, `src/preload`, `src/renderer`, `src/shared`).

```text
src/                       # capabilities (logical view)
├── app/
├── core/
├── workspace/
├── production/
├── ai/
├── knowledge/
├── assets/
├── projects/
├── timeline/
├── automation/
├── plugins/
├── integrations/
├── ui/
├── services/
├── database/
├── events/
├── models/
├── utils/
└── shared/
```

## Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `app` | Startup, dependency injection, configuration, lifecycle, initialization. |
| `core` | Command bus, service container, configuration, logging, event dispatching. **No production logic belongs here.** |
| `workspace` | Windows, docking, tabs, layout, navigation. |
| `production` | Films, scenes, shots, acts, sequences, milestones. **Everything related to filmmaking belongs here.** |
| `knowledge` | Metadata, relationships, indexing, search, graph, references. |
| `ai` | Providers, prompts, conversations, routing, context, agents. **No provider-specific logic should leak outside this module.** |
| `assets` | Images, videos, audio, references, metadata, versions. |
| `projects` | Project creation, templates, opening, persistence, migration. |
| `timeline` | Milestones, tasks, calendar, progress, dependencies. |
| `automation` | Workflows, pipelines, batch operations, background jobs. |
| `plugins` | Discovery, loading, lifecycle, permissions, sandboxing. |
| `integrations` | GitHub, Git, Blender, ComfyUI, FFmpeg, OpenAI, Anthropic, Ollama. **All external communication happens here.** |
| `ui` | Components, views, panels, themes, icons. **Business logic must not exist here.** |
| `services` | File system, cache, notifications, storage, indexing. |
| `database` | Schema, migrations, repositories. **No business logic.** |
| `events` | `AssetCreated`, `SceneUpdated`, `CharacterModified`, `ProjectOpened`. **Everything communicates through events.** |
| `models` | `Character`, `Scene`, `Shot`, `Asset`, `Film`, `Project`. |
| `utils` | Reusable helpers, utility functions only. **No business logic.** |
| `shared` | Constants, enums, interfaces, common abstractions. |

## Documentation Layout

`docs/` is currently flat — one Markdown file per topic (architecture,
database, design-system, philosophy, prd, roadmap, sdk-reference,
specification, structure, ui-ux, vision, plugin-sdk, api-documentation).
A numbered subdirectory tree is a future option as the set grows.

## Assets Layout

```text
assets/
├── banner.png        # README banner
└── ...               # branding / imagery
```

## Scripts

```text
scripts/
└── build-native.mjs  # dual-ABI better-sqlite3 build (run as postinstall)
```

## Plugins

```text
plugins/
└── example-hello/    # reference plugin
```

## Tests

Tests live alongside the source they cover — `*.test.ts` /
`*.test.tsx` next to the module under test, run via vitest. There is no
separate top-level `tests/` tree.

## Platform Mapping

The capability modules above map to the Electron application's process
boundaries. Capabilities are placed where they physically belong, but the
module responsibilities and names are unchanged.

```text
src/
├── main/              # Electron main process (Node)
│   ├── app/           # → app (startup, window lifecycle)
│   ├── core/          # → core (DI container, logger, config, event/command bus)
│   ├── database/      # → database (schema v1–v10, migrations, 29 repositories)
│   ├── services/      # → services (IPC handlers, AI gateway, CRDT, settings…)
│   ├── plugins/       # → plugins (discovery, loading, runtime, permissions)
│   └── integrations/  # → integrations (git, the `aw` CLI sidecar, AI providers)
├── preload/           # Secure IPC bridge exposing a typed `window.artworks` API
├── renderer/          # React presentation layer (browser context)
│   ├── app/           # shell, title bar, routing
│   ├── command-palette/
│   ├── panels/        # 27 panels (dashboard, ai-chat, timeline, marketplace…)
│   ├── ui/            # → ui (tokens, themes, primitives)
│   └── workspace/     # → workspace (docking, tabs, layout, float-to-window)
└── shared/            # Imported by both main + renderer
    ├── sdk/           # → plugin SDK contract
    ├── models/        # → models
    ├── events/        # → events
    ├── production/    # → production domain types
    └── utils/         # → utils
```

The `aw` CLI (under `aw/`) remains a standalone Python tool used as a
sidecar for filesystem and version-control operations; the Electron main
process spawns it via the integrations module.

## Engineering Principles

- Capability-first architecture
- Modular design
- Clear ownership
- Strong separation of concerns
- Event-driven communication
- AI-native workflows
- Documentation-first development

## Repository Rules

Every new feature must include: specification, documentation, tests, implementation, changelog update. **No exceptions.**

## Growth Strategy

This structure is expected to support — without requiring structural changes:

- Desktop Application
- Command Line Interface (`aw`)
- AI Agents
- Plugin Ecosystem
- REST API
- Cloud Services
- Marketplace
- Enterprise Deployments

## Golden Rule

> Never organize code around frameworks. Organize code around capabilities. Frameworks change. Capabilities endure.

## Final Principle

The repository should mirror the way filmmakers think, not the way software frameworks are organized. When contributors open the project, they should immediately understand the production domains the platform supports, regardless of the programming language, UI framework, or infrastructure chosen. **The structure itself should communicate the architecture.**

---

*End of Document*
