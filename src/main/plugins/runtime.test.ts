/**
 * Plugin runtime tests.
 *
 * Validates manifest validation, permission gating, and that the bundled
 * example-hello plugin loads, activates, and tears down cleanly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateManifest, parseManifest, SDK_VERSION } from "./validator.js";
import { buildHostServices } from "./host-services.js";
import { buildPluginContext, PERMISSION_SERVICE_MAP } from "./context.js";
import { discoverPlugins } from "./discovery.js";
import { PluginRuntime } from "./runtime.js";
import type { Permission, PluginCategory } from "@shared/sdk/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const BUILTIN_DIR = join(here, "../../../plugins");

describe("manifest validation", () => {
  const exampleManifest = JSON.parse(
    readFileSync(join(BUILTIN_DIR, "example-hello/manifest.json"), "utf-8"),
  );

  it("accepts the example-hello manifest", () => {
    const result = validateManifest(exampleManifest);
    expect(result.ok).toBe(true);
  });

  it("rejects a manifest with an unknown permission", () => {
    const bad = { ...exampleManifest, permissions: ["bogus"] };
    const result = validateManifest(bad);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.join(" ")).toMatch(/Unknown permission/);
  });

  it("rejects a manifest with an unknown category", () => {
    const bad = { ...exampleManifest, category: "made-up" };
    const result = validateManifest(bad);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.join(" ")).toMatch(/Unknown category/);
  });

  it("rejects a manifest with a mismatched sdkVersion", () => {
    const bad = { ...exampleManifest, sdkVersion: "9.9.9" };
    const result = validateManifest(bad);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.join(" ")).toMatch(/sdkVersion/);
  });

  it("parseManifest reports invalid JSON", () => {
    const result = parseManifest("{ not json");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.join(" ")).toMatch(/not valid JSON/);
  });

  it("the SDK version is 0.1.0", () => {
    expect(SDK_VERSION).toBe("0.1.0");
  });
});

describe("permission gating", () => {
  it("maps event to core (always available)", () => {
    expect(PERMISSION_SERVICE_MAP.event).toBe("core");
  });

  it("throws when a plugin calls a service it lacks permission for", () => {
    const manifest = {
      id: "test.gated",
      name: "Gated",
      version: "0.1.0",
      author: "test",
      category: "utility" as PluginCategory,
      description: "test",
      sdkVersion: SDK_VERSION,
      permissions: ["notification"] as Permission[],
    };
    const trackers = new Set<() => void>();
    const services = buildHostServices(trackers);
    const ctx = buildPluginContext(manifest, services);

    // project requires 'database' which this plugin lacks.
    expect(() => ctx.project.active()).toThrow(/requires permission 'database'/);
  });

  it("allows a service the plugin has permission for", () => {
    const manifest = {
      id: "test.event",
      name: "Event",
      version: "0.1.0",
      author: "test",
      category: "utility" as PluginCategory,
      description: "test",
      sdkVersion: SDK_VERSION,
      permissions: [] as Permission[],
    };
    const trackers = new Set<() => void>();
    const services = buildHostServices(trackers);
    const ctx = buildPluginContext(manifest, services);

    // event is always available (core).
    expect(typeof ctx.event.subscribe).toBe("function");
    expect(() => ctx.event.publish("project:opened", { projectId: "x", name: "x" })).not.toThrow();
  });
});

describe("discovery + loading", () => {
  it("discovers the example-hello plugin from the builtin dir", () => {
    const found = discoverPlugins({ builtinDir: BUILTIN_DIR, userDir: join(BUILTIN_DIR, "nope") });
    expect(found.some((p) => p.id === "artworks.example-hello")).toBe(true);
  });

  it("returns no plugins when the dir is missing", () => {
    const found = discoverPlugins({
      builtinDir: join(BUILTIN_DIR, "does-not-exist"),
      userDir: join(BUILTIN_DIR, "also-missing"),
    });
    expect(found).toEqual([]);
  });
});

describe("PluginRuntime", () => {
  it("loads and activates the example-hello plugin, then tears it down", async () => {
    const runtime = new PluginRuntime({ builtinDir: BUILTIN_DIR, userDir: join(BUILTIN_DIR, "no-user") });
    await runtime.start();
    expect(runtime.list().length).toBe(1);
    expect(runtime.list()[0]?.manifest.id).toBe("artworks.example-hello");

    // Deactivation should not throw and clears the list.
    await runtime.stop();
    expect(runtime.list()).toHaveLength(0);
  });
});
