/**
 * Theme definitions.
 *
 * Semantic tokens (prefixed `color-`) are the contract components depend on.
 * Each theme maps those tokens to concrete values. Studio Dark is the
 * default; Studio Light is provided for accessibility and preference.
 *
 * Per docs/ui-ux.md, additional themes (Cinema Dark, Midnight, Accessibility)
 * arrive later — the structure here supports adding them without changing
 * components.
 */
import { studioDark } from "./colors.js";

export type ThemeName = "studio-dark" | "studio-light";

export type ThemeColors = Record<string, string>;

export interface Theme {
  readonly name: ThemeName;
  readonly label: string;
  readonly colors: ThemeColors;
}

export const studioLight: ThemeColors = {
  "color-bg": "#F5F5F2",
  "color-bg-elevated": "#FFFFFF",
  "color-surface": "#ECECE7",
  "color-surface-muted": "#E0E0DA",
  "color-text": "#1A1A1A",
  "color-text-muted": "#5A5A5F",
  "color-border": "#D0D0C9",
  "color-accent": "#B8974F",
  "color-accent-hover": "#A88640",
  "color-accent-pressed": "#967535",
  "color-success": "#3D9A68",
  "color-info": "#4A78D4",
  "color-warning": "#C98A30",
  "color-danger": "#C44541",
};

export const themes: Record<ThemeName, Theme> = {
  "studio-dark": {
    name: "studio-dark",
    label: "Studio Dark",
    colors: studioDark,
  },
  "studio-light": {
    name: "studio-light",
    label: "Studio Light",
    colors: studioLight,
  },
};

export const DEFAULT_THEME: ThemeName = "studio-dark";
