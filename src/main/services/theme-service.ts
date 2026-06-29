/**
 * Theme service (main process).
 *
 * Owns the user's theme choice and OS theme bridging. Persists the choice
 * to a JSON file under the studio home and resolves the concrete theme to
 * apply ("system" follows the OS via nativeTheme).
 */
import { nativeTheme } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { config } from "@main/core/config.js";
import { createLogger } from "@main/core/logger.js";

const log = createLogger("theme");

/** The user's intent: a specific theme or follow the OS. */
export type ThemeMode = "studio-dark" | "studio-light" | "system";

/** The concrete theme actually rendered. */
export type ResolvedTheme = "studio-dark" | "studio-light";

export interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

const THEME_FILE = join(config.home, "settings", "theme.json");
const DEFAULT_MODE: ThemeMode = "studio-dark";

/** Listener fired whenever the resolved theme changes. */
export type ThemeListener = (resolved: ResolvedTheme) => void;

export class ThemeService {
  private mode: ThemeMode = DEFAULT_MODE;
  private listeners = new Set<ThemeListener>();

  /** Load the persisted mode and apply nativeTheme. */
  async init(): Promise<ThemeState> {
    this.mode = await this.readMode();
    this.applyNativeTheme();
    nativeTheme.on("updated", () => this.onNativeThemeChanged());
    log.info("theme initialized", { mode: this.mode, resolved: this.resolved() });
    return this.state();
  }

  /** Persist a new mode and return the resulting state. */
  async setMode(mode: ThemeMode): Promise<ThemeState> {
    this.mode = mode;
    await this.writeMode(mode);
    this.applyNativeTheme();
    log.info("theme set", { mode, resolved: this.resolved() });
    return this.state();
  }

  state(): ThemeState {
    return { mode: this.mode, resolvedTheme: this.resolved() };
  }

  /** Subscribe to resolved-theme changes (OS dark/light flips in system mode). */
  onChange(listener: ThemeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Compute the resolved theme from mode + current OS state. */
  private resolved(): ResolvedTheme {
    if (this.mode === "system") {
      return nativeTheme.shouldUseDarkColors ? "studio-dark" : "studio-light";
    }
    return this.mode;
  }

  private applyNativeTheme(): void {
    if (this.mode === "system") nativeTheme.themeSource = "system";
    else if (this.mode === "studio-dark") nativeTheme.themeSource = "dark";
    else nativeTheme.themeSource = "light";
  }

  private onNativeThemeChanged(): void {
    if (this.mode !== "system") return; // only system mode reacts to OS
    const resolved = this.resolved();
    log.info("native theme changed", { resolved });
    for (const listener of this.listeners) listener(resolved);
  }

  private async readMode(): Promise<ThemeMode> {
    try {
      const raw = await readFile(THEME_FILE, "utf-8");
      const parsed = JSON.parse(raw) as { mode?: unknown };
      return isThemeMode(parsed.mode) ? parsed.mode : DEFAULT_MODE;
    } catch {
      return DEFAULT_MODE; // missing/corrupt file → default
    }
  }

  private async writeMode(mode: ThemeMode): Promise<void> {
    try {
      await mkdir(dirname(THEME_FILE), { recursive: true });
      await writeFile(THEME_FILE, JSON.stringify({ mode }), "utf-8");
    } catch (err) {
      log.error("could not persist theme", { error: (err as Error).message });
    }
  }
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "studio-dark" || value === "studio-light" || value === "system";
}
