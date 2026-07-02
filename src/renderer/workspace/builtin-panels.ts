/**
 * Built-in panel registrations.
 *
 * Each built-in panel registers itself with the workspace registry on
 * import. The studio shell imports this module so all built-in panels
 * are available before the layout renders.
 */
import { panelRegistry } from "./registry.js";
import { ProjectExplorerPanel } from "../panels/project-explorer/project-explorer-panel.js";
import { WelcomePanel } from "./welcome-panel.js";

// Phase 2 panels
import "../panels/dashboard/dashboard-panel.js";
import "../panels/project-manager/project-manager-panel.js";
import "../panels/asset-browser/asset-browser-panel.js";
import "../panels/markdown-editor/markdown-editor-panel.js";
import "../panels/search/search-panel.js";

// Phase 3 panels
import "../panels/knowledge-graph/knowledge-graph-panel.js";
import "../panels/version-history/version-history-panel.js";

// Phase 4-8 panels
import "../panels/ai-chat/ai-chat-panel.js";
import "../panels/story-bible/story-bible-panel.js";
import "../panels/prompt-composer/prompt-composer-panel.js";
import "../panels/workflow-builder/workflow-builder-panel.js";

// Phase 9 panels
import "../panels/plugin-manager/plugin-manager-panel.js";

panelRegistry.register({
  id: "project-explorer",
  title: "Project Explorer",
  icon: "\u{1f3ac}", // 🎬
  component: ProjectExplorerPanel,
  defaultSlot: "left",
  defaultVisible: true,
});

panelRegistry.register({
  id: "welcome",
  title: "Welcome",
  icon: "\u2728", // ✨
  component: WelcomePanel,
  defaultSlot: "center",
  defaultVisible: true,
});