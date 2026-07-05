/**
 * Built-in palette commands.
 *
 * Registers a seed set at import time. Modules can register more via
 * commandRegistry.register(). Register is idempotent (upsert), so this is
 * safe to import under React StrictMode's double-invoke.
 */
import { commandRegistry } from "./registry.js";
import { loadTokens } from "../ui/tokens/index.js";
import { listWorkspaces, seedBuiltinWorkspaces } from "../workspace/workspace-store.js";
import { panelRegistry } from "../workspace/registry.js";

/** Renderer event the shell listens for to open the settings panel. */
const OPEN_SETTINGS_EVENT = "artworks:open-settings";

/**
 * (Re)register one `workspace:switch:<id>` command per saved workspace.
 * Idempotent — the registry upserts on conflict — so it's safe to call after
 * every workspace add/save/delete. Without this, workspaces created after
 * initial command registration would have no palette entry until reload.
 */
export function registerWorkspaceSwitchCommands(): void {
  for (const ws of listWorkspaces()) {
    const target = ws.id;
    commandRegistry.register({
      id: `workspace:switch:${target}`,
      title: `Workspace: Switch to ${ws.name}`,
      category: "Workspace",
      run: () => {
        window.dispatchEvent(new CustomEvent("artworks:workspace-switch", { detail: { id: target } }));
      },
    });
  }
}

