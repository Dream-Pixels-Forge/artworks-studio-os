/**
 * Bundled schema migrations.
 *
 * Uses Vite's `?raw` imports to inline SQL files at build time.
 * To add a new migration: drop a `vN.sql` file in schema/ and add it here.
 */
import type { MigrationSource } from "./migrator.js";
import v1 from "./schema/v1.sql?raw";
import v2 from "./schema/v2.sql?raw";
import v3 from "./schema/v3.sql?raw";
import v4 from "./schema/v4.sql?raw";
import v5 from "./schema/v5.sql?raw";
import v6 from "./schema/v6.sql?raw";
import v7 from "./schema/v7.sql?raw";
import v8 from "./schema/v8.sql?raw";
import v9 from "./schema/v9.sql?raw";
import v10 from "./schema/v10.sql?raw";
import v11 from "./schema/v11.sql?raw";

/** All bundled migrations, keyed by version number. */
export const MIGRATIONS: MigrationSource = new Map<number, string>([
  [1, v1], [2, v2], [3, v3], [4, v4], [5, v5],
  [6, v6], [7, v7], [8, v8], [9, v9], [10, v10], [11, v11],
]);
