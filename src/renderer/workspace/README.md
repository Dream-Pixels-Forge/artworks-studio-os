# Workspace

The docking surface and panel system — where the Studio's panels live,
split, tab, and resize. Implements the Docking Framework (#6) and the
Workspace System (#5).

## Layout model

The arrangement of panels is a **recursive tree** (`types.ts`):

- A `SplitNode` divides its area along a row or column into sized children,
  separated by draggable splitters.
- A `TabNode` is a leaf holding a stack of panels shown as tabs.
- A `Workspace` wraps the tree (`root`) with an id, name, and timestamp —
  the unit users save and switch between.

Mutations flow through a pure reducer (`layout-reducer.ts`) as actions:
`SET_ACTIVE`, `CLOSE_TAB`, `MOVE_PANEL` (stack-on-center / split-on-edge),
`RESIZE`. No React or DOM in the reducer — it's fully unit-tested.

## Panels

Panels register themselves at import time via `panelRegistry.register()`
with a `PanelDefinition` (id, title, icon, component, defaultSlot,
defaultVisible). `builtin-panels.ts` imports every panel module so
registration runs before the layout mounts. The 27 panels depend on the
stable `PanelProps` contract — do not break it.

## Persistence

- The **active working layout** (live edits) persists to localStorage under
  `artworks:workspace-layout`. On load, the new tree shape is tried first;
  if absent, a legacy `{slots, active}` blob is migrated via
  `migrateLegacy()` so existing users keep their arrangement on upgrade.
  `reconcile()` drops dead panel ids and appends newly-registered panels.
- **Named workspaces** (presets like "Storyboarding", "Editing",
  "Production" + user-saved arrangements) persist to localStorage under
  `artworks:workspaces`, managed by `workspace-store.ts`.

Renderer-local by design (the pre-docking decision). A main-process IPC
layer can be added later if cross-machine sync is required.

## Components

- `WorkspaceLayout` — top-level; owns the active tree + workspace state,
  dispatches actions, renders the bar + surface.
- `WorkspaceBar` — named-workspace switcher + "Save current as…".
- `LayoutNodeView` — recursive renderer (split → SplitView, tab → TabGroup).
- `SplitView` — resizable panes with pointer-event splitter handles.
- `TabGroup` — tab strip + active panel, with drag-to-dock and close.

## Commands

The command palette exposes `Workspace: Save Current As…`,
`Workspace: Switch to <name>`, `View: Toggle Sidebar`, and
`View: Toggle Bottom Panel`. The `artworks:open-panel` events dispatched
by existing panel-open commands are now wired (previously dead).

## Float / detach into a separate window

A panel can be popped out of the layout into its own secondary window via
`single-panel-window.tsx`, backed by the preload bridge's
`createSecondary()`. Implemented in #29 (Docking Framework #6 scope).
