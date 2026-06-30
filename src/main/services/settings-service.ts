/**
 * Settings service (main process).
 *
 * Owns user-facing preferences and persists them to a JSON file under the
 * studio home — the same convention as the theme service — so preferences
 * survive restarts and stay readable by the `aw` CLI. Reads are type-guarded
 * and fall back to defaults for a missing or corrupt file.
 *
 * Note: theme and the active production are owned by their own services
 * (ThemeService and the ProductionFs active-project pointer). The settings
 * panel reads/writes *preferences* here and delegates to those services for
 * the live behavior.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "@main/core/config.js";
import { createLogger } from "@main/core/logger.js";
import type { Preferences, SettingsState } from "@shared/settings/index.js";

const log = createLogger("settings");

/**
 * Resolve the preferences file lazily from the current studio home. Kept as a
 * method (not a module constant) so tests that repoint AW_HOME after import
 * see the updated path — config.home is read at call time.
 */
function preferencesFile(): string {
  return join(config.home, "settings", "preferences.json");
}

/** A preference value is a string (production names, paths, etc.). */
type PreferenceValue = string;

export class SettingsService {
  private preferences: Preferences = {};

  /** Load persisted preferences. */
  async init(): Promise<SettingsState> {
    this.preferences = await this.readPreferences();
    log.info("settings initialized", { keys: Object.keys(this.preferences) });
    return this.state();
  }

  /** Set a single preference and persist. */
  async setPreference(key: keyof Preferences, value: PreferenceValue | undefined): Promise<SettingsState> {
    if (value === undefined || value === "") {
      delete this.preferences[key];
    } else {
      this.preferences[key] = value;
    }
    await this.writePreferences(this.preferences);
    log.info("preference set", { key, value: value ?? "<cleared>" });
    return this.state();
  }

  /** Clear all preferences back to defaults. */
  async reset(): Promise<SettingsState> {
    this.preferences = {};
    await this.writePreferences(this.preferences);
    log.info("preferences reset to defaults");
    return this.state();
  }

  state(): SettingsState {
    return { preferences: { ...this.preferences } };
  }

  /** Path the preferences persist to — exposed for tests + tooling. */
  get path(): string {
    return preferencesFile();
  }

  private async readPreferences(): Promise<Preferences> {
    const file = preferencesFile();
    try {
      if (!existsSync(file)) return {};
      const raw = await readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as { preferences?: unknown };
      return isPreferences(parsed["preferences"]) ? parsed["preferences"] : {};
    } catch {
      return {}; // missing/corrupt file → defaults
    }
  }

  private async writePreferences(preferences: Preferences): Promise<void> {
    const file = preferencesFile();
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ preferences }), "utf-8");
    } catch (err) {
      log.error("could not persist preferences", { error: (err as Error).message });
    }
  }
}

/**
 * Type guard for the persisted preferences shape. Exported so the
 * persistence contract can be pinned by tests.
 */
export function isPreferences(value: unknown): value is Preferences {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  // Every present value must be a string; unknown keys are tolerated (open set).
  return Object.values(v).every((val) => typeof val === "string");
}
