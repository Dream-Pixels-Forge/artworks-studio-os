/**
 * Panel registry.
 *
 * Panels register themselves at import time. The workspace layout reads
 * the registry to know what components to render and in which slot.
 */
import type { PanelDefinition } from "./types.js";

class PanelRegistry {
  private panels = new Map<string, PanelDefinition>();

  register(def: PanelDefinition): void {
    if (this.panels.has(def.id)) {
      throw new Error(`Panel '${def.id}' is already registered.`);
    }
    this.panels.set(def.id, def);
  }

  get(id: string): PanelDefinition | undefined {
    return this.panels.get(id);
  }

  all(): readonly PanelDefinition[] {
    return [...this.panels.values()];
  }

  has(id: string): boolean {
    return this.panels.has(id);
  }
}

export const panelRegistry = new PanelRegistry();