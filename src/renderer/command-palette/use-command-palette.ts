/**
 * Command palette hook.
 *
 * Holds open/close state, registers the global Ctrl/Cmd+K hotkey (renderer
 * keydown — not Electron globalShortcut, which is OS-wide), and runs the
 * selected command (recording recency).
 */
import { useCallback, useEffect, useState } from "react";
import { commandRegistry } from "./registry.js";
import { recordUse } from "./recency.js";

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  // Global hotkey: Ctrl/Cmd+K.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  /** Run a command by id, record recency, and close the palette. */
  const run = useCallback(async (id: string): Promise<void> => {
    const command = commandRegistry.list().find((c) => c.id === id);
    if (!command) return;
    recordUse(id);
    close();
    await command.run();
  }, [close]);

  return { open, toggle, close, run };
}
