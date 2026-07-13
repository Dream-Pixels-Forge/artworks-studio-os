/**
 * Design-token auditor.
 *
 * Enforces the rule from docs/design-system.md:
 *
 *   "No hardcoded colors, sizes, or spacing values in components."
 *
 * Every value a component uses should trace back to a token defined in
 * src/renderer/ui/tokens/. This script scans the renderer for values that
 * bypass the token layer and fails if it finds any NOT already recorded in
 * the baseline (scripts/check-tokens.baseline.json).
 *
 * ## Why baseline-driven (not absolute)
 *
 * The design-system doc states the rule absolutely, but the renderer today
 * carries pre-existing debt — particularly in later-phase panels
 * (agent-teams, backup-recovery, phase3-panels.css, …) that were written
 * before the token layer existed or was fully adopted. Failing hard on all
 * of it would block all other work. Instead:
 *
 *   - The baseline snapshots every violation that exists RIGHT NOW.
 *   - The check passes as long as nothing NEW appears.
 *   - Each entry is a retireable debt item: fix the source, re-run
 *     `--update`, the entry drops from the baseline permanently.
 *
 * The baseline count should monotonically decrease over time. When it hits
 * zero, this script can be simplified to an absolute check.
 *
 * ## What it checks
 *
 * 1. COLORS — hex (#rgb / #rrggbb / #rrggbbaa), rgb(), rgba(), hsl(),
 *    hsla() literals anywhere under src/renderer/ EXCEPT inside ui/tokens/.
 *    If you need a color, add a token in tokens/ and use var(--…).
 *
 * 2. SPACING — raw px values on padding / margin / gap declarations in CSS
 *    or inline style objects, EXCLUDING fully-tokenized var() values and
 *    1px borders (hairlines, off the 4px scale by convention). Use a
 *    spacing token (var(--space-2) etc.) instead.
 *
 * Inline style={{...}} in .tsx is checked the same way.
 *
 * Usage:  pnpm lint:tokens
 *         node scripts/check-tokens.mjs            # check
 *         node scripts/check-tokens.mjs --update   # rewrite baseline (review diff!)
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RENDERER = join(ROOT, "src", "renderer");
const TOKENS_DIR_PREFIX = "src/renderer/ui/tokens"; // relative, posix-style
const BASELINE_FILE = join(ROOT, "scripts", "check-tokens.baseline.json");

// --- patterns --------------------------------------------------------------

// hex (#abc, #aabbcc, #aabbccff), rgb/rgba/hsl/hsla(...) literals.
const COLOR_REGEX =
  /#(?:[0-9A-Fa-f]{3,4}){1,2}\b|(?:rgb|rgba|hsl|hsla)\s*\([^)]*\)/g;

// spacing-bearing CSS declarations. Captures the property name + value.
const SPACING_PROPS = ["padding", "margin", "gap", "grid-gap"];
const SPACING_DECL_REGEX =
  new RegExp(`(?:^|[\\s;{])(${SPACING_PROPS.join("|")})\\s*:\\s*([^;}]+)`, "g");

// a raw "Npx" value, excluding those inside a var(...) wrapper.
const RAW_PX_REGEX = /(?<!var\([^)]*)\b\d+px\b/g;

const SCAN_EXTENSIONS = new Set([".tsx", ".ts", ".css"]);

// --- baseline --------------------------------------------------------------

/** Load the grandfathered-violation set, keyed by "file:line" (posix paths). */
function loadBaseline() {
  if (!existsSync(BASELINE_FILE)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(BASELINE_FILE, "utf8")));
  } catch {
    return new Set();
  }
}

// --- file walking ----------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (SCAN_EXTENSIONS.has(extOf(full))) out.push(full);
  }
  return out;
}

function extOf(p) {
  const i = p.lastIndexOf(".");
  return i === -1 ? "" : p.slice(i);
}

function isTokensFile(absPath) {
  return posix(relative(ROOT, absPath)).startsWith(TOKENS_DIR_PREFIX);
}

function posix(p) {
  return p.replace(/\\/g, "/");
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

// --- violation finding -----------------------------------------------------

function findColorViolations(absPath, src) {
  const rel = posix(relative(ROOT, absPath));
  const hits = [];
  let m;
  COLOR_REGEX.lastIndex = 0;
  while ((m = COLOR_REGEX.exec(src)) !== null) {
    hits.push({
      key: `${rel}:${lineOf(src, m.index)}`,
      file: rel,
      line: lineOf(src, m.index),
      value: m[0],
      kind: "color",
    });
  }
  return hits;
}

function findSpacingViolations(absPath, src) {
  const rel = posix(relative(ROOT, absPath));
  const hits = [];
  let m;
  SPACING_DECL_REGEX.lastIndex = 0;
  while ((m = SPACING_DECL_REGEX.exec(src)) !== null) {
    const decl = m[2];
    if (/^\s*var\(/.test(decl)) continue; // fully tokenized — fine
    const px = [...decl.matchAll(RAW_PX_REGEX)].map((x) => x[0]);
    if (px.length === 0) continue;
    const line = lineOf(src, m.index);
    hits.push({
      key: `${rel}:${line}`,
      file: rel,
      line,
      value: decl.trim(),
      px,
      kind: "spacing",
    });
  }
  return hits;
}

// --- main ------------------------------------------------------------------

function main() {
  const update = process.argv.includes("--update");
  const files = walk(RENDERER).filter((f) => !isTokensFile(f));

  const found = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    found.push(...findColorViolations(f, src));
    found.push(...findSpacingViolations(f, src));
  }

  if (update) {
    const keys = [...new Set(found.map((v) => v.key))].sort();
    writeFileSync(BASELINE_FILE, JSON.stringify(keys, null, 2) + "\n");
    console.log(
      `baseline written: ${keys.length} entries → ${posix(relative(ROOT, BASELINE_FILE))}\n` +
        `review the diff before committing; this is the current debt to retire.`,
    );
    return;
  }

  const baseline = loadBaseline();
  const fresh = found.filter((v) => !baseline.has(v.key));

  if (fresh.length === 0) {
    console.log(
      `✓ tokens clean — no new violations.\n` +
        `  baseline: ${baseline.size} grandfathered item(s) to retire ` +
        `(run with --update after fixing any).`,
    );
    return;
  }

  const colors = fresh.filter((v) => v.kind === "color");
  const spacing = fresh.filter((v) => v.kind === "spacing");
  console.error(
    `✗ ${fresh.length} NEW token violation(s): ${colors.length} color, ${spacing.length} spacing.\n`,
  );
  if (colors.length) report("COLOR", colors);
  if (spacing.length) report("SPACING", spacing);
  console.error(
    `Fix by using a token (var(--color-…) / var(--space-…)) defined in\n` +
      `src/renderer/ui/tokens/. If this is pre-existing debt that you are\n` +
      `not fixing now, snapshot it into the baseline and review the diff:\n` +
      `  node scripts/check-tokens.mjs --update\n`,
  );
  process.exit(1);
}

function report(label, violations) {
  console.error(`── ${label} (${violations.length}) ──`);
  for (const v of violations) {
    const detail = v.kind === "spacing" ? `  [${v.px.join(", ")}]` : "";
    console.error(`  ${v.file}:${v.line}  ${v.value}${detail}`);
  }
  console.error();
}

main();
