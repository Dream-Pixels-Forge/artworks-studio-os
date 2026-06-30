/**
 * Settings DTOs + channel constants.
 *
 * Cross-process types shared by the main settings service and the renderer
 * preferences panel. Lives in shared/ so both process tsconfigs import it.
 *
 * User preferences persist to a JSON file under the studio home — same
 * convention as the theme service — so the app and the `aw` CLI agree on a
 * single, human-readable source of truth.
 */

/** The known user-facing preference keys. Open set; unknown keys are ignored. */
export type PreferenceKey = "default-production";

/** A snapshot of all preferences. Optional fields are unset until chosen. */
export interface Preferences {
  /** Production opened by default on launch (empty string = none). */
  "default-production"?: string;
}

/** The full settings payload returned to the renderer. */
export interface SettingsState {
  /** Preferences the user has set. */
  preferences: Preferences;
}

/** Renderer → main IPC channels. */
export const SETTINGS_CHANNELS = {
  get: "settings:get",
  set: "settings:set",
  reset: "settings:reset",
} as const;

/** Studio status channel (home resolution + init marker), wired in Phase 1. */
export const STUDIO_CHANNELS = {
  status: "studio:status",
} as const;
