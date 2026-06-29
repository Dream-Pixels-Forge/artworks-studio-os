/**
 * Production filesystem service.
 *
 * Reads the studio home layout directly with Node fs. This mirrors the
 * `aw` CLI's production.py exactly (same paths, same active-project pointer)
 * rather than spawning `aw` — the CLI has no --json output and no tree
 * command, so parsing would be brittle and the tree walk would still be
 * needed in TS anyway.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_DIRECTORIES, type ProductionDirectory } from "@shared/production/index.js";
import { createLogger } from "@main/core/logger.js";
import type {
  ExplorerError,
  ProductionManifest,
  ProductionSummary,
  TreeNode,
} from "./types.js";

const log = createLogger("explorer");
const MANIFEST = "project.json";
const ACTIVE_POINTER = "active-project"; // relative to <home>/config/

export class ProductionFs {
  constructor(private readonly home: string) {}

  /** List all productions in the studio, marking the active one. */
  async listProductions(): Promise<ProductionSummary[]> {
    const projectsRoot = join(this.home, "projects");
    if (!existsSync(projectsRoot)) return [];
    const active = await this.readActiveName();

    const entries = await readdir(projectsRoot, { withFileTypes: true });
    const summaries: ProductionSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const root = join(projectsRoot, entry.name);
      const manifestPath = join(root, MANIFEST);
      if (!existsSync(manifestPath)) continue;
      summaries.push({
        name: entry.name,
        root,
        manifestPath,
        isActive: entry.name === active,
        manifest: await this.readManifestSafe(root),
      });
    }
    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The currently active production, or null. */
  async getActiveProduction(): Promise<ProductionSummary | null> {
    const name = await this.readActiveName();
    if (!name) return null;
    return this.findProductionByName(name);
  }

  /** Set a production active (mirrors set_active_production). Returns it. */
  async openProduction(name: string): Promise<ProductionSummary> {
    const production = await this.findProductionByName(name);
    await this.writeActiveName(name);
    log.info("production opened", { name });
    return production;
  }

  /** The production root node with its capability dirs as children (depth 1). */
  async getProductionTree(name: string): Promise<TreeNode> {
    const production = await this.findProductionByName(name);
    const children: TreeNode[] = await Promise.all(
      PRODUCTION_DIRECTORIES.map(async (dir) => {
        const dirPath = join(production.root, dir);
        return {
          name: dir,
          path: dirPath,
          kind: "directory" as const,
          directoryType: dir as ProductionDirectory,
        };
      }),
    );
    return { name, path: production.root, kind: "production", children };
  }

  /** Lazy children for one directory (keeps large renders/ dirs snappy). */
  async expandNode(path: string): Promise<TreeNode[]> {
    if (!existsSync(path)) return [];
    const entries = await readdir(path, { withFileTypes: true });
    return Promise.all(
      entries.map(async (entry) => {
        const childPath = join(path, entry.name);
        const kind = entry.isDirectory() ? "directory" : "file";
        return { name: entry.name, path: childPath, kind } as TreeNode;
      }),
    );
  }

  /** Read a production's manifest. Throws structured error if invalid. */
  async readManifest(name: string): Promise<ProductionManifest> {
    const production = await this.findProductionByName(name);
    const text = await readFile(join(production.root, MANIFEST), "utf-8");
    try {
      return JSON.parse(text) as ProductionManifest;
    } catch {
      throw manifestError(production.root);
    }
  }

  // --- internals ---

  private async findProductionByName(name: string): Promise<ProductionSummary> {
    const root = join(this.home, "projects", name);
    const manifestPath = join(root, MANIFEST);
    if (!existsSync(manifestPath)) {
      throw notFound(name, root);
    }
    const active = await this.readActiveName();
    return {
      name,
      root,
      manifestPath,
      isActive: name === active,
      manifest: await this.readManifestSafe(root),
    };
  }

  private async readManifestSafe(root: string): Promise<ProductionManifest | null> {
    try {
      const text = await readFile(join(root, MANIFEST), "utf-8");
      return JSON.parse(text) as ProductionManifest;
    } catch {
      return null;
    }
  }

  private async readActiveName(): Promise<string | null> {
    const pointer = join(this.home, "config", ACTIVE_POINTER);
    if (!existsSync(pointer)) return null;
    try {
      const name = (await readFile(pointer, "utf-8")).trim();
      return name || null;
    } catch {
      return null;
    }
  }

  private async writeActiveName(name: string): Promise<void> {
    const configDir = join(this.home, "config");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, ACTIVE_POINTER), name, "utf-8");
  }

  /** Whether the studio home is initialized (marker file present). */
  isStudioInitialized(): boolean {
    return existsSync(join(this.home, "studio.json"));
  }
}

function notFound(name: string, root: string): ExplorerError & { name: string } {
  const err: ExplorerError = {
    code: "PRODUCTION_NOT_FOUND",
    message: `Production '${name}' not found at ${root}.`,
  };
  return Object.assign(err, { name });
}

function manifestError(root: string): ExplorerError {
  return { code: "MANIFEST_INVALID", message: `Invalid manifest at ${root}.` };
}

/** Is a thrown value one of our structured ExplorerErrors? */
export function isExplorerError(value: unknown): value is ExplorerError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ExplorerError).code === "string"
  );
}
