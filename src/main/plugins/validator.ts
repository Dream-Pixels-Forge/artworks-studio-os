/**
 * Plugin manifest validation.
 *
 * The runtime trusts a manifest only after it passes these checks. Rules
 * mirror the assertions in src/shared/sdk/sdk.test.ts (the de-facto spec)
 * and docs/plugin-sdk.md.
 */
import {
  ALL_PERMISSIONS,
  PLUGIN_CATEGORIES,
  type PluginCategory,
  type PluginManifest,
} from "@shared/sdk/index.js";

export type ManifestValidation =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: string[] };

/** SDK version this runtime implements. Plugins must target it exactly (Phase 1). */
export const SDK_VERSION = "0.1.0";

const REQUIRED_STRING_FIELDS = [
  "id",
  "name",
  "version",
  "author",
  "description",
  "sdkVersion",
] as const;

/** Validate a parsed-but-untyped object against the manifest contract. */
export function validateManifest(raw: unknown): ManifestValidation {
  const errors: string[] = [];

  if (!isObject(raw)) {
    return { ok: false, errors: ["Manifest must be a JSON object."] };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!isNonEmptyString(raw[field])) {
      errors.push(`Missing or empty required field '${field}'.`);
    }
  }

  if (!isNonEmptyString(raw["category"])) {
    errors.push("Missing or empty required field 'category'.");
  } else if (!PLUGIN_CATEGORIES.includes(raw["category"] as PluginCategory)) {
    errors.push(
      `Unknown category '${raw["category"]}'. Allowed: ${PLUGIN_CATEGORIES.join(", ")}.`,
    );
  }

  if (!Array.isArray(raw["permissions"])) {
    errors.push("'permissions' must be an array.");
  } else {
    for (const p of raw["permissions"]) {
      if (!(ALL_PERMISSIONS as readonly string[]).includes(p as string)) {
        errors.push(`Unknown permission '${p}'. Allowed: ${ALL_PERMISSIONS.join(", ")}.`);
      }
    }
  }

  if (isNonEmptyString(raw["sdkVersion"]) && raw["sdkVersion"] !== SDK_VERSION) {
    errors.push(
      `sdkVersion '${raw["sdkVersion"]}' does not match runtime SDK version '${SDK_VERSION}'.`,
    );
  }

  if (Array.isArray(raw["commands"])) {
    for (const [i, cmd] of raw["commands"].entries()) {
      if (!isObject(cmd) || !isNonEmptyString(cmd["id"]) || !isNonEmptyString(cmd["title"])) {
        errors.push(`commands[${i}] must have non-empty 'id' and 'title'.`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, manifest: raw as unknown as PluginManifest };
}

/** Parse and validate a manifest.json file's contents. */
export function parseManifest(jsonText: string): ManifestValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { ok: false, errors: [`Manifest is not valid JSON: ${(err as Error).message}`] };
  }
  return validateManifest(parsed);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** All known permission values, as a plain string set (for validation speed). */
export const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set<string>(ALL_PERMISSIONS);
