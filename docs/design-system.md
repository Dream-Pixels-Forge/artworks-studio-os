# Artworks Studio OS

# design-system.md

Version: 1.0
Status: Foundation
Audience: UI/UX Designers, Frontend Engineers, AI Agents

---

## Purpose

This document is the single source of truth for the visual language of
Artworks Studio OS. It formalizes the design direction described in
`docs/ui-ux.md` into concrete, implementable tokens.

The tokens themselves live in `src/renderer/ui/tokens/`. Every value a
component uses must trace back to a token defined here. **No hardcoded
colors, sizes, or spacing values in components.**

## Design Language

Professional. Elegant. Calm. Focused. Fast. Invisible.

The interface should feel less like operating software and more like
walking through the departments of a professional film studio. It is dark,
quiet, and confident. Decoration is earned, not assumed.

## Color System

### Palette Roots

From `docs/ui-ux.md`:

- **Primary:** Deep charcoal
- **Secondary:** Slate gray
- **Accent:** Warm gold
- **Status:** Green / Blue / Amber / Red

### Raw Values

| Token | Value | Role |
|-------|-------|------|
| `neutral.charcoal` | `#161616` | App background |
| `neutral.charcoalElevated` | `#1F1F1F` | Elevated surfaces |
| `neutral.slate` | `#2A2A2D` | Panels, surfaces |
| `neutral.slateMuted` | `#3A3A3E` | Inactive surfaces |
| `neutral.ink` | `#E8E8E8` | Primary text |
| `neutral.inkMuted` | `#9A9A9F` | Secondary text |
| `neutral.hairline` | `#333336` | Borders, dividers |
| `accent.gold` | `#C9A961` | Primary action |
| `accent.goldHover` | `#D6B97A` | Hover state |
| `accent.goldPressed` | `#B8974F` | Pressed state |
| `status.success` | `#4CAF7D` | Success |
| `status.info` | `#5B8DEF` | Information |
| `status.warning` | `#E0A545` | Warning |
| `status.danger` | `#D9534F` | Danger, destructive |

### Semantic Tokens (what components use)

Components never reference raw values. They reference semantic tokens,
which themes remap. This is what makes theming possible without touching
components.

| Semantic token | Studio Dark | Studio Light |
|----------------|-------------|--------------|
| `--color-bg` | `#161616` | `#F5F5F2` |
| `--color-bg-elevated` | `#1F1F1F` | `#FFFFFF` |
| `--color-surface` | `#2A2A2D` | `#ECECE7` |
| `--color-surface-muted` | `#3A3A3E` | `#E0E0DA` |
| `--color-text` | `#E8E8E8` | `#1A1A1A` |
| `--color-text-muted` | `#9A9A9F` | `#5A5A5F` |
| `--color-border` | `#333336` | `#D0D0C9` |
| `--color-accent` | `#C9A961` | `#B8974F` |
| `--color-success` | `#4CAF7D` | `#3D9A68` |
| `--color-info` | `#5B8DEF` | `#4A78D4` |
| `--color-warning` | `#E0A545` | `#C98A30` |
| `--color-danger` | `#D9534F` | `#C44541` |

## Typography

Per `docs/ui-ux.md`: **Inter** for UI, **JetBrains Mono** for code and
data-heavy displays.

### Type Scale (1.250 — major third)

| Token | Size | Use |
|-------|------|-----|
| `font-size-xs` | 12px | Labels, captions |
| `font-size-sm` | 14px | Secondary text, UI controls |
| `font-size-base` | 16px | Body |
| `font-size-lg` | 20px | Section headers |
| `font-size-xl` | 24px | Panel titles |
| `font-size-2xl` | 32px | Page titles |

### Weights

| Token | Weight |
|-------|--------|
| `font-weight-regular` | 400 |
| `font-weight-medium` | 500 |
| `font-weight-semibold` | 600 |
| `font-weight-bold` | 700 |

### Line Height

| Token | Value | Use |
|-------|-------|-----|
| `line-height-tight` | 1.2 | Headings |
| `line-height-base` | 1.5 | Body, UI |
| `line-height-relaxed` | 1.7 | Long-form reading |

## Spacing

4px base unit. All layout spacing uses these tokens.

| Token | Value |
|-------|-------|
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |

## Radii

| Token | Value | Use |
|-------|-------|-----|
| `radius-none` | 0 | Full-bleed surfaces |
| `radius-sm` | 3px | Inputs, small controls |
| `radius-base` | 6px | Buttons, cards |
| `radius-lg` | 10px | Panels, dialogs |
| `radius-full` | 9999px | Pills, avatars |

## Shadows

Subtle by design. The interface is flat and calm; depth is implied by
elevation tokens and hairlines, not heavy shadows.

| Token | Value |
|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.25)` |
| `shadow-base` | `0 2px 8px rgba(0,0,0,0.35)` |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.45)` |

## Themes

- **Studio Dark** (default) — the primary experience.
- **Studio Light** — for accessibility and preference.

Additional themes from `docs/ui-ux.md` (Cinema Dark, Midnight, Accessibility
Themes) arrive in later phases. The token architecture supports adding them
without component changes: register a new `ThemeColors` map.

## Iconography

Minimal, line-based, production-oriented. Every department receives a
unique icon. Icon assets arrive in Phase 1 with the asset pipeline; the
contract is line-based, single-weight, 16px / 20px / 24px grid-aligned.

## Accessibility

- **Contrast:** Studio Dark's text tokens meet WCAG AA against their
  backgrounds (`#E8E8E8` on `#161616` ≈ 12.6:1).
- **Color-blind safe:** status is never conveyed by color alone — pair
  every status color with an icon or label.
- **Motion:** respect `prefers-reduced-motion`. Animations are functional,
  never decorative-only.
- **Focus:** every interactive element has a visible, token-driven focus
  ring.

## Token Consumption

Components consume tokens via CSS custom properties:

```css
.button {
  background: var(--color-accent);
  color: var(--color-bg);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-base);
  font-family: var(--font-sans);
}
```

Themes swap by re-injecting the semantic tokens via `loadTokens("studio-light")`.

---

End of Document
