/**
 * Preload bridge.
 *
 * Runs in an isolated context with Node access, and exposes a minimal,
 * safe API surface to the renderer via contextBridge. The renderer never
 * touches Node directly — only what we explicitly expose here.
 */
import { contextBridge } from "electron";

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
};

contextBridge.exposeInMainWorld("artworks", artworksApi);

export type ArtworksApi = typeof artworksApi;
