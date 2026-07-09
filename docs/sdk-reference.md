# Artworks Studio OS

# sdk-reference.md

Version: 1.0
Status: Foundation
Audience: Plugin Developers, AI Agents

---

## Purpose

This is the TypeScript-flavored companion to `docs/plugin-sdk.md`. Where
`plugin-sdk.md` describes the SDK in capability terms, this document pins
the concrete contract: the exact interfaces a plugin imports and
implements. The interfaces live in `src/shared/sdk/`, and the runtime
that loads, validates, and sandboxes plugins lives in
`src/main/plugins/` (`PluginRuntime`).

## Import Surface

```ts
import {
  PluginContext,
  PluginManifest,
  Permission,
  ProjectService,
  AssetService,
  GraphService,
  PromptService,
  AIService,
  FileService,
  MediaService,
  EventService,
  NotificationService,
} from "@shared/sdk";
```

## Manifest

Every plugin ships a `manifest.json` declaring its identity and the
permissions it needs. The runtime reads the manifest before loading code.

```ts
interface PluginManifest {
  id: string;            // unique, e.g. "artworks.example-hello"
  name: string;
  version: string;
  author: string;
  category: "production" | "ai" | "integration" | "workflow" | "ui" | "utility";
  description: string;
  sdkVersion: string;    // target SDK version
  permissions: Permission[];
  commands?: PluginCommand[];
}
```

### Permissions

Least-privilege: request only what you use. The runtime gates every
service by the manifest's declared permissions.

| Permission     | Service unlocked |
|----------------|------------------|
| `filesystem`   | `ctx.file` |
| `network`      | outbound fetch from `ctx.ai` / `ctx.media` |
| `ai`           | `ctx.ai`, `ctx.prompt` |
| `git`          | version-control operations |
| `automation`   | `ctx.media` (generation), workflows |
| `database`     | direct repository access (rare) |
| `media`        | `ctx.media` (transcode) |
| `notification` | `ctx.notification` |

## Lifecycle

A plugin exports an `activate` function receiving a `PluginContext`:

```ts
export function activate(ctx: PluginContext): PluginLifecycle {
  // subscribe to events, register behavior
  return {
    onActivate() { /* called when the plugin starts */ },
    onDeactivate() { /* called on unload */ },
  };
}
```

## Services

Each service is a typed interface. A service a plugin did not declare
permission for is absent from the context.

### `ctx.project` — ProjectService

`create({ name, description })`, `open(id)`, `active()`.

### `ctx.asset` — AssetService

`list(filter?)`, `read(uuid)`, `link(assetUuid, targetUuid, relation)`.

### `ctx.graph` — GraphService

`relationships(from)`, `connect(source, target, type)`.

### `ctx.prompt` — PromptService

`build(template, vars)`, `history(limit?)`.

### `ctx.ai` — AIService

`providers()`, `complete(messages, { model?, provider? })`.

### `ctx.file` — FileService

`read(path)`, `write(path, contents)`, `watch(path, onChange)`.

### `ctx.media` — MediaService

`generate({ prompt, kind, model? })`, `transcode({ path, format })`.

### `ctx.event` — EventService

`subscribe(type, handler)`, `publish(type, payload)`. The event map is
defined in `src/shared/events` and is closed — only known events can be
published.

### `ctx.notification` — NotificationService

`show({ level, message, actionLabel? })`.

## Example Plugin

See `plugins/example-hello/` for a minimal reference plugin: a manifest
declaring the `notification` permission, a command listening for
`project:opened`, and an `activate` function that greets the studio.

## Constraints

- Plugins communicate with the host only through `PluginContext`. No
  direct imports of host internals.
- Plugins never touch the database directly (database.md "Design Rules").
- Events are the only cross-module communication channel
  (architecture.md "Modular").

---

End of Document
