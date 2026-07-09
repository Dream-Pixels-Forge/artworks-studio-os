/**
 * Build both better-sqlite3 native binaries so the Electron app and the
 * vitest (Node) suite can coexist without overwriting each other.
 *
 * Background: better-sqlite3 compiles to a single `.node` file whose ABI
 * must match the runtime that loads it. Electron 39 uses ABI 140; the
 * system Node used by vitest uses ABI 137. Because both runtimes resolved
 * the *same* file (`build/Release/better_sqlite3.node`), developers used
 * to flip between `pnpm rebuild:node` and `pnpm rebuild:electron`, which
 * overwrite one another.
 *
 * This script builds BOTH binaries into separate directories:
 *
 *   build/Release/better_sqlite3.node       ← Electron ABI (app default)
 *   build/Release-node/better_sqlite3.node  ← Node ABI (tests)
 *
 * `db.ts` then selects the right one at runtime (see
 * `src/main/database/native-binding.ts`), so `pnpm dev` and `pnpm test`
 * both "just work" with no manual switching.
 *
 * The script reuses the two *already-proven* build entry points rather
 * than reinvoking node-gyp itself: `pnpm rebuild better-sqlite3` (Node
 * prebuilt, the `rebuild:node` script) and the `@electron/rebuild`
 * programmatic API (the engine behind `rebuild:electron`). Order matters:
 * Node first (then copy aside), Electron last (so the canonical
 * `build/Release/` ends up holding the Electron ABI).
 *
 * Usage:  pnpm rebuild:native   (or: node scripts/build-native.mjs)
 */
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

/** Resolve the real (de-symlinked) better-sqlite3 package directory. */
const bsqlPkgDir = dirname(require.resolve("better-sqlite3/package.json"));
const releaseDir = join(bsqlPkgDir, "build", "Release");
const releaseNodeDir = join(bsqlPkgDir, "build", "Release-node");
const nodeBinary = join(releaseNodeDir, "better_sqlite3.node");
const releaseBinary = join(releaseDir, "better_sqlite3.node");

/** Read the Electron version this app ships, from its installed package. */
const electronVersion = require("electron/package.json").version;

/** Small formatted logger. */
const log = (msg) => console.log(`[build-native] ${msg}`);

/**
 * Run a command, inheriting stdio, throwing on non-zero exit. Uses `shell:
 * true` so the OS resolves package-manager shims (e.g. `pnpm` → `pnpm.cmd`)
 * on Windows. Safe because every argument here is a hardcoded literal — no
 * untrusted input is ever passed.
 */
function run(cmd, args, opts) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  if (result.status !== 0) {
    throw new Error(`\`${cmd} ${args.join(" ")}\` failed (exit ${result.status}).`);
  }
}

/**
 * Build better-sqlite3 for the *current* runtime ABI (Node, since this
 * script runs under Node) using the proven `pnpm rebuild better-sqlite3`
 * path — the same command as the `rebuild:node` script. Produces the Node
 * binary at the canonical `build/Release/better_sqlite3.node`.
 */
function buildForNode() {
  log(`compiling better-sqlite3 for Node (ABI ${process.versions.modules})...`);
  run("pnpm", ["rebuild", "better-sqlite3"], { cwd: repoRoot });
}

/** Copy the just-built Node binary to the side directory used by tests. */
function stageNodeBinary() {
  if (!existsSync(releaseBinary)) {
    throw new Error(`Expected Node binary at ${releaseBinary} but it is missing after build.`);
  }
  mkdirSync(releaseNodeDir, { recursive: true });
  copyFileSync(releaseBinary, nodeBinary);
  log(`staged Node binary → ${relativeToRepo(nodeBinary)}`);
}

/**
 * Rebuild better-sqlite3 against Electron's headers, in place, using the
 * programmatic @electron/rebuild API (the engine behind rebuild:electron).
 * Leaves the Electron ABI binary at the canonical
 * `build/Release/better_sqlite3.node` (the app's default load path).
 */
async function buildForElectron() {
  log(`compiling better-sqlite3 for Electron ${electronVersion}...`);
  const { rebuild } = await import("@electron/rebuild");
  await rebuild({
    // buildPath is the project root (where the app package.json lives), NOT
    // node_modules — @electron/rebuild walks `<buildPath>/node_modules` to
    // find modules. This mirrors what the `electron-rebuild` CLI does with
    // process.cwd(). See rebuild.js: this.buildPath is the app root.
    buildPath: repoRoot,
    electronVersion,
    onlyModules: ["better-sqlite3"],
    // Force: the directory just held a Node build, so without --force rebuild
    // would see a present binary and skip. We need it recompiled for ABI 140.
    force: true,
  });
  log(`Electron binary in place → ${relativeToRepo(releaseBinary)}`);
}

/** Return `p` relative to the repo root, for readable logs. */
function relativeToRepo(p) {
  return resolve(p).replace(resolve(repoRoot) + "/", "");
}

async function main() {
  log(`better-sqlite3 package: ${relativeToRepo(bsqlPkgDir)}`);
  log(`electron version: ${electronVersion}`);

  // 1) Node binary (for vitest). Build + copy to the side directory.
  buildForNode();
  stageNodeBinary();

  // 2) Electron binary (for the app). Rebuilds in place — MUST run last so
  //    the canonical build/Release/ ends up holding the Electron ABI.
  await buildForElectron();

  log("done. Both binaries ready:");
  log(`  app   (Electron): ${relativeToRepo(releaseBinary)}`);
  log(`  tests (Node)    : ${relativeToRepo(nodeBinary)}`);
}

main().catch((err) => {
  console.error(`[build-native] failed: ${err?.stack || err?.message || err}`);
  process.exit(1);
});
