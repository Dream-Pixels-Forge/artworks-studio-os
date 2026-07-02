/**
 * Plugin loader.
 *
 * Resolves a plugin's entry, imports it as an ESM module, finds its
 * `activate` export, and calls it with the gated context. All plugin code
 * runs inside try/catch so one plugin's failure never crashes the host.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "@main/core/logger.js";
import { config } from "@main/core/config.js";
import type { PluginContext, PluginLifecycle, PluginManifest } from "@shared/sdk/index.js";
import type { DiscoveredPlugin } from "./discovery.js";

const log = createLogger("plugins:loader");

export type ActivateFn = (ctx: PluginContext) => PluginLifecycle | Promise<PluginLifecycle>;

export interface LoadedPlugin {
  manifest: PluginManifest;
  dir: string;
  lifecycle: PluginLifecycle;
  deactivate: () => Promise<void>;
}

/** Load and activate a discovered plugin. */
export async function loadPlugin(
  discovered: DiscoveredPlugin,
  manifest: PluginManifest,
  context: PluginContext,
  unsubscribeTrackers: Set<() => void>,
): Promise<LoadedPlugin | undefined> {
  const entry = resolveEntry(discovered.dir);
  if (!entry) {
    log.error(`no entry found for plugin '${manifest.id}' in ${discovered.dir}`);
    return undefined;
  }

  let activate: ActivateFn | undefined;
  try {
    const url = pathToFileURL(entry).href;
    const mod = (await import(url)) as Record<string, unknown>;
    activate = resolveActivate(mod);
  } catch (err) {
    log.error(`failed to import plugin '${manifest.id}'`, { error: (err as Error).message });
    return undefined;
  }
  if (!activate) {
    log.error(`plugin '${manifest.id}' has no activate export`);
    return undefined;
  }

  let lifecycle: PluginLifecycle;
  try {
    lifecycle = await activate(context);
  } catch (err) {
    log.error(`activate() threw for plugin '${manifest.id}'`, {
      error: (err as Error).message,
    });
    return undefined;
  }

  // Isolate onActivate — never let it crash the host.
  try {
    await lifecycle.onActivate?.();
  } catch (err) {
    log.warn(`onActivate threw for plugin '${manifest.id}'`, {
      error: (err as Error).message,
    });
  }

  const deactivate = async () => {
    try {
      await lifecycle.onDeactivate?.();
    } catch (err) {
      log.warn(`onDeactivate threw for plugin '${manifest.id}'`, {
        error: (err as Error).message,
      });
    }
    // Tear down every subscription the plugin registered.
    for (const dispose of unsubscribeTrackers) {
      try {
        dispose();
      } catch {
        /* best effort */
      }
    }
    unsubscribeTrackers.clear();
  };

  return { manifest, dir: discovered.dir, lifecycle, deactivate };
}

/** Resolve the plugin's entry file (built JS preferred, TS in dev). */
function resolveEntry(dir: string): string | undefined {
  const candidates = [
    join(dir, "dist", "index.js"),
    join(dir, "index.js"),
    join(dir, "index.mjs"),
  ];
  // Allow .ts in dev so source plugins load without a build step.
  if (config.isDev) {
    candidates.push(join(dir, "index.ts"));
  }
  return candidates.find((p) => existsSync(p));
}

/** Find the activate export in various shapes. */
function resolveActivate(mod: Record<string, unknown>): ActivateFn | undefined {
  if (typeof mod["activate"] === "function") return mod["activate"] as ActivateFn;
  const def = mod["default"] as Record<string, unknown> | undefined;
  if (def && typeof def["activate"] === "function") return def["activate"] as ActivateFn;
  if (typeof mod["default"] === "function") return mod["default"] as ActivateFn;
  return undefined;
}
