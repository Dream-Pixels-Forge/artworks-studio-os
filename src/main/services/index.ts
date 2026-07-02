/** Cross-cutting services: theme, settings, (future) filesystem, notifications. */
export { ThemeService } from "./theme-service.js";
export type { ThemeMode, ResolvedTheme, ThemeState } from "./theme-service.js";
export { registerThemeIpc } from "./theme-ipc.js";
export { CHANNEL_GET, CHANNEL_SET, CHANNEL_NATIVE } from "./theme-ipc.js";
export { SettingsService } from "./settings-service.js";
export type { Preferences, SettingsState } from "@shared/settings/index.js";
export { registerSettingsIpc, registerStudioStatusIpc } from "./settings-ipc.js";
