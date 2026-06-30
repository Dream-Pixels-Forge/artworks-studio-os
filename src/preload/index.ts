/**
 * Preload bridge.
 *
 * Runs in an isolated context with Node access, and exposes a minimal,
 * safe API surface to the renderer via contextBridge. The renderer never
 * touches Node directly — only what we explicitly expose here.
 */
import { contextBridge, ipcRenderer } from "electron";

/** Theme types mirrored from main (preload can't import renderer/shared). */
type ThemeMode = "studio-dark" | "studio-light" | "system";
type ResolvedTheme = "studio-dark" | "studio-light";

/** Menu actions the renderer can react to (mirrors src/shared/window). */
type MenuAction = "new-production" | "open-production";

/** Preference keys (mirrors src/shared/settings). */
type PreferenceKey = "default-production";

const artworksApi = {
  /** Build metadata, for the About/version UI. */
  version: "0.1.0",
  product: "Artworks Studio OS",
  tagline: "Create Stories. Build Worlds. Direct Intelligence.",

  /** Studio / production operations (studio home + init marker). */
  studio: {
    status: (): Promise<{ initialized: boolean; home: string }> =>
      ipcRenderer.invoke("studio:status"),
  },

  /** Theme operations — runtime switching + persistence + OS-follow. */
  theme: {
    get: (): Promise<{ mode: ThemeMode; resolvedTheme: ResolvedTheme }> =>
      ipcRenderer.invoke("theme:get"),
    set: (mode: ThemeMode): Promise<{ mode: ThemeMode; resolvedTheme: ResolvedTheme }> =>
      ipcRenderer.invoke("theme:set", mode),
    onNativeUpdated: (cb: (resolved: ResolvedTheme) => void): (() => void) => {
      const listener = (_event: unknown, resolved: ResolvedTheme): void => cb(resolved);
      ipcRenderer.on("theme:native-updated", listener);
      return () => ipcRenderer.off("theme:native-updated", listener);
    },
  },

  /** Project Explorer — browse productions in the studio home. */
  explorer: {
    listProductions: () =>
      ipcRenderer.invoke("explorer:listProductions"),
    getActive: () =>
      ipcRenderer.invoke("explorer:getActive"),
    open: (name: string) =>
      ipcRenderer.invoke("explorer:open", name),
    tree: (name: string) =>
      ipcRenderer.invoke("explorer:tree", name),
    expand: (path: string) =>
      ipcRenderer.invoke("explorer:expand", path),
    manifest: (name: string) =>
      ipcRenderer.invoke("explorer:manifest", name),
  },

  /** Window controls — the custom title bar drives these. */
  window: {
    minimize: (): void => {
      ipcRenderer.send("window:minimize");
    },
    toggleMaximize: (): void => {
      ipcRenderer.send("window:maximize-toggle");
    },
    close: (): void => {
      ipcRenderer.send("window:close");
    },
    isMaximized: (): Promise<boolean> =>
      ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChanged: (cb: (isMaximized: boolean) => void): (() => void) => {
      const listener = (_event: unknown, isMaximized: boolean): void => cb(isMaximized);
      ipcRenderer.on("window:maximized-changed", listener);
      return () => ipcRenderer.off("window:maximized-changed", listener);
    },
  },

  /** App-menu actions — the menu forwards studio actions here. */
  menu: {
    onAction: (cb: (action: MenuAction) => void): (() => void) => {
      const listener = (_event: unknown, action: MenuAction): void => cb(action);
      ipcRenderer.on("menu:action", listener);
      return () => ipcRenderer.off("menu:action", listener);
    },
  },

  /** Settings — persistent user preferences (backed by a JSON store). */
  settings: {
    get: (): Promise<{ preferences: Partial<Record<PreferenceKey, string>> }> =>
      ipcRenderer.invoke("settings:get"),
    set: (
      key: PreferenceKey,
      value: string | undefined,
    ): Promise<{ preferences: Partial<Record<PreferenceKey, string>> }> =>
      ipcRenderer.invoke("settings:set", key, value),
    reset: (): Promise<{ preferences: Partial<Record<PreferenceKey, string>> }> =>
      ipcRenderer.invoke("settings:reset"),
  },
};

contextBridge.exposeInMainWorld("artworks", artworksApi);

export type ArtworksApi = typeof artworksApi;