/** Register built-in commands. Safe to call repeatedly (idempotent). */
export function registerBuiltinCommands(): void {
  // Seed built-in workspace presets first so the per-workspace switch commands
  // below have something to iterate. The store is idempotent, so a child
  // component (WorkspaceLayout) calling this again later is a no-op. This
  // removes the implicit ordering dependency on React's effect ordering.
  seedBuiltinWorkspaces(panelRegistry.all());
  commandRegistry.register({
    id: "app.reload-tokens",
    title: "Reload design tokens",
    category: "Developer",
    run: () => {
      loadTokens();
    },
  });

  commandRegistry.register({
    id: "app.show-version",
    title: "Show version",
    category: "About",
    run: () => {
      const artworks = (window as unknown as { artworks?: { version?: string } }).artworks;
      const version = artworks?.version ?? "unknown";
      window.alert(`Artworks Studio OS ${version}`);
    },
  });

  commandRegistry.register({
    id: "app.open-settings",
    title: "Open Settings",
    category: "Preferences",
    run: () => {
      // Dispatch a renderer event the studio shell owns; avoids coupling the
      // command to shell state.
      window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
    },
  });

  // --- Workspace commands (Phase 1: Workspace System #5) ---
  // Toggle the sidebar (left) / bottom panel regions.
  commandRegistry.register({
    id: "workspace:toggle-sidebar",
    title: "View: Toggle Sidebar",
    category: "View",
    run: () => {
      window.dispatchEvent(new Event("artworks:toggle-sidebar"));
    },
  });
  commandRegistry.register({
    id: "workspace:toggle-terminal",
    title: "View: Toggle Bottom Panel",
    category: "View",
    run: () => {
      window.dispatchEvent(new Event("artworks:toggle-bottom"));
    },
  });
  // Save the current arrangement as a named workspace (prompts for a name).
  commandRegistry.register({
    id: "workspace:save-as",
    title: "Workspace: Save Current As…",
    category: "Workspace",
    run: () => {
      // Dispatched to the WorkspaceBar via a custom event with a flag so it
      // opens its inline "save as" input.
      window.dispatchEvent(new CustomEvent("artworks:workspace-save-as"));
    },
  });
  // Switch to each named workspace (one command per saved workspace). Refresh
  // whenever the set of workspaces changes (save/delete) so new ones appear.
  registerWorkspaceSwitchCommands();

  // --- Timeline commands (Phase 10) ---
  commandRegistry.register({
    id: "timeline:create-task",
    title: "Create Task",
    category: "Timeline",
    keywords: ["task", "todo", "add"],
    run: async () => {
      const name = window.prompt("Task name:");
      if (!name?.trim()) return;
      await window.artworks.production.timeline.create({ name: name.trim(), timelineType: "task" });
    },
  });

  commandRegistry.register({
    id: "timeline:create-milestone",
    title: "Create Milestone",
    category: "Timeline",
    keywords: ["milestone", "marker"],
    run: async () => {
      const name = window.prompt("Milestone name:");
      if (!name?.trim()) return;
      await window.artworks.production.timeline.create({ name: name.trim(), timelineType: "milestone" });
    },
  });

  commandRegistry.register({
    id: "timeline:show-stats",
    title: "Show Timeline Stats",
    category: "Timeline",
    keywords: ["stats", "progress"],
    run: async () => {
      const stats = await window.artworks.production.timeline.stats() as {
        tasks: number; milestones: number; completed: number; inProgress: number;
        avgProgress: number; byPriority: { low: number; medium: number; high: number; critical: number };
      };
      window.alert(
        `Timeline Stats:\n` +
        `Tasks: ${stats.tasks} | Milestones: ${stats.milestones}\n` +
        `Completed: ${stats.completed} | In Progress: ${stats.inProgress}\n` +
        `Avg Progress: ${stats.avgProgress}%\n` +
        `By Priority: Low=${stats.byPriority.low} Med=${stats.byPriority.medium} High=${stats.byPriority.high} Crit=${stats.byPriority.critical}`
      );
    },
  });

  // --- Collaboration commands (Phase 11) ---
  commandRegistry.register({
    id: "collaboration:open-panel",
    title: "Open Collaboration Panel",
    category: "Collaboration",
    keywords: ["team", "users", "activity", "comments"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "collaboration" } }));
    },
  });

  commandRegistry.register({
    id: "collaboration:add-user",
    title: "Add Team Member",
    category: "Collaboration",
    keywords: ["user", "member", "add", "invite"],
    run: async () => {
      const name = window.prompt("Display name:");
      if (!name?.trim()) return;
      const email = window.prompt("Email (optional):");
      await window.artworks.production.user.create({
        displayName: name.trim(),
        email: email?.trim() || undefined,
      });
    },
  });

  commandRegistry.register({
    id: "collaboration:list-users",
    title: "List Team Members",
    category: "Collaboration",
    keywords: ["users", "members", "team"],
    run: async () => {
      const users = await window.artworks.production.user.list() as Array<{
        uuid: string; displayName: string; role: string; isActive: boolean;
      }>;
      const list = users.map((u) => `${u.displayName} (${u.role}) - ${u.isActive ? "Active" : "Inactive"}`).join("\n");
      window.alert(`Team Members:\n${list || "None"}`);
    },
  });

  commandRegistry.register({
    id: "collaboration:show-activity",
    title: "Show Recent Activity",
    category: "Collaboration",
    keywords: ["activity", "feed", "log"],
    run: async () => {
      const activities = await window.artworks.production.activity.list(undefined, 20) as Array<{
        uuid: string; action: string; entityType: string; createdAt: string;
      }>;
      const list = activities.map((a) => `${a.action} ${a.entityType} - ${new Date(a.createdAt).toLocaleString()}`).join("\n");
      window.alert(`Recent Activity:\n${list || "None"}`);
    },
  });

  // --- Studio Platform commands (Phase 12) ---
  commandRegistry.register({
    id: "studio:open-panel",
    title: "Open Studio Panel",
    category: "Studio",
    keywords: ["studio", "departments", "approvals", "reviews"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "studio" } }));
    },
  });

  commandRegistry.register({
    id: "studio:create-department",
    title: "Create Department",
    category: "Studio",
    keywords: ["department", "team", "add"],
    run: async () => {
      const name = window.prompt("Department name:");
      if (!name?.trim()) return;
      await window.artworks.production.department.create({ name: name.trim() });
    },
  });

  commandRegistry.register({
    id: "studio:list-departments",
    title: "List Departments",
    category: "Studio",
    keywords: ["departments", "teams"],
    run: async () => {
      const depts = await window.artworks.production.department.list() as Array<{
        uuid: string; name: string; description: string;
      }>;
      const list = depts.map((d) => `${d.name}${d.description ? ` - ${d.description}` : ""}`).join("\n");
      window.alert(`Departments:\n${list || "None"}`);
    },
  });

  commandRegistry.register({
    id: "studio:show-stats",
    title: "Show Studio Stats",
    category: "Studio",
    keywords: ["stats", "analytics", "overview"],
    run: async () => {
      const [deptStats, approvalStats, reviewStats] = await Promise.all([
        window.artworks.production.department.stats() as Promise<{ total: number; members: number }>,
        window.artworks.production.approval.stats() as Promise<{ total: number; pending: number; approved: number; rejected: number }>,
        window.artworks.production.review.stats() as Promise<{ total: number; pending: number; inProgress: number; completed: number; avgRating: number }>,
      ]);
      window.alert(
        `Studio Stats:\n` +
        `Departments: ${deptStats.total} (${deptStats.members} members)\n` +
        `Approvals: ${approvalStats.total} total (${approvalStats.pending} pending)\n` +
        `Reviews: ${reviewStats.total} total (${reviewStats.pending} pending)\n` +
        `Avg Rating: ${reviewStats.avgRating.toFixed(1)}`
      );
    },
  });

  // --- Agent Teams commands (Phase 13) ---
  commandRegistry.register({
    id: "agent:create",
    title: "Create AI Agent",
    category: "AI Teams",
    keywords: ["agent", "create", "ai"],
    run: async () => {
      const agents = await window.artworks.production.agent.list();
      console.log(`Current agents: ${(agents as Array<{ name: string }>).map((a) => a.name).join(", ") || "none"}`);
    },
  });

  commandRegistry.register({
    id: "agent:list",
    title: "List AI Agents",
    category: "AI Teams",
    keywords: ["agent", "list", "ai"],
    run: async () => {
      const [agents, stats] = await Promise.all([
        window.artworks.production.agent.list(),
        window.artworks.production.agent.stats(),
      ]);
      const agentList = agents as Array<{ name: string; role: string; status: string }>;
      const s = stats as { total: number; idle: number; busy: number };
      console.log(
        `Agents: ${agentList.length} total, ` +
        `Idle: ${s.idle}, Busy: ${s.busy}\n` +
        agentList.map((a) => `  ${a.name} (${a.role}) — ${a.status}`).join("\n")
      );
    },
  });

  commandRegistry.register({
    id: "agent:stats",
    title: "AI Teams Stats",
    category: "AI Teams",
    keywords: ["agent", "stats", "ai"],
    run: async () => {
      const [agentStats, taskStats] = await Promise.all([
        window.artworks.production.agent.stats(),
        window.artworks.production.agentTask.stats(),
      ]);
      const a = agentStats as { total: number; idle: number; busy: number };
      const t = taskStats as { total: number; pending: number; inProgress: number; completed: number };
      console.log(
        `Agents: ${a.total} total, ${a.idle} idle, ${a.busy} busy\n` +
        `Tasks: ${t.total} total, ${t.pending} pending, ${t.inProgress} in progress, ${t.completed} completed`
      );
    },
  });

  // --- Node Production commands (Phase 14) ---
  commandRegistry.register({
    id: "node-workflow:create",
    title: "Create Node Workflow",
    category: "Node Production",
    keywords: ["node", "workflow", "create", "pipeline"],
    run: async () => {
      const name = window.prompt("Workflow name:");
      if (!name?.trim()) return;
      await window.artworks.production.nodeWorkflow.create({ name: name.trim() });
      console.log(`Created workflow: ${name}`);
    },
  });

  commandRegistry.register({
    id: "node-workflow:list",
    title: "List Node Workflows",
    category: "Node Production",
    keywords: ["node", "workflow", "list"],
    run: async () => {
      const workflows = await window.artworks.production.nodeWorkflow.list() as Array<{
        uuid: string; name: string; status: string; nodeCount: number;
      }>;
      const list = workflows.map((w) => `${w.name} (${w.status}) - ${w.nodeCount} nodes`).join("\n");
      console.log(`Node Workflows:\n${list || "None"}`);
    },
  });

  commandRegistry.register({
    id: "node-workflow:stats",
    title: "Node Workflow Stats",
    category: "Node Production",
    keywords: ["node", "workflow", "stats"],
    run: async () => {
      const stats = await window.artworks.production.nodeWorkflow.stats() as {
        total: number; draft: number; active: number; archived: number;
      };
      console.log(
        `Node Workflows:\n` +
        `Total: ${stats.total}\n` +
        `Draft: ${stats.draft}\n` +
        `Active: ${stats.active}\n` +
        `Archived: ${stats.archived}`
      );
    },
  });

  commandRegistry.register({
    id: "node-workflow:open-panel",
    title: "Open Node Production Panel",
    category: "Node Production",
    keywords: ["node", "workflow", "panel", "canvas"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "node-production" } }));
    },
  });

  // --- Marketplace commands (Phase 15) ---
  commandRegistry.register({
    id: "marketplace:open-panel",
    title: "Open Marketplace",
    category: "Marketplace",
    keywords: ["marketplace", "browse", "install", "plugins", "templates"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "marketplace" } }));
    },
  });

  commandRegistry.register({
    id: "marketplace:search",
    title: "Search Marketplace",
    category: "Marketplace",
    keywords: ["search", "find", "browse"],
    run: async () => {
      const query = window.prompt("Search marketplace:");
      if (!query?.trim()) return;
      const results = await window.artworks.marketplace.list({ search: query.trim() }) as Array<{
        name: string; version: string; category: string; rating: number;
      }>;
      const list = results.map((r) => `${r.name} v${r.version} (${r.category}) ★${r.rating.toFixed(1)}`).join("\n");
      window.alert(`Search Results:\n${list || "No results found."}`);
    },
  });

  commandRegistry.register({
    id: "marketplace:show-stats",
    title: "Show Marketplace Stats",
    category: "Marketplace",
    keywords: ["stats", "analytics", "marketplace"],
    run: async () => {
      const stats = await window.artworks.marketplace.stats() as {
        totalListings: number; totalDownloads: number; avgRating: number;
        byCategory: Record<string, number>; byType: Record<string, number>;
      };
      const cats = Object.entries(stats.byCategory).map(([k, v]) => `${k}: ${v}`).join(", ");
      const types = Object.entries(stats.byType).map(([k, v]) => `${k}: ${v}`).join(", ");
      window.alert(
        `Marketplace Stats:\n` +
        `Total Listings: ${stats.totalListings}\n` +
        `Total Downloads: ${stats.totalDownloads.toLocaleString()}\n` +
        `Avg Rating: ${stats.avgRating.toFixed(1)}\n` +
        `By Category: ${cats || "None"}\n` +
        `By Type: ${types || "None"}`
      );
    },
  });

  // --- Production Intelligence commands (Phase 17) ---
  commandRegistry.register({
    id: "intelligence:open-panel",
    title: "Open Production Intelligence",
    category: "Intelligence",
    keywords: ["intelligence", "analytics", "dashboard", "stats", "insights"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "production-intelligence" } }));
    },
  });

  commandRegistry.register({
    id: "intelligence:show-summary",
    title: "Show Production Summary",
    category: "Intelligence",
    keywords: ["summary", "overview", "analytics"],
    run: async () => {
      const s = await window.artworks.intelligence.summary() as {
        health: { entities: number; projects: number; activeTasks: number; overdueTimelines: number };
        ai: { totalTasks: number; completionRate: number };
        team: { totalUsers: number; activeUsers: number };
      };
      window.alert(
        `Production Summary:\n` +
        `Entities: ${s.health.entities} | Projects: ${s.health.projects}\n` +
        `Active Tasks: ${s.health.activeTasks} | Overdue: ${s.health.overdueTimelines}\n` +
        `AI Tasks: ${s.ai.totalTasks} (${s.ai.completionRate}% completion)\n` +
        `Team: ${s.team.activeUsers}/${s.team.totalUsers} active`
      );
    },
  });

  commandRegistry.register({
    id: "intelligence:show-health",
    title: "Show Production Health",
    category: "Intelligence",
    keywords: ["health", "status", "overview"],
    run: async () => {
      const h = await window.artworks.intelligence.health() as {
        entities: number; projects: number; assets: number; documents: number;
        activeWorkflows: number; pendingApprovals: number; agents: number;
        activeTasks: number; overdueTimelines: number;
      };
      window.alert(
        `Production Health:\n` +
        `Entities: ${h.entities} | Projects: ${h.projects}\n` +
        `Assets: ${h.assets} | Documents: ${h.documents}\n` +
        `Workflows: ${h.activeWorkflows} | Approvals: ${h.pendingApprovals}\n` +
        `Agents: ${h.agents} | Tasks: ${h.activeTasks}\n` +
        `Overdue Timelines: ${h.overdueTimelines}`
      );
    },
  });

  // --- Production Lifecycle commands (Phase 18) ---
  commandRegistry.register({
    id: "lifecycle:open-panel",
    title: "Open Production Lifecycle",
    category: "Lifecycle",
    keywords: ["lifecycle", "state", "production", "workflow", "pipeline"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "lifecycle" } }));
    },
  });

  commandRegistry.register({
    id: "lifecycle:show-stats",
    title: "Show Lifecycle Stats",
    category: "Lifecycle",
    keywords: ["stats", "overview", "production"],
    run: async () => {
      const s = await window.artworks.lifecycle.stats() as {
        total: number; byState: Record<string, number>;
        transitionsToday: number; avgTimeInStateHours: number;
      };
      window.alert(
        `Lifecycle Stats:\n` +
        `Total: ${s.total}\n` +
        `By State: ${Object.entries(s.byState).map(([k, v]) => `${k}: ${v}`).join(", ")}\n` +
        `Transitions Today: ${s.transitionsToday}\n` +
        `Avg Time in State: ${s.avgTimeInStateHours}h`
      );
    },
  });

  // --- Notification Center commands (Phase 18) ---
  commandRegistry.register({
    id: "notification:open-panel",
    title: "Open Notification Center",
    category: "Notifications",
    keywords: ["notifications", "alerts", "unread", "dismiss"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "notification-center" } }));
    },
  });

  commandRegistry.register({
    id: "notification:unread-count",
    title: "Show Unread Notification Count",
    category: "Notifications",
    keywords: ["unread", "count", "badge"],
    run: async () => {
      const r = await window.artworks.notification["unread-count"]() as { count: number };
      window.alert(`Unread notifications: ${r.count}`);
    },
  });

  // --- Backup & Recovery commands (Phase 18) ---
  commandRegistry.register({
    id: "backup:open-panel",
    title: "Open Backup & Recovery",
    category: "Backup",
    keywords: ["backup", "restore", "recovery", "export", "import"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "backup-recovery" } }));
    },
  });

  commandRegistry.register({
    id: "backup:create",
    title: "Create Database Backup",
    category: "Backup",
    keywords: ["backup", "create", "save"],
    run: async () => {
      const r = await window.artworks.backup.create("manual", "Manual backup") as { backupPath: string; sizeBytes: number };
      window.alert(`Backup created: ${r.backupPath} (${r.sizeBytes} bytes)`);
    },
  });

  commandRegistry.register({
    id: "backup:show-stats",
    title: "Show Backup Stats",
    category: "Backup",
    keywords: ["stats", "overview", "backup"],
    run: async () => {
      const s = await window.artworks.backup.stats() as {
        totalBackups: number; totalSizeBytes: number;
        newestBackup: string | null; recoveryPoints: number;
      };
      window.alert(
        `Backup Stats:\n` +
        `Total: ${s.totalBackups} backups\n` +
        `Size: ${s.totalSizeBytes} bytes\n` +
        `Last: ${s.newestBackup ?? "Never"}\n` +
        `Recovery Points: ${s.recoveryPoints}`
      );
    },
  });

  // --- Preferences commands (Phase 18) ---
  commandRegistry.register({
    id: "preferences:open",
    title: "Open Preferences",
    category: "Settings",
    keywords: ["settings", "preferences", "api keys", "shortcuts", "theme"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "preferences" } }));
    },
  });

  // --- Enterprise commands (Phase 16) ---
  commandRegistry.register({
    id: "enterprise:open-panel",
    title: "Open Enterprise Panel",
    category: "Enterprise",
    keywords: ["enterprise", "teams", "roles", "audit", "license", "admin"],
    run: () => {
      window.dispatchEvent(new CustomEvent("artworks:open-panel", { detail: { panelId: "enterprise" } }));
    },
  });

  commandRegistry.register({
    id: "enterprise:create-team",
    title: "Create Team",
    category: "Enterprise",
    keywords: ["team", "create", "add"],
    run: async () => {
      const name = window.prompt("Team name:");
      if (!name?.trim()) return;
      const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
      await window.artworks.enterprise.team.create({ name: name.trim(), slug });
    },
  });

  commandRegistry.register({
    id: "enterprise:show-stats",
    title: "Show Enterprise Stats",
    category: "Enterprise",
    keywords: ["stats", "enterprise", "teams", "roles"],
    run: async () => {
      const [teamStats, roleStats, auditCount] = await Promise.all([
        window.artworks.enterprise.team.stats() as Promise<{ total: number; members: number }>,
        window.artworks.enterprise.role.stats() as Promise<{ total: number; system: number }>,
        window.artworks.enterprise.audit.count() as Promise<number>,
      ]);
      window.alert(
        `Enterprise Stats:\n` +
        `Teams: ${teamStats.total} (${teamStats.members} members)\n` +
        `Roles: ${roleStats.total} (${roleStats.system} system)\n` +
        `Audit Entries: ${auditCount}`
      );
    },
  });
}

/** Register commands from enabled plugins into the command palette. */
export async function registerPluginCommands(): Promise<void> {
  try {
    const plugins = await window.artworks.plugin.list();
    for (const plugin of plugins as Array<{
      uuid: string;
      manifest: {
        id?: string;
        commands?: Array<{
          id: string;
          title: string;
          description?: string;
          keywords?: string[];
          category?: string;
        }>;
      };
    }>) {
      const commands = plugin.manifest.commands;
      if (!commands?.length) continue;
      for (const cmd of commands) {
        commandRegistry.register({
          id: `plugin:${plugin.uuid}:${cmd.id}`,
          title: cmd.title,
          category: cmd.category ?? plugin.manifest.id ?? plugin.uuid,
          keywords: cmd.keywords,
          run: async () => { await window.artworks.plugin.executeCommand(plugin.uuid, cmd.id); },
        });
      }
    }
  } catch (err) {
    // Plugin command registration is best-effort; don't break the palette.
    console.warn("Failed to register plugin commands:", err);
  }
}
