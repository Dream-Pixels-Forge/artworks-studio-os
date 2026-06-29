/**
 * Built-in palette commands.
 *
 * Registers a seed set at import time. Modules can register more via
 * commandRegistry.register(). Register is idempotent (upsert), so this is
 * safe to import under React StrictMode's double-invoke.
 */
import { commandRegistry } from "./registry.js";

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
}
