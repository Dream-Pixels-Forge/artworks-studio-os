export { panelRegistry } from "./registry.js";
export { WorkspaceLayout } from "./workspace-layout.js";
export {
  defaultLayout,
  loadLayout,
  saveLayout,
  togglePanel,
  setActivePanel,
} from "./workspace-state.js";
export type {
  PanelDefinition,
  PanelProps,
  WorkspaceLayoutState,
  WorkspaceSlot,
} from "./types.js";
export { WORKSPACE_SLOTS } from "./types.js";
import "./builtin-panels.js";