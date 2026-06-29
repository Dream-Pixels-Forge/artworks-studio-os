/**
 * Bundled schema migrations.
 *
 * Loads the versioned SQL files from schema/ into a `MigrationSource` map
 * at runtime. The migrator applies them in numeric order. To add a new
 * migration: drop a `vN.sql` file in schema/ and add it here.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { MigrationSource } from "./migrator.js";

const here = dirname(fileURLToPath(import.meta.url));

function load(version: number): [number, string] {
  return [version, readFileSync(join(here, "schema", `v${version}.sql`), "utf-8")];
}

/** All bundled migrations, keyed by version number. */
export const MIGRATIONS: MigrationSource = new Map<number, string>([load(1)]);
