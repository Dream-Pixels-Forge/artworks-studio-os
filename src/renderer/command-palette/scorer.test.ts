/**
 * Command palette scorer tests.
 *
 * The scorer is the core algorithm — pure, so fully unit-testable.
 */
import { describe, it, expect } from "vitest";
import { scoreCommand } from "./scorer.js";
import type { PaletteCommand } from "@shared/palette/command.js";

function cmd(id: string, title: string, category?: string, keywords?: string[]): PaletteCommand {
  return { id, title, category, keywords, run: () => {} };
}

describe("scorer", () => {
  it("returns a base score for an empty query (recency order)", () => {
    const s = scoreCommand(cmd("a", "Alpha"), "", 0);
    expect(s).not.toBeNull();
  });

  it("matches a subsequence", () => {
    expect(scoreCommand(cmd("a", "Toggle Dark Theme"), "tdt", 0)).not.toBeNull();
  });

  it("rejects a non-matching query", () => {
    expect(scoreCommand(cmd("a", "Toggle Theme"), "xyz", 0)).toBeNull();
  });

  it("rejects when query chars don't appear in order", () => {
    expect(scoreCommand(cmd("a", "Toggle Theme"), "mtt", 0)).toBeNull();
  });

  it("matches against keywords, not just title", () => {
    const c = cmd("a", "New", undefined, ["create", "project"]);
    expect(scoreCommand(c, "project", 0)).not.toBeNull();
  });

  it("ranks contiguous matches higher than scattered", () => {
    const contiguous = scoreCommand(cmd("a", "theme"), "theme", 0)!;
    const scattered = scoreCommand(cmd("b", "t.h.e.m.e"), "theme", 0)!;
    expect(contiguous).toBeGreaterThan(scattered);
  });

  it("boosts by recency", () => {
    const without = scoreCommand(cmd("a", "Toggle Theme"), "theme", 0)!;
    const withRecency = scoreCommand(cmd("a", "Toggle Theme"), "theme", 40)!;
    expect(withRecency).toBeGreaterThan(without);
  });

  it("ranks contiguous matches higher than scattered ones", () => {
    const contiguous = scoreCommand(cmd("a", "theme"), "the", 0)!;
    const scattered = scoreCommand(cmd("b", "t.x.h.e"), "the", 0)!;
    expect(contiguous).toBeGreaterThan(scattered);
  });
});
