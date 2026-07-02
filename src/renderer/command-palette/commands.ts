/**
 * Built-in palette commands.
 *
 * Registers a seed set at import time. Modules can register more via
 * commandRegistry.register(). Register is idempotent (upsert), so this is
 * safe to import under React StrictMode's double-invoke.
 */
import { commandRegistry } from "./registry.js";

/** Renderer event the shell listens for to open the settings panel. */
const OPEN_SETTINGS_EVENT = "artworks:open-settings";

/** Register built-in commands. Safe to call repeatedly (idempotent). */
export function registerBuiltinCommands(): void {
  commandRegistry.register({
    id: "app.reload-tokens",
    title: "Reload design tokens",
    category: "Developer",
    run: async () => {
      const { loadTokens } = await import("../ui/tokens/index.js");
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
