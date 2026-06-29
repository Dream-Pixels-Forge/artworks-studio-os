/**
 * Command registry (renderer-side).
 *
 * A tiny module-level store modules register palette commands into. Kept
 * separate from the main-process command bus (which is app-logic dispatch,
 * not UI). Subscribe lets the palette re-render when commands change.
 */
import type { PaletteCommand } from "@shared/palette/command.js";

type Listener = () => void;

class CommandRegistry {
  private commands = new Map<string, PaletteCommand>();
  private listeners = new Set<Listener>();

  /** Register a command. Idempotent: re-registering the same id upserts. */
  register(command: PaletteCommand): () => void {
    this.commands.set(command.id, command);
    this.emit();
    return () => {
      this.commands.delete(command.id);
      this.emit();
    };
  }

  unregister(id: string): void {
    if (this.commands.delete(id)) this.emit();
  }

  list(): PaletteCommand[] {
    return [...this.commands.values()];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const commandRegistry = new CommandRegistry();
