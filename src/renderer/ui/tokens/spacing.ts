/**
 * Spacing, radius, and shadow tokens.
 *
 * Spacing uses a 4px base unit. Radii and shadows are deliberately subtle —
 * the design language is "calm, focused, professional" (docs/ui-ux.md).
 */
export const spacing = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const radii = {
  none: "0",
  sm: "3px",
  base: "6px",
  lg: "10px",
  full: "9999px",
} as const;

export const shadows = {
  none: "none",
  sm: "0 1px 2px rgba(0, 0, 0, 0.25)",
  base: "0 2px 8px rgba(0, 0, 0, 0.35)",
  lg: "0 8px 24px rgba(0, 0, 0, 0.45)",
} as const;

export const spacingTokens = {
  "space-0": spacing[0],
  "space-1": spacing[1],
  "space-2": spacing[2],
  "space-3": spacing[3],
  "space-4": spacing[4],
  "space-5": spacing[5],
  "space-6": spacing[6],
  "space-8": spacing[8],
  "space-10": spacing[10],
  "space-12": spacing[12],
  "space-16": spacing[16],
  "radius-sm": radii.sm,
  "radius-base": radii.base,
  "radius-lg": radii.lg,
  "radius-full": radii.full,
  "shadow-sm": shadows.sm,
  "shadow-base": shadows.base,
  "shadow-lg": shadows.lg,
} as const satisfies Record<string, string>;
