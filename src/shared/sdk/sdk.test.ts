/**
 * SDK contract tests.
 *
 * Verifies the plugin contract is implementable: the example plugin
 * type-checks against the SDK interfaces, and manifest validation enforces
 * the declared shape. This is a compile-time guarantee masquerading as a
 * runtime test — if it imports, the contract holds.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { activate } from "../../../plugins/example-hello/index.js";
import {
  ALL_PERMISSIONS,
  PLUGIN_CATEGORIES,
  Permission,
  type PluginContext,
  type PluginManifest,
} from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, "../../../plugins/example-hello/manifest.json");

// A no-op context satisfying the PluginContext interface. Used to prove the
// example plugin's activate() can be called with a well-typed context.
const noop = (): never => undefined as never;
const stubContext: PluginContext = {
  manifest: {} as PluginManifest,
  project: { create: noop, open: noop, active: noop },
  asset: { list: noop, read: noop, link: noop },
  graph: { relationships: noop, connect: noop },
  prompt: { build: noop, history: noop },
  ai: { providers: noop, complete: noop },
  file: { read: noop, write: noop, watch: noop },
  media: { generate: noop, transcode: noop },
  event: { subscribe: noop, publish: noop },
  notification: { show: noop },
};

describe("example-hello plugin", () => {
  it("activate() returns a PluginLifecycle against a typed context", () => {
    const lifecycle = activate(stubContext);
    expect(typeof lifecycle.onActivate).toBe("function");
  });

  it("onActivate does not throw", () => {
    const lifecycle = activate(stubContext);
    expect(() => lifecycle.onActivate?.()).not.toThrow();
  });
});

describe("manifest validation", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as PluginManifest;

  it("has all required manifest fields", () => {
    for (const field of [
      "id",
      "name",
      "version",
      "author",
      "category",
      "description",
      "sdkVersion",
      "permissions",
    ]) {
      expect(manifest[field as keyof PluginManifest]).toBeDefined();
    }
  });

  it("declares only known permissions", () => {
    for (const p of manifest.permissions) {
      expect(ALL_PERMISSIONS).toContain(p);
    }
  });

  it("declares a known category", () => {
    expect(PLUGIN_CATEGORIES).toContain(manifest.category);
  });

  it("declares at least the notification permission it uses", () => {
    expect(manifest.permissions).toContain(Permission.Notification);
  });
});
