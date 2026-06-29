/**
 * Token loader.
 *
 * Injects the active theme's semantic tokens (plus typography/spacing) as
 * CSS custom properties on :root. Components consume them via
 * `var(--token-name)` so themes can be swapped at runtime by re-loading.
 */
import { themes, DEFAULT_THEME, type ThemeName } from "./themes.js";
import { typographyTokens } from "./typography.js";
import { spacingTokens } from "./spacing.js";

export type { ThemeName, Theme, ThemeColors } from "./themes.js";
export * from "./colors.js";
export * from "./typography.js";
export * from "./spacing.js";
export { themes, DEFAULT_THEME } from "./themes.js";

/** Flatten all tokens for a theme into CSS custom properties. */
function buildCssVariables(themeName: ThemeName): Record<string, string> {
  const theme = themes[themeName];
  const raw = {
    ...theme.colors,
    ...typographyTokens,
    ...spacingTokens,
  };
  // Prefix every key with "--" so the returned map matches the CSS custom
  // properties injected onto :root and what consumers read back.
  const prefixed: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    prefixed[key.startsWith("--") ? key : `--${key}`] = value;
  }
  return prefixed;
}

/** Inject tokens onto :root. Call once at startup. */
export function loadTokens(themeName: ThemeName = DEFAULT_THEME): void {
  const vars = buildCssVariables(themeName);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(`--${key}`, value);
  }
}

/** Get the raw token map for a theme (used by showcase/tests). */
export function getTokens(themeName: ThemeName = DEFAULT_THEME): Record<string, string> {
  return buildCssVariables(themeName);
}
