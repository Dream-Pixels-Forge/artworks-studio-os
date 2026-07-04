# Decision.md

Decision 0001

The platform will be production-centric.

Reason

Productions outlive individual assets.

Status

Accepted

---------------------------------

Decision 0002

AI providers are hidden behind the Production Engine.

Reason

Users think about filmmaking.

Not APIs.

Status

Accepted

---------------------------------

Decision 0003

Knowledge Graph is the source of truth.

Reason

Relationships matter more than files.

Status

Accepted

---------------------------------

Decision 0004

The Docking Framework (#6) is hand-rolled, not built on react-mosaic /
FlexLayout / rc-dock.

Reason

A docking library would force replacing the existing WorkspaceLayoutState
(a flat 4-slot record) with its own node-tree model. That would break the
persisted layout format that existing users carry in localStorage and the
30+ panel contracts that depend on PanelDefinition / PanelProps.

The pre-docking scaffold already delivered ~60% of the Workspace System
(#5): a PanelRegistry, a serializable layout model, save/restore, and a
default layout. Extending that into a recursive split/tree model is lower
risk than swapping it out wholesale.

The project deliberately runs minimal dependencies (no zustand, no
react-dnd). Every interaction the issues ask for — splitter resizing, tab
groups, drag-to-dock, drop zones — is buildable with native pointer
events and HTML5 drag-and-drop. Adding a heavy framework for a
self-contained feature would break that philosophy.

Keeping the layout logic in a pure reducer (layout-reducer.ts) makes the
docking behavior fully unit-testable without React or the DOM.

Status

Accepted
