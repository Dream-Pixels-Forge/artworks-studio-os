/**
 * Theme provider.
 *
 * Holds theme state in the renderer and re-injects CSS tokens whenever the
 * resolved theme changes. loadTokens() is idempotent (overwrites the same
 * :root custom properties), so calling it again on a switch is exactly the
 * supported path. Persists the choice through the preload bridge.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadTokens, type ThemeName } from "./tokens/index.js";

export type ThemeMode = "studio-dark" | "studio-light" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ThemeName;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

declare global {
  interface Window {
    artworks: {
      theme: {
        get: () => Promise<{ mode: ThemeMode; resolvedTheme: ThemeName }>;
        set: (mode: ThemeMode) => Promise<{ mode: ThemeMode; resolvedTheme: ThemeName }>;
        onNativeUpdated: (cb: (resolved: ThemeName) => void) => () => void;
      };
    };
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("studio-dark");
  const [resolvedTheme, setResolvedTheme] = useState<ThemeName>("studio-dark");

  // On mount: load the persisted theme and seed state.
  useEffect(() => {
    let active = true;
    void window.artworks.theme.get().then((state) => {
      if (!active) return;
      setModeState(state.mode);
      setResolvedTheme(state.resolvedTheme);
    });
    return () => {
      active = false;
    };
  }, []);

  // Re-inject tokens whenever the resolved theme changes.
  useEffect(() => {
    loadTokens(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for OS theme changes (relevant in system mode).
  useEffect(() => {
    return window.artworks.theme.onNativeUpdated((resolved) => {
      setResolvedTheme(resolved);
    });
  }, []);

  const setMode = async (newMode: ThemeMode): Promise<void> => {
    const state = await window.artworks.theme.set(newMode);
    setModeState(state.mode);
    setResolvedTheme(state.resolvedTheme);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
