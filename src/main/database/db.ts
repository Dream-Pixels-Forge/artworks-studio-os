/**
 * Live SQLite database connection.
 *
 * Adapts the native better-sqlite3 driver to the transport-agnostic
 * `MigrationDatabase` interface (so the existing migrator runs unchanged)
 * AND exposes the extra primitives repositories need: prepared statements,
 * transactions, and close. Every multi-table write MUST go through
 * `transaction()` so the normalized schema stays consistent.
 */
import type Database from "better-sqlite3";
import { createLogger } from "@main/core/logger.js";
import { runMigrations, type MigrationDatabase, type MigrationSource } from "./migrator.js";

const log = createLogger("database");

export class StudioDatabase implements MigrationDatabase {
  private constructor(private readonly db: Database.Database) {}

  /** Open a file-backed database at `path`, run migrations, return it. */
  static async open(path: string, migrations: MigrationSource): Promise<StudioDatabase> {
    const { default: BetterSqlite } = (await import("better-sqlite3")) as {
      default: typeof Database;
    };
    const db = new BetterSqlite(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    const studio = new StudioDatabase(db);
    runMigrations(studio, migrations);
    log.info("database opened", { path, version: getCurrentVersion(studio) });
    return studio;
  }

  /** Open an in-memory database (tests only). */
  static async openInMemory(migrations: MigrationSource): Promise<StudioDatabase> {
    const { default: BetterSqlite } = (await import("better-sqlite3")) as {
      default: typeof Database;
    };
    const db = new BetterSqlite(":memory:");
    db.pragma("foreign_keys = ON");
    const studio = new StudioDatabase(db);
    runMigrations(studio, migrations);
    return studio;
  }

  exec(sql: string, params: unknown[] = []): void {
    this.db.prepare(sql).run(...params);
  }

  get<T>(sql: string, params: unknown[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  execMany(sql: string): void {
    this.db.exec(sql);
  }

  /** Wrap a multi-statement write in a transaction. Atomic. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /** Rebuild the FTS5 search index from the entities table. Maintenance only. */
  rebuildSearchIndex(): void {
    this.exec("INSERT INTO entities_fts(entities_fts) VALUES ('rebuild')");
  }

  close(): void {
    this.db.close();
  }
}

function getCurrentVersion(db: MigrationDatabase): number {
  const row = db.get<{ version: number }>("SELECT MAX(version) AS version FROM _schema_version");
  return row?.version ?? 0;
}
