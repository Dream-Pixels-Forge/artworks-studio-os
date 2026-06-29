/**
 * Design token tests.
 *
 * Guards the token contract: every semantic color must be defined in every
 * theme, and both themes must expose the same token keys. A theme with a
 * missing token would silently break a component.
 */
import { describe, it, expect } from "vitest";
import { getTokens, themes, DEFAULT_THEME } from "./tokens/index.js";

const REQUIRED_COLOR_TOKENS = [
  "--color-bg",
  "--color-bg-elevated",
  "--color-surface",
  "--color-surface-muted",
  "--color-text",
  "--color-text-muted",
  "--color-border",
  "--color-accent",
  "--color-accent-hover",
  "--color-accent-pressed",
  "--color-success",
  "--color-info",
  "--color-warning",
  "--color-danger",
] as const;

const TOKEN_GROUPS = ["--font-sans", "--font-mono", "--space-1", "--radius-base"];

describe("design tokens", () => {
  it("exposes a default theme", () => {
    expect(DEFAULT_THEME).toBe("studio-dark");
  });

  it("ships both studio-dark and studio-light", () => {
    expect(Object.keys(themes).sort()).toEqual(["studio-dark", "studio-light"]);
  });

  it("every theme defines all required color tokens", () => {
    for (const name of Object.keys(themes) as Array<keyof typeof themes>) {
      const tokens = getTokens(name);
      for (const token of REQUIRED_COLOR_TOKENS) {
        expect(tokens[token], `${name} missing ${token}`).toBeTruthy();
      }
    }
  });

  it("all themes expose identical token keys", () => {
    const names = Object.keys(themes) as Array<keyof typeof themes>;
    const first = Object.keys(getTokens(names[0]!)).sort();
    for (const name of names.slice(1)) {
      expect(Object.keys(getTokens(name)).sort()).toEqual(first);
    }
  });

  it("exposes typography and spacing tokens", () => {
    const tokens = getTokens(DEFAULT_THEME);
    for (const token of TOKEN_GROUPS) {
      expect(tokens[token]).toBeTruthy();
    }
  });

  it("color tokens are valid hex", () => {
    const tokens = getTokens(DEFAULT_THEME);
    for (const token of REQUIRED_COLOR_TOKENS) {
      expect(tokens[token]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
