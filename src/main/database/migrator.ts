/**
 * Migration runner.
 *
 * Applies versioned SQL files from src/main/database/schema/ in order,
 * recording progress in the `_schema_version` table. Idempotent: running
 * twice applies nothing the second time.
 *
 * The runner is transport-agnostic — it takes a `Database` interface so it
 * can run against any SQL driver (better-sqlite3 in dev/tests, the
 * production driver in Phase 1). It is NOT yet wired to a live connection.
 */
import { createLogger } from "@main/core/logger.js";

const log = createLogger("migrator");

/** A minimal database interface — enough to run migrations, decoupled from any driver. */
export interface MigrationDatabase {
  /** Execute SQL that returns no rows, with bound parameters. */
  exec(sql: string, params?: unknown[]): void;
  /** Run SQL returning a single row as a record. */
  get<T>(sql: string, params?: unknown[]): T | undefined;
  /** Run SQL returning zero or more rows. */
  all<T>(sql: string, params?: unknown[]): T[];
  /** Run multiple statements separated by semicolons (DDL / scripts). */
  execMany(sql: string): void;
}

export interface MigrationResult {
  /** Versions that were applied during this run, in order. */
  applied: number[];
  /** Version the database is now at. */
  currentVersion: number;
}

/** Built-in migrations bundled with the app. Version -> SQL. */
export type MigrationSource = ReadonlyMap<number, string>;

/**
 * Ensure the version-tracking table exists. Safe to call repeatedly.
 */
export function ensureVersionTable(db: MigrationDatabase): void {
  db.execMany(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Read the highest applied migration version, or 0 if none applied yet.
 */
export function getCurrentVersion(db: MigrationDatabase): number {
  const row = db.get<{ version: number } | undefined>(
    "SELECT MAX(version) AS version FROM _schema_version",
  );
  return row?.version ?? 0;
}

/**
 * Apply all pending migrations from `migrations` that are newer than the
 * database's current version. Each migration runs in its own transaction
 * boundary (the driver wraps execMany).
 */
export function runMigrations(
  db: MigrationDatabase,
  migrations: MigrationSource,
): MigrationResult {
  ensureVersionTable(db);

  const current = getCurrentVersion(db);
  const pending = [...migrations.entries()]
    .filter(([version]) => version > current)
    .sort(([a], [b]) => a - b);

  if (pending.length === 0) {
    log.info("database up to date", { version: current });
    return { applied: [], currentVersion: current };
  }

  const applied: number[] = [];
  for (const [version, sql] of pending) {
    log.info("applying migration", { version });
    db.execMany(sql);
    db.exec("INSERT INTO _schema_version (version) VALUES (?)", [version]);
    applied.push(version);
  }

  const finalVersion = applied[applied.length - 1] ?? current;
  log.info("migrations complete", { version: finalVersion });
  return { applied, currentVersion: finalVersion };
}
