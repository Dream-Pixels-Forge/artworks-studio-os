export { panelRegistry } from "./registry.js";
export { WorkspaceLayout } from "./workspace-layout.js";
export {
  defaultWorkspace,
  defaultWorkspaceRoot,
  loadLayout,
  saveLayout,
  reconcile,
  migrateLegacy,
  togglePanel,
  setActivePanel,
  findPanelNode,
  findSlotNode,
} from "./workspace-state.js";
export {
  layoutReducer,
  findNode,
  MIN_PANE_SIZE,
  __resetNodeIdCounter,
} from "./layout-reducer.js";
export type { LayoutAction, DockEdge } from "./layout-reducer.js";
export {
  listWorkspaces,
  getWorkspace,
  getActiveWorkspace,
  getActiveWorkspaceId,
  saveWorkspace,
  deleteWorkspace,
  setActiveWorkspace,
  seedBuiltinWorkspaces,
  buildBuiltinWorkspaces,
} from "./workspace-store.js";
export type {
  PanelDefinition,
  PanelProps,
  Workspace,
  WorkspaceSlot,
  SplitNode,
  TabNode,
  LayoutNode,
  SplitDirection,
  LegacyWorkspaceLayoutState,
} from "./types.js";
export { WORKSPACE_SLOTS, isSplitNode, isTabNode } from "./types.js";
import "./builtin-panels.js";
