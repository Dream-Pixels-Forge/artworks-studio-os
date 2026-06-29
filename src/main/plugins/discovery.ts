/**
 * Plugin discovery.
 *
 * Scans two roots for plugins (each a directory containing manifest.json),
 * then dedupes by id (user-dir wins over builtin). Missing dirs are fine —
 * they return no candidates rather than throwing.
 */
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "@main/core/logger.js";

const log = createLogger("plugins:discovery");

export interface DiscoveredPlugin {
  id: string;
  dir: string;
  manifestPath: string;
  source: "builtin" | "user";
}

export interface DiscoveryOptions {
  builtinDir: string;
  userDir: string;
}

/** Discover plugins across builtin + user directories. */
export function discoverPlugins(options: DiscoveryOptions): DiscoveredPlugin[] {
  const builtin = scan(options.builtinDir, "builtin");
  const user = scan(options.userDir, "user");
  const byId = new Map<string, DiscoveredPlugin>();
  for (const p of builtin) byId.set(p.id, p);
  for (const p of user) byId.set(p.id, p); // user overrides builtin
  return [...byId.values()];
}

function scan(root: string, source: "builtin" | "user"): DiscoveredPlugin[] {
  if (!existsSync(root)) return [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (err) {
    log.warn(`could not read plugin dir ${root}`, { error: (err as Error).message });
    return [];
  }

  const found: DiscoveredPlugin[] = [];
  for (const name of entries) {
    const dir = join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const manifestPath = join(dir, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const id = readId(manifestPath);
    if (id) found.push({ id, dir, manifestPath, source });
  }
  return found;
}

function readId(manifestPath: string): string | undefined {
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
    return typeof raw?.id === "string" ? raw.id : undefined;
  } catch {
    return undefined;
  }
}
