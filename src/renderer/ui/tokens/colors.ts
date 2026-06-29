/**
 * Color tokens.
 *
 * Derived from docs/ui-ux.md "Color System": primary deep charcoal,
 * secondary slate gray, accent warm gold, plus status colors. Defined as
 * semantic tokens so themes can remap them without touching components.
 */
import type { ThemeColors } from "./themes.js";

export interface ColorScale {
  /** Base value for the token. */
  readonly value: string;
  /** Human-readable name for tooling. */
  readonly name: string;
}

export const neutral = {
  charcoal: "#161616",
  charcoalElevated: "#1F1F1F",
  slate: "#2A2A2D",
  slateMuted: "#3A3A3E",
  ink: "#E8E8E8",
  inkMuted: "#9A9A9F",
  hairline: "#333336",
} as const satisfies Record<string, string>;

export const accent = {
  gold: "#C9A961",
  goldHover: "#D6B97A",
  goldPressed: "#B8974F",
} as const satisfies Record<string, string>;

export const status = {
  success: "#4CAF7D",
  info: "#5B8DEF",
  warning: "#E0A545",
  danger: "#D9534F",
} as const satisfies Record<string, string>;

/** Semantic tokens — what components reference. */
export const studioDark: ThemeColors = {
  "color-bg": neutral.charcoal,
  "color-bg-elevated": neutral.charcoalElevated,
  "color-surface": neutral.slate,
  "color-surface-muted": neutral.slateMuted,
  "color-text": neutral.ink,
  "color-text-muted": neutral.inkMuted,
  "color-border": neutral.hairline,
  "color-accent": accent.gold,
  "color-accent-hover": accent.goldHover,
  "color-accent-pressed": accent.goldPressed,
  "color-success": status.success,
  "color-info": status.info,
  "color-warning": status.warning,
  "color-danger": status.danger,
};
