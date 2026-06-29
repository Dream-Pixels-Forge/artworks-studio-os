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

const artworksApi = {
  /** Build metadata, for the About/version UI. */
  version: "0.1.0",
  product: "Artworks Studio OS",
  tagline: "Create Stories. Build Worlds. Direct Intelligence.",

  /** Studio / production operations (backed by IPC, wired in Phase 1). */
  studio: {
    async status(): Promise<{ initialized: boolean; home: string }> {
      throw new Error("studio.status() not wired — arrives in Phase 1");
    },
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
};

contextBridge.exposeInMainWorld("artworks", artworksApi);

export type ArtworksApi = typeof artworksApi;
