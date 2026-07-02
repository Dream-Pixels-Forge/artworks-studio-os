/**
 * Plugin runtime orchestrator.
 *
 * The single entry the rest of main calls. Discovers, validates, loads,
 * and activates plugins; tracks them for clean teardown.
 */
import { readFileSync } from "node:fs";
import { createLogger } from "@main/core/logger.js";
import type { StudioDatabase } from "@main/database/db.js";
import { discoverPlugins, type DiscoveredPlugin } from "./discovery.js";
import { parseManifest } from "./validator.js";
import { buildHostServices } from "./host-services.js";
import { buildPluginContext } from "./context.js";
import { loadPlugin, type LoadedPlugin } from "./loader.js";
import { PluginRepository } from "../database/repositories/plugin-repository.js";

const log = createLogger("plugins:runtime");

export interface RuntimeOptions {
  builtinDir: string;
  userDir: string;
}

export class PluginRuntime {
  private loaded: LoadedPlugin[] = [];
  private readonly opts: RuntimeOptions;
  private readonly db?: StudioDatabase | null;

  constructor(opts: RuntimeOptions, db?: StudioDatabase | null) {
    this.opts = opts;
    this.db = db;
  }

  /** Discover, validate, load, and activate all plugins. */
  async start(): Promise<void> {
    const discovered = discoverPlugins(this.opts);
    log.info(`discovered ${discovered.length} plugin(s)`);

    // If a DB is available, only load plugins that are enabled.
    const enabledIds = this.db
      ? new Set(new PluginRepository(this.db).listEnabled().map((r) => r.uuid))
      : null;

    for (const candidate of discovered) {
      // Skip DB-registered but disabled plugins.
      if (enabledIds && !enabledIds.has(candidate.id)) {
        log.info(`skipping disabled plugin '${candidate.id}'`);
        continue;
      }
      await this.loadOne(candidate);
    }
    log.info(`${this.loaded.length} plugin(s) active`);
  }

  /** Load a single plugin by its discovery info. */
  private async loadOne(candidate: DiscoveredPlugin): Promise<void> {
    const validation = parseManifest(readFileSync(candidate.manifestPath, "utf-8"));
    if (!validation.ok) {
      log.error(`skipping '${candidate.id}': manifest invalid`, { errors: validation.errors });
      return;
    }
    const manifest = validation.manifest;
    const unsubscribeTrackers = new Set<() => void>();
    const services = buildHostServices(unsubscribeTrackers, this.db);
    const context = buildPluginContext(manifest, services);
    const loaded = await loadPlugin(candidate, manifest, context, unsubscribeTrackers);
    if (loaded) this.loaded.push(loaded);
  }

  /** Enable a plugin at runtime. Loads and activates it if not already active. */
  async enable(uuid: string): Promise<void> {
    if (this.loaded.some((p) => p.manifest.id === uuid)) {
      return; // already active
    }
    const discovered = discoverPlugins(this.opts);
    const candidate = discovered.find((d) => d.id === uuid);
    if (!candidate) {
      throw new Error(`plugin '${uuid}' not found on disk`);
    }
    await this.loadOne(candidate);
    // Persist enabled state in DB.
    if (this.db) {
      new PluginRepository(this.db).setEnabled(uuid, true);
    }
    log.info(`plugin '${uuid}' enabled`);
  }

  /** Disable a plugin at runtime. Deactivates and unloads it. */
  async disable(uuid: string): Promise<void> {
    const idx = this.loaded.findIndex((p) => p.manifest.id === uuid);
    if (idx === -1) return; // not active
    const [plugin] = this.loaded.splice(idx, 1);
    try {
      await plugin.deactivate();
    } catch (err) {
      log.warn(`error deactivating '${plugin.manifest.id}'`, {
        error: (err as Error).message,
      });
    }
    // Persist disabled state in DB.
    if (this.db) {
      new PluginRepository(this.db).setEnabled(uuid, false);
    }
    log.info(`plugin '${uuid}' disabled`);
  }

  /** Deactivate all plugins. Safe to call on shutdown or when nothing loaded. */
  async stop(): Promise<void> {
    for (const plugin of this.loaded) {
      try {
        await plugin.deactivate();
      } catch (err) {
        log.warn(`error deactivating '${plugin.manifest.id}'`, {
          error: (err as Error).message,
        });
      }
    }
    this.loaded = [];
  }

  /** List active plugins (for UI / debugging). */
  list(): readonly LoadedPlugin[] {
    return this.loaded;
  }
}
