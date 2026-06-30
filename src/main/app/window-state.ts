/**
 * Window-state persistence.
 *
 * Owns the persisted window geometry (size/position/maximized) so the app
 * restores its last window across restarts. Reads/writes a JSON file under
 * the studio home `config/` directory — same convention as the theme file.
 *
 * The pure geometry helpers (clampToVisible / centerIn) are separated from
 * Electron so they're unit-testable without a display.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config } from "@main/core/config.js";
import { createLogger } from "@main/core/logger.js";
import type { DisplayBounds, WindowState } from "@shared/window/index.js";

const log = createLogger("window-state");

const STATE_FILE = join(config.home, "config", "window-state.json");

/** Minimum amount of the window that must stay on-screen to count as visible. */
const MIN_VISIBLE_EDGE = 64;

const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;

/**
 * Default, centered state for the primary display. Used on first launch and
 * when the persisted state is unusable (corrupt file, monitor unplugged).
 */
export function defaultCentered(primary: DisplayBounds): WindowState {
  return centerIn(
    { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
    primary,
  );
}

/** Center a window state within the given display bounds. */
export function centerIn(state: WindowState, display: DisplayBounds): WindowState {
  const x = Math.round(display.x + (display.width - state.width) / 2);
  const y = Math.round(display.y + (display.height - state.height) / 2);
  return { ...state, x, y };
}

/**
 * Decide whether a persisted state is still usable against the current
 * displays. A state is visible if a meaningful sliver of its top edge lands
 * on some display (handles the "saved on monitor 2, now unplugged" case).
 */
export function isVisibleOnAny(state: WindowState, displays: DisplayBounds[]): boolean {
  if (state.x === undefined || state.y === undefined) return false;
  return displays.some(
    (d) =>
      state.x! + MIN_VISIBLE_EDGE > d.x &&
      state.x! < d.x + d.width - MIN_VISIBLE_EDGE &&
      state.y! + MIN_VISIBLE_EDGE > d.y &&
      state.y! < d.y + d.height,
  );
}

/**
 * Resolve a persisted state against the current displays, falling back to a
 * centered default when it would render off-screen. Pure — no side effects.
 */
export function clampToVisible(
  persisted: WindowState,
  displays: DisplayBounds[],
): WindowState {
  const primary = displays[0];
  if (!primary) return persisted; // no displays reported; trust the caller
  if (isVisibleOnAny(persisted, displays)) return persisted;
  return defaultCentered(primary);
}

/**
 * Type guard for the persisted JSON shape. Exported so the persistence
 * contract can be pinned without coupling tests to the file path.
 */
export function isWindowStateLike(value: unknown): value is WindowState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["width"] === "number" &&
    typeof v["height"] === "number" &&
    (v["x"] === undefined || typeof v["x"] === "number") &&
    (v["y"] === undefined || typeof v["y"] === "number") &&
    (v["isMaximized"] === undefined || typeof v["isMaximized"] === "boolean")
  );
}

/** Persists and restores the window geometry file. */
export class WindowStateStore {
  /** Read the persisted state, or undefined when absent/corrupt. */
  async load(): Promise<WindowState | undefined> {
    try {
      const raw = await readFile(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as { window?: unknown };
      return isWindowStateLike(parsed["window"]) ? parsed["window"] : undefined;
    } catch {
      return undefined; // missing/corrupt file → caller applies the default
    }
  }

  /** Persist the current state. Best-effort; never throws to the caller. */
  async save(state: WindowState): Promise<void> {
    try {
      await mkdir(dirname(STATE_FILE), { recursive: true });
      await writeFile(STATE_FILE, JSON.stringify({ window: state }), "utf-8");
    } catch (err) {
      log.error("could not persist window state", { error: (err as Error).message });
    }
  }

  /** Exposed for tests that need to know the path under a fake home. */
  get path(): string {
    return STATE_FILE;
  }
}
