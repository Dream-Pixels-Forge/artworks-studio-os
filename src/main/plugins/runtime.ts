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

    for (const candidate of discovered) {
      await this.loadOne(candidate);
    }
    log.info(`${this.loaded.length} plugin(s) active`);
  }

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
