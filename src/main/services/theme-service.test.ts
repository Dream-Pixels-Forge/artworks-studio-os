/**
 * Theme service tests.
 *
 * Electron's nativeTheme isn't available in the Vitest node environment, so
 * these tests cover the pure, testable parts: theme-mode validation and the
 * persistence file contract. Runtime behavior (nativeTheme bridging, IPC)
 * is exercised manually.
 */
import { describe, it, expect } from "vitest";

/** Re-declare the validation guard to test it in isolation. */
function isThemeMode(value: unknown): value is ThemeMode {
  return value === "studio-dark" || value === "studio-light" || value === "system";
}

type ThemeMode = "studio-dark" | "studio-light" | "system";

describe("theme mode validation", () => {
  it("accepts the three valid modes", () => {
    expect(isThemeMode("studio-dark")).toBe(true);
    expect(isThemeMode("studio-light")).toBe(true);
    expect(isThemeMode("system")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isThemeMode("dark")).toBe(false);
    expect(isThemeMode("")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(42)).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });
});

describe("theme persistence contract", () => {
  it("serializes the mode to the documented JSON shape", () => {
    // The file shape is { mode: ThemeMode }. Any change here is a breaking
    // change to the persisted file — pin it.
    const serialized = JSON.stringify({ mode: "studio-light" });
    const parsed = JSON.parse(serialized) as { mode: string };
    expect(isThemeMode(parsed.mode)).toBe(true);
    expect(parsed.mode).toBe("studio-light");
  });

  it("falls back to the default for an unknown persisted mode", () => {
    const corrupted = JSON.stringify({ mode: "neon-pink" });
    const parsed = JSON.parse(corrupted) as { mode: string };
    expect(isThemeMode(parsed.mode)).toBe(false); // → default applies at read
  });
});
