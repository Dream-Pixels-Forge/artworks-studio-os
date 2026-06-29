/**
 * Database schema + migration tests.
 *
 * Validates the v1 schema against an in-memory SQLite: it must parse, be
 * referentially consistent (foreign_key_check clean), and the migrator
 * must apply it idempotently.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type Database from "better-sqlite3";
import {
  runMigrations,
  getCurrentVersion,
  type MigrationDatabase,
} from "./migrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_V1 = readFileSync(join(__dirname, "schema/v1.sql"), "utf-8");

let createDb: () => MigrationDatabase;

// Lazy-load the native driver once. Dynamic import keeps this ESM-clean and
// fails loudly at runtime if the binding is unavailable.
beforeAll(async () => {
  const { default: BetterSqlite } = (await import("better-sqlite3")) as {
    default: typeof Database;
  };
  createDb = (): MigrationDatabase => {
    const db = new BetterSqlite(":memory:");
    return {
      exec(sql, params = []) {
        db.prepare(sql).run(...params);
      },
      get(sql, params = []) {
        return db.prepare(sql).get(...params) as never;
      },
      all(sql, params = []) {
        return db.prepare(sql).all(...params) as never;
      },
      execMany(sql) {
        db.exec(sql);
      },
    };
  };
});

describe("v1 schema", () => {
  it("parses without error on a fresh database", () => {
    const db = createDb();
    expect(() => db.execMany(SCHEMA_V1)).not.toThrow();
  });

  it("creates all required tables", () => {
    const db = createDb();
    db.execMany(SCHEMA_V1);
    const rows = db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ) ?? [];
    const names = rows.map((r) => r.name);
    for (const table of [
      "_schema_version",
      "entities",
      "relationships",
      "version_history",
      "projects",
      "assets",
      "documents",
      "prompts",
      "images",
      "videos",
      "conversations",
      "workflows",
      "plugins",
      "settings",
    ]) {
      expect(names).toContain(table);
    }
  });

  it("is referentially consistent (foreign_key_check is clean)", () => {
    const db = createDb();
    db.execMany(SCHEMA_V1);
    const problems = db.all<unknown>("PRAGMA foreign_key_check");
    expect(problems).toHaveLength(0);
  });

  it("enforces the entity status check constraint", () => {
    const db = createDb();
    db.execMany(SCHEMA_V1);
    // Valid insert
    db.exec(
      "INSERT INTO entities (uuid, id, name, type, status) VALUES (?, ?, ?, ?, ?)",
      ["u1", "CHR-001", "Hero", "character", "draft"],
    );
    // Invalid status must throw
    expect(() =>
      db.exec(
        "INSERT INTO entities (uuid, id, name, type, status) VALUES (?, ?, ?, ?, ?)",
        ["u2", "CHR-002", "Villain", "character", "bogus"],
      ),
    ).toThrow();
  });

  it("creates the full-text search table and triggers", () => {
    const db = createDb();
    db.execMany(SCHEMA_V1);
    const tables =
      db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='entities_fts'",
      ) ?? [];
    expect(tables).toHaveLength(1);
    const triggers =
      db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'entities_%'",
      ) ?? [];
    expect(triggers.map((t) => t.name).sort()).toEqual([
      "entities_ad",
      "entities_ai",
      "entities_au",
    ]);
  });
});

describe("migrator", () => {
  function v1Migrations() {
    return new Map<number, string>([[1, SCHEMA_V1]]);
  }

  it("applies pending migrations and records the version", () => {
    const db = createDb();
    const result = runMigrations(db, v1Migrations());
    expect(result.applied).toEqual([1]);
    expect(result.currentVersion).toBe(1);
    expect(getCurrentVersion(db)).toBe(1);
  });

  it("is idempotent — running again applies nothing", () => {
    const db = createDb();
    runMigrations(db, v1Migrations());
    const result = runMigrations(db, v1Migrations());
    expect(result.applied).toEqual([]);
    expect(result.currentVersion).toBe(1);
  });

  it("respects version ordering", () => {
    const db = createDb();
    const migrations = new Map<number, string>([
      [1, SCHEMA_V1],
      [
        2,
        "CREATE TABLE IF NOT EXISTS _migration_test (id INTEGER PRIMARY KEY);",
      ],
    ]);
    const result = runMigrations(db, migrations);
    expect(result.applied).toEqual([1, 2]);
    expect(result.currentVersion).toBe(2);
  });
});
