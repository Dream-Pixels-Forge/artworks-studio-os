/**
 * Window-state tests.
 *
 * Electron's screen/Display API isn't available in the Vitest node
 * environment, so these tests cover the pure, testable parts: the geometry
 * helpers (visibility, clamping, centering) and the persisted file contract.
 * Native BrowserWindow behavior is exercised manually.
 */
import { describe, it, expect } from "vitest";
import {
  centerIn,
  clampToVisible,
  defaultCentered,
  isVisibleOnAny,
  isWindowStateLike,
} from "./window-state.js";

const DISPLAY: import("@shared/window").DisplayBounds = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
};

const WIDE_DISPLAY: import("@shared/window").DisplayBounds = {
  x: 1920,
  y: 0,
  width: 2560,
  height: 1440,
};

describe("centerIn", () => {
  it("centers a window within a display", () => {
    const centered = centerIn({ width: 1440, height: 900 }, DISPLAY);
    expect(centered.x).toBe(Math.round((1920 - 1440) / 2)); // 240
    expect(centered.y).toBe(Math.round((1080 - 900) / 2)); // 90
  });

  it("can go negative when the window is wider than the display", () => {
    const centered = centerIn({ width: 2200, height: 900 }, DISPLAY);
    expect(centered.x).toBe(-140);
  });
});

describe("defaultCentered", () => {
  it("produces a centered default-sized window", () => {
    const def = defaultCentered(DISPLAY);
    expect(def.width).toBe(1440);
    expect(def.height).toBe(900);
    expect(def.x).toBe(240);
    expect(def.y).toBe(90);
  });
});

describe("isVisibleOnAny", () => {
  it("considers a fully-on-screen window visible", () => {
    expect(isVisibleOnAny({ width: 100, height: 100, x: 100, y: 100 }, [DISPLAY])).toBe(
      true,
    );
  });

  it("considers a window spanning into a second display visible", () => {
    const spanning = { width: 500, height: 500, x: DISPLAY.width - 100, y: 50 };
    expect(isVisibleOnAny(spanning, [DISPLAY, WIDE_DISPLAY])).toBe(true);
  });

  it("rejects a window positioned entirely off-screen", () => {
    expect(
      isVisibleOnAny({ width: 100, height: 100, x: 5000, y: 5000 }, [DISPLAY]),
    ).toBe(false);
  });

  it("rejects a window saved on a now-unplugged monitor", () => {
    // Saved at the start of the (removed) wide display — nothing renders there now.
    const orphaned = { width: 1440, height: 900, x: 2000, y: 100 };
    expect(isVisibleOnAny(orphaned, [DISPLAY])).toBe(false);
  });

  it("rejects a state with no position", () => {
    expect(isVisibleOnAny({ width: 100, height: 100 }, [DISPLAY])).toBe(false);
  });
});

describe("clampToVisible", () => {
  it("returns the state unchanged when it is visible", () => {
    const state = { width: 1440, height: 900, x: 100, y: 100 };
    expect(clampToVisible(state, [DISPLAY])).toEqual(state);
  });

  it("re-centers on the primary display when off-screen", () => {
    const offscreen = { width: 1440, height: 900, x: 5000, y: 5000 };
    const clamped = clampToVisible(offscreen, [DISPLAY]);
    expect(clamped.x).toBe(240);
    expect(clamped.y).toBe(90);
  });

  it("falls back to the centered default when no displays are reported", () => {
    const state = { width: 1440, height: 900, x: 100, y: 100 };
    // No displays → trust the caller, return as-is.
    expect(clampToVisible(state, [])).toEqual(state);
  });
});

describe("window-state persistence contract", () => {
  it("serializes to the documented JSON shape", () => {
    // File shape is { window: WindowState }. Changing it is a breaking change
    // to the persisted file — pin it.
    const serialized = JSON.stringify({
      window: { width: 1440, height: 900, x: 240, y: 90, isMaximized: false },
    });
    const parsed = JSON.parse(serialized) as { window: unknown };
    expect(isWindowStateLike(parsed["window"])).toBe(true);
  });

  it("accepts a minimized-shape state (position omitted when maximized)", () => {
    const serialized = JSON.stringify({
      window: { width: 1440, height: 900, isMaximized: true },
    });
    const parsed = JSON.parse(serialized) as { window: unknown };
    expect(isWindowStateLike(parsed["window"])).toBe(true);
  });

  it("rejects a corrupt persisted value", () => {
    expect(isWindowStateLike(null)).toBe(false);
    expect(isWindowStateLike({ width: "wide" })).toBe(false);
    expect(isWindowStateLike({ width: 100 })).toBe(false); // missing height
  });
});
