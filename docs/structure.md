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
├── START_HERE.md
├── MANIFESTO.md
├── WHY.md
├── AI_ONBOARDING.md
├── README.md
├── LICENSE
├── CHANGELOG.md
├── CONTRIBUTING.md
├── PROJECT_STATE.md
├── docs/
├── src/
├── tests/
├── scripts/
├── assets/
├── templates/
├── plugins/
├── examples/
├── config/
├── tools/
├── .github/
└── .vscode/
```

## Source Layout

```text
src/
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

```text
docs/
├── 00_company/
├── 01_product/
├── 02_design/
├── 03_engineering/
├── 04_database/
├── 05_api/
├── 06_sdk/
├── 07_ai/
├── 08_ui/
├── 09_plugins/
├── 10_production/
├── 11_testing/
├── 12_release/
├── 13_research/
├── 14_decisions/
└── 15_templates/
```

## Assets Layout

```text
assets/
├── branding/
├── icons/
├── fonts/
├── images/
├── videos/
├── audio/
├── illustrations/
└── mockups/
```

## Templates

```text
templates/
├── project/
├── character/
├── scene/
├── shot/
├── environment/
├── plugin/
└── documentation/
```

## Scripts

```text
scripts/
├── bootstrap/
├── build/
├── release/
├── development/
├── testing/
└── documentation/
```

## Plugins

```text
plugins/
├── official/
├── community/
└── experimental/
```

## Tests

```text
tests/
├── unit/
├── integration/
├── performance/
├── ui/
├── e2e/
└── fixtures/
```

## Platform Mapping

The capability modules above map to the Electron application's process
boundaries. Capabilities are placed where they physically belong, but the
module responsibilities and names are unchanged.

```text
src/
├── main/              # Electron main process (Node)
│   ├── app/           # → app (startup, lifecycle)
│   ├── core/          # → core (command bus, service container, event bus)
│   ├── database/      # → database (schema, migrations)
│   ├── services/      # → services (filesystem, cache, notifications)
│   ├── plugins/       # → plugins (discovery, loading, permissions)
│   └── integrations/  # → integrations (git, the `aw` CLI sidecar, AI providers)
├── preload/           # Secure IPC bridge exposing a typed API to the renderer
├── renderer/          # React presentation layer (browser context)
│   ├── app/           # shell, routing
│   ├── ui/            # → ui (tokens, themes, primitives)
│   └── workspace/     # → workspace (docking, tabs, layout)
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
