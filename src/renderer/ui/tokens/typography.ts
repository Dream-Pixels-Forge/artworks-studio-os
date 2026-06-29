/**
 * Typography tokens.
 *
 * Per docs/ui-ux.md: Inter for UI, JetBrains Mono for code/data. Type
 * scale is a modular 1.250 (major third) ratio.
 */
export const fontFamily = {
  sans: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  mono: `'JetBrains Mono', 'SFMono-Regular', Consolas, monospace`,
} as const;

export const fontSize = {
  xs: "0.75rem", // 12px
  sm: "0.875rem", // 14px
  base: "1rem", // 16px
  lg: "1.25rem", // 20px
  xl: "1.5rem", // 24px
  "2xl": "2rem", // 32px
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.2,
  base: 1.5,
  relaxed: 1.7,
} as const;

export const typographyTokens = {
  "font-sans": fontFamily.sans,
  "font-mono": fontFamily.mono,
  "font-size-xs": fontSize.xs,
  "font-size-sm": fontSize.sm,
  "font-size-base": fontSize.base,
  "font-size-lg": fontSize.lg,
  "font-size-xl": fontSize.xl,
  "font-size-2xl": fontSize["2xl"],
  "font-weight-regular": String(fontWeight.regular),
  "font-weight-medium": String(fontWeight.medium),
  "font-weight-semibold": String(fontWeight.semibold),
  "font-weight-bold": String(fontWeight.bold),
  "line-height-tight": String(lineHeight.tight),
  "line-height-base": String(lineHeight.base),
} as const satisfies Record<string, string>;
