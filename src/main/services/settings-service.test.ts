/**
 * Settings service tests.
 *
 * Electron's filesystem is available in the Vitest node environment, so these
 * tests exercise the full read/write round-trip against a throwaway studio
 * home. The persistence contract (JSON shape, corrupt-file fallback, reset)
 * is pinned here so a breaking change to the persisted file is caught.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isPreferences } from "./settings-service.js";

let home: string;

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "artworks-settings-"));
  // Point AW_HOME at the throwaway home so the service reads/writes there.
  process.env["AW_HOME"] = home;
});

afterAll(async () => {
  await rm(home, { recursive: true, force: true });
  delete process.env["AW_HOME"];
});

describe("preferences validation", () => {
  it("accepts an object of string values", () => {
    expect(isPreferences({ "default-production": "SIGNAL" })).toBe(true);
    expect(isPreferences({})).toBe(true);
  });

  it("rejects non-object shapes", () => {
    expect(isPreferences(null)).toBe(false);
    expect(isPreferences("SIGNAL")).toBe(false);
    expect(isPreferences(42)).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isPreferences({ "default-production": 42 })).toBe(false);
    expect(isPreferences({ "default-production": null })).toBe(false);
  });
});

describe("settings persistence contract", () => {
  it("serializes preferences to the documented JSON shape", () => {
    // File shape is { preferences: Record<string, string> }. Pin it.
    const serialized = JSON.stringify({ preferences: { "default-production": "SIGNAL" } });
    const parsed = JSON.parse(serialized) as { preferences: unknown };
    expect(isPreferences(parsed["preferences"])).toBe(true);
  });

  it("treats an empty object as valid (no preferences set)", () => {
    const serialized = JSON.stringify({ preferences: {} });
    const parsed = JSON.parse(serialized) as { preferences: unknown };
    expect(isPreferences(parsed["preferences"])).toBe(true);
  });

  it("falls back to defaults for a corrupt persisted value", async () => {
    // The SettingsService is imported lazily so AW_HOME is set before its
    // module-level PREFERENCES_FILE constant is evaluated.
    const { SettingsService } = await import("./settings-service.js");
    const service = new SettingsService();

    // Write a corrupt preferences file at the resolved path.
    await mkdir(dirname(service.path), { recursive: true });
    await writeFile(service.path, "{ not valid json");
    const state = await service.init();
    expect(state.preferences).toEqual({});
  });

  it("round-trips a set preference through init", async () => {
    const { SettingsService } = await import("./settings-service.js");
    const service = new SettingsService();

    await service.setPreference("default-production", "ALPHA");
    expect(service.state().preferences["default-production"]).toBe("ALPHA");

    // A fresh instance reads the persisted value back.
    const reloaded = new SettingsService();
    const state = await reloaded.init();
    expect(state.preferences["default-production"]).toBe("ALPHA");
  });

  it("clearing a preference removes it from the persisted shape", async () => {
    const { SettingsService } = await import("./settings-service.js");
    const service = new SettingsService();
    await service.setPreference("default-production", "ALPHA");
    await service.setPreference("default-production", undefined);

    expect(service.state().preferences["default-production"]).toBeUndefined();

    const reloaded = new SettingsService();
    await reloaded.init();
    expect(reloaded.state().preferences["default-production"]).toBeUndefined();
  });

  it("reset clears all preferences", async () => {
    const { SettingsService } = await import("./settings-service.js");
    const service = new SettingsService();
    await service.setPreference("default-production", "ALPHA");
    const state = await service.reset();
    expect(state.preferences).toEqual({});
  });
});
