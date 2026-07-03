/**
 * Backup service — handles database backup/restore, production export/import,
 * and crash recovery metadata. Phase 18.3.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type Database from "better-sqlite3";

export interface BackupMetadata {
  uuid: string;
  type: "manual" | "auto" | "pre_migration" | "crash_recovery";
  label: string;
  databasePath: string;
  backupPath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface CrashRecoveryPoint {
  uuid: string;
  operation: string;
  databasePath: string;
  backupPath: string;
  createdAt: string;
}

const BACKUP_ROOT = join(homedir(), ".artworks-studio", "backups");
const RECOVERY_DIR = join(BACKUP_ROOT, ".recovery");
const MAX_BACKUPS = 20;
const MAX_RECOVERY_POINTS = 5;

export class BackupService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!existsSync(BACKUP_ROOT)) mkdirSync(BACKUP_ROOT, { recursive: true });
    if (!existsSync(RECOVERY_DIR)) mkdirSync(RECOVERY_DIR, { recursive: true });
  }

  /**
   * Create a backup of the current database.
   */
  createBackup(type: BackupMetadata["type"], label?: string): BackupMetadata {
    const dbPath = this.db.name;
    const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${type}-${timestamp}-${uuid.slice(0, 8)}.sqlite`;
    const backupPath = join(BACKUP_ROOT, filename);

    // Use SQLite VACUUM INTO for a consistent backup
    this.db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    const stats = statSync(backupPath);
    const metadata: BackupMetadata = {
      uuid,
      type,
      label: label ?? `${type} backup`,
      databasePath: dbPath,
      backupPath,
      sizeBytes: stats.size,
      createdAt: new Date().toISOString(),
    };

    // Write metadata sidecar
    writeFileSync(`${backupPath}.meta.json`, JSON.stringify(metadata, null, 2));

    this.pruneOldBackups();
    return metadata;
  }

  /**
   * Restore the database from a backup file.
   */
  restoreBackup(backupPath: string): boolean {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const dbPath = this.db.name;

    // Create a safety backup before restore
    this.createBackup("pre_migration", "Auto backup before restore");

    // Close the current database, copy backup over, reopen
    // Note: In Electron, the caller should handle DB lifecycle
    copyFileSync(backupPath, dbPath);
    return true;
  }

  /**
   * List all available backups.
   */
  listBackups(): BackupMetadata[] {
    if (!existsSync(BACKUP_ROOT)) return [];

    const files = readdirSync(BACKUP_ROOT).filter(f => f.endsWith(".meta.json"));
    const backups: BackupMetadata[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(BACKUP_ROOT, file), "utf-8");
        backups.push(JSON.parse(content) as BackupMetadata);
      } catch {
        // Skip corrupted metadata
      }
    }

    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Delete a specific backup.
   */
  deleteBackup(uuid: string): boolean {
    const backups = this.listBackups();
    const backup = backups.find(b => b.uuid === uuid);
    if (!backup) return false;

    if (existsSync(backup.backupPath)) unlinkSync(backup.backupPath);
    const metaPath = `${backup.backupPath}.meta.json`;
    if (existsSync(metaPath)) unlinkSync(metaPath);
    return true;
  }

  /**
   * Export a production as a self-contained JSON bundle.
   */
  exportProduction(entityUuid: string): {
    entities: unknown[];
    graphs: unknown[];
    knowledge: unknown[];
    exportedAt: string;
  } {
    const entities = this.db.prepare(`
      SELECT * FROM entities WHERE uuid = ?
    `).all(entityUuid);

    const graphs = this.db.prepare(`
      SELECT * FROM graph_nodes WHERE entity_uuid = ?
    `).all(entityUuid);

    return {
      entities,
      graphs,
      knowledge: [],
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import a production from a JSON bundle.
   */
  importProduction(data: {
    entities: Array<Record<string, unknown>>;
    graphs?: Array<Record<string, unknown>>;
  }): { imported: number; skipped: number } {
    let imported = 0;
    let skipped = 0;

    const insertEntity = this.db.prepare(`
      INSERT OR IGNORE INTO entities (uuid, type, name, status, project_uuid, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entity of data.entities) {
      const result = insertEntity.run(
        entity.uuid, entity.type, entity.name, entity.status,
        entity.project_uuid ?? null, entity.data ?? null,
        entity.created_at ?? new Date().toISOString(),
        entity.updated_at ?? new Date().toISOString(),
      );
      if (result.changes > 0) imported++;
      else skipped++;
    }

    return { imported, skipped };
  }

  // --- Crash Recovery ---

  /**
   * Save a recovery point before a critical operation.
   */
  saveRecoveryPoint(operation: string): CrashRecoveryPoint {
    if (!existsSync(RECOVERY_DIR)) mkdirSync(RECOVERY_DIR, { recursive: true });

    const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const dbPath = this.db.name;
    const backupPath = join(RECOVERY_DIR, `recovery-${uuid.slice(0, 8)}.sqlite`);

    this.db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    const point: CrashRecoveryPoint = {
      uuid,
      operation,
      databasePath: dbPath,
      backupPath,
      createdAt: new Date().toISOString(),
    };

    writeFileSync(join(RECOVERY_DIR, `${uuid}.json`), JSON.stringify(point, null, 2));
    this.pruneRecoveryPoints();
    return point;
  }

  /**
   * List available recovery points.
   */
  listRecoveryPoints(): CrashRecoveryPoint[] {
    if (!existsSync(RECOVERY_DIR)) return [];

    const files = readdirSync(RECOVERY_DIR).filter(f => f.endsWith(".json"));
    const points: CrashRecoveryPoint[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(RECOVERY_DIR, file), "utf-8");
        points.push(JSON.parse(content) as CrashRecoveryPoint);
      } catch {
        // Skip corrupted
      }
    }

    return points.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Recover from the latest recovery point.
   */
  recoverLatest(): boolean {
    const points = this.listRecoveryPoints();
    if (points.length === 0) return false;

    const latest = points[0];
    if (!existsSync(latest.backupPath)) return false;

    copyFileSync(latest.backupPath, latest.databasePath);
    return true;
  }

  /**
   * Get backup statistics.
   */
  getStats(): {
    totalBackups: number;
    totalSizeBytes: number;
    oldestBackup: string | null;
    newestBackup: string | null;
    recoveryPoints: number;
  } {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, b) => sum + b.sizeBytes, 0);
    const recoveryPoints = this.listRecoveryPoints();

    return {
      totalBackups: backups.length,
      totalSizeBytes: totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].createdAt : null,
      newestBackup: backups.length > 0 ? backups[0].createdAt : null,
      recoveryPoints: recoveryPoints.length,
    };
  }

  private pruneOldBackups(): void {
    const backups = this.listBackups();
    if (backups.length <= MAX_BACKUPS) return;

    const toDelete = backups.slice(MAX_BACKUPS);
    for (const backup of toDelete) {
      this.deleteBackup(backup.uuid);
    }
  }

  private pruneRecoveryPoints(): void {
    const points = this.listRecoveryPoints();
    if (points.length <= MAX_RECOVERY_POINTS) return;

    const toDelete = points.slice(MAX_RECOVERY_POINTS);
    for (const point of toDelete) {
      const jsonPath = join(RECOVERY_DIR, `${point.uuid}.json`);
      if (existsSync(jsonPath)) unlinkSync(jsonPath);
      if (existsSync(point.backupPath)) unlinkSync(point.backupPath);
    }
  }
}
