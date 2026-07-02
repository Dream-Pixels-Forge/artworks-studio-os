/**
 * Plugin repository.
 *
 * Manages installed plugins in the `plugins` type-table. Each plugin is an
 * entity of type "plugin" with additional columns for the JSON manifest
 * and enabled state. The repository follows the entity+type-table pattern
 * used by every other repository in this codebase.
 */
import type { PluginManifest } from "@shared/sdk/manifest.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import type { Entity } from "@shared/models/index.js";

/** Row shape returned by `SELECT p.*, e.* FROM plugins p JOIN entities e …`. */
interface PluginRow {
  uuid: string;
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  owner: string | null;
  tags: string;
  metadata: string;
  manifest: string;
  enabled: number;
}

/** Public plugin record exposed to the renderer. */
export interface PluginRecord {
  uuid: string;
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  enabled: boolean;
  manifest: PluginManifest;
}

/** Input for installing a plugin. */
export interface InstallPluginInput {
  manifest: PluginManifest;
  enabled?: boolean;
}

const INSERT_PLUGIN_SQL = `
  INSERT INTO plugins (uuid, manifest, enabled)
  VALUES (?, ?, ?)
`;

export class PluginRepository {
  private readonly entityRepo: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entityRepo = new EntityRepository(db);
  }

  /** Install a plugin (creates entity + plugin row in a transaction). */
  install(input: InstallPluginInput): PluginRecord {
    const { manifest, enabled = true } = input;
    const count = this.entityRepo.countByType("plugin");
    const entity: Entity = {
      uuid: crypto.randomUUID(),
      id: `PLG-${String(count + 1).padStart(3, "0")}`,
      name: manifest.name,
      type: "plugin",
      status: "active",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      metadata: {},
    };

    this.db.transaction(() => {
      this.entityRepo.insertEntity(entity);
      this.db.exec(INSERT_PLUGIN_SQL, [
        entity.uuid,
        JSON.stringify(manifest),
        enabled ? 1 : 0,
      ]);
    });

    return this.record(entity.uuid)!;
  }

  /** Get a single plugin record by uuid. */
  record(uuid: string): PluginRecord | undefined {
    const row = this.db.get<PluginRow>(
      `SELECT e.*, p.manifest, p.enabled
       FROM plugins p
       JOIN entities e ON e.uuid = p.uuid
       WHERE p.uuid = ?`,
      [uuid],
    );
    return row ? rowToRecord(row) : undefined;
  }

  /** Get a plugin record by its manifest id (e.g. "artworks.example-hello"). */
  recordByManifestId(manifestId: string): PluginRecord | undefined {
    const row = this.db.get<PluginRow>(
      `SELECT e.*, p.manifest, p.enabled
       FROM plugins p
       JOIN entities e ON e.uuid = p.uuid
       WHERE e.id = ?`,
      [manifestId],
    );
    return row ? rowToRecord(row) : undefined;
  }

  /** List all installed plugins, newest first. */
  list(): PluginRecord[] {
    const rows = this.db.all<PluginRow>(
      `SELECT e.*, p.manifest, p.enabled
       FROM plugins p
       JOIN entities e ON e.uuid = p.uuid
       ORDER BY e.updated_at DESC`,
    );
    return rows.map(rowToRecord);
  }

  /** List only enabled plugins. */
  listEnabled(): PluginRecord[] {
    const rows = this.db.all<PluginRow>(
      `SELECT e.*, p.manifest, p.enabled
       FROM plugins p
       JOIN entities e ON e.uuid = p.uuid
       WHERE p.enabled = 1
       ORDER BY e.updated_at DESC`,
    );
    return rows.map(rowToRecord);
  }

  /** Toggle enabled state. Returns the updated record. */
  setEnabled(uuid: string, enabled: boolean): PluginRecord | undefined {
    this.db.exec(
      "UPDATE plugins SET enabled = ? WHERE uuid = ?",
      [enabled ? 1 : 0, uuid],
    );
    this.entityRepo.patchStatus(uuid, enabled ? "active" : "archived");
    return this.record(uuid);
  }

  /** Uninstall a plugin (cascades to plugins row via FK). */
  uninstall(uuid: string): void {
    this.entityRepo.deleteByUuid(uuid);
  }

  /** Count installed plugins. */
  count(): number {
    const row = this.db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM plugins",
    );
    return row?.count ?? 0;
  }
}

function rowToRecord(row: PluginRow): PluginRecord {
  let manifest: PluginManifest;
  try {
    manifest = JSON.parse(row.manifest) as PluginManifest;
  } catch {
    manifest = {
      id: row.id,
      name: row.name,
      version: "0.0.0",
      author: "unknown",
      category: "utility",
      description: "",
      sdkVersion: "0.1.0",
      permissions: [],
    };
  }
  return {
    uuid: row.uuid,
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description,
    category: manifest.category,
    enabled: row.enabled === 1,
    manifest,
  };
}
