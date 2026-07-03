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

// Phase 10 panels
import "../panels/timeline/timeline-panel.js";

// Phase 11 panels
import "../panels/collaboration/collaboration-panel.js";

// Phase 12 panels
import "../panels/studio/studio-panel.js";

// Phase 13 panels
import "../panels/agent-teams/agent-teams-panel.js";

// Phase 14 panels
import "../panels/node-production/node-production-panel.js";

// Phase 15 panels
import "../panels/marketplace/marketplace-panel.js";

// Phase 16 panels
import "../panels/enterprise/enterprise-panel.js";

// Phase 17 panels
import "../panels/production-intelligence/production-intelligence-panel.js";

// Phase 18 panels
import "../panels/lifecycle/lifecycle-panel.js";
import "../panels/notification-center/notification-center-panel.js";
import "../panels/backup-recovery/backup-recovery-panel.js";
import "../panels/preferences/preferences-panel.js";

// Phase 19 panels
import ExportPanel from "../panels/export/export-panel.js";

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

panelRegistry.register({
  id: "export",
  title: "Production Export",
  icon: "\uD83D\uDCC4",
  component: ExportPanel,
  defaultSlot: "center",
  defaultVisible: false,
});