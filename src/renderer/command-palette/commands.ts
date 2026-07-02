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
}
