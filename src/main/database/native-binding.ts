/**
 * Resolves which better-sqlite3 native binary to load.
 *
 * better-sqlite3 compiles to a single `.node` file whose ABI must match the
 * runtime that loads it. This app has two runtimes that load it:
 *
 *   - the Electron main process (ABI 140 under Electron 39), used by the app
 *   - vitest on system Node (ABI 137), used by the test suite
 *
 * `scripts/build-native.mjs` builds BOTH binaries into separate directories:
 *
 *   build/Release/better_sqlite3.node       ← Electron ABI (app default)
 *   build/Release-node/better_sqlite3.node  ← Node ABI (tests)
 *
 * This module picks the right one. Electron uses better-sqlite3's default
 * resolution (no option) and finds the Electron binary at `build/Release/`.
 * vitest is detected via `process.env.VITEST` and pointed at the Node binary
 * via the `nativeBinding` constructor option (see better-sqlite3's
 * `lib/database.js` — `{ nativeBinding: "<path>" }`).
 *
 * If the side-path Node binary is missing (e.g. a fresh checkout that ran
 * `pnpm install` but not `pnpm rebuild:native`), we return `undefined` and
 * let better-sqlite3 fall back to its default resolution. That default is the
 * Node-ABI binary produced by the install lifecycle — so vitest still works
 * out of the box; `rebuild:native` is only needed to run the Electron app.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Real (de-symlinked) better-sqlite3 package directory. */
const bsqlPkgDir = dirname(require.resolve("better-sqlite3/package.json"));
const NODE_BINARY = join(bsqlPkgDir, "build", "Release-node", "better_sqlite3.node");

/**
 * The options object to pass to `new Database(path, options)`.
 *
 * - Under vitest: `{ nativeBinding: "<Node binary path>" }` if that side-path
 *   binary exists, else `undefined` (fall back to default Node resolution).
 * - Under Electron (or anything else): `undefined`, so better-sqlite3 loads
 *   the Electron binary at its default `build/Release/` location.
 *
 * Returning `undefined` rather than `{}` keeps the call sites terse and lets
 * better-sqlite3 apply its own defaults untouched.
 */
export function nativeBindingOptions(): { nativeBinding: string } | undefined {
  if (process.env.VITEST && existsSync(NODE_BINARY)) {
    return { nativeBinding: NODE_BINARY };
  }
  return undefined;
}
