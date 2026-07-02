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
