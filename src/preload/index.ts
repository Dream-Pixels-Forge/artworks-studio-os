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

  /** Production operations — project, asset, document CRUD + search + stats. */
  production: {
    project: {
      list: () =>
        ipcRenderer.invoke("production:project:list"),
      create: (input: { name: string; description?: string }) =>
        ipcRenderer.invoke("production:project:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:project:get", uuid),
      update: (project: unknown) =>
        ipcRenderer.invoke("production:project:update", project),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:project:delete", uuid),
    },
    asset: {
      list: (filter?: { type?: "image" | "video" | "audio" | "document" }) =>
        ipcRenderer.invoke("production:asset:list", filter),
      create: (input: {
        name: string;
        assetType: "image" | "video" | "audio" | "document";
        path: string;
        mimeType: string;
        sizeBytes?: number;
      }) =>
        ipcRenderer.invoke("production:asset:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:asset:get", uuid),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:asset:delete", uuid),
    },
    document: {
      list: (projectUuid?: string) =>
        ipcRenderer.invoke("production:document:list", projectUuid),
      create: (input: {
        name: string;
        docType: string;
        content?: string;
        projectUuid?: string;
      }) =>
        ipcRenderer.invoke("production:document:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:document:get", uuid),
      update: (doc: unknown) =>
        ipcRenderer.invoke("production:document:update", doc),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:document:delete", uuid),
    },
    search: (query: string) =>
      ipcRenderer.invoke("production:search", query),
    stats: () =>
      ipcRenderer.invoke("production:dashboard:stats"),
    graph: {
      connect: (source: string, target: string, type: string) =>
        ipcRenderer.invoke("production:graph:connect", source, target, type),
      relationships: (from: string) =>
        ipcRenderer.invoke("production:graph:relationships", from),
      disconnect: (source: string, target: string, type: string) =>
        ipcRenderer.invoke("production:graph:disconnect", source, target, type),
    },
    version: {
      list: (entityUuid: string) =>
        ipcRenderer.invoke("production:version:list", entityUuid),
      get: (entityUuid: string, version: number) =>
        ipcRenderer.invoke("production:version:get", entityUuid, version),
    },
    entity: {
      get: (uuid: string) =>
        ipcRenderer.invoke("production:entity:get", uuid),
      listByType: (type: string) =>
        ipcRenderer.invoke("production:entity:listByType", type),
      tag: (uuid: string, tag: string) =>
        ipcRenderer.invoke("production:entity:tag", uuid, tag),
      untag: (uuid: string, tag: string) =>
        ipcRenderer.invoke("production:entity:untag", uuid, tag),
      patchStatus: (uuid: string, status: string) =>
        ipcRenderer.invoke("production:entity:patchStatus", uuid, status),
    },
    conversation: {
      list: () =>
        ipcRenderer.invoke("production:conversation:list"),
      create: (input: {
        name: string; projectUuid?: string; provider?: string; model?: string;
        messages?: { role: "system" | "user" | "assistant"; content: string }[];
      }) =>
        ipcRenderer.invoke("production:conversation:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:conversation:get", uuid),
      addMessage: (uuid: string, msg: { role: "system" | "user" | "assistant"; content: string }) =>
        ipcRenderer.invoke("production:conversation:addMessage", uuid, msg),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:conversation:delete", uuid),
    },
    prompt: {
      list: () =>
        ipcRenderer.invoke("production:prompt:list"),
      create: (input: {
        name: string; projectUuid?: string; provider?: string; model?: string; template: string;
      }) =>
        ipcRenderer.invoke("production:prompt:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:prompt:get", uuid),
      update: (prompt: unknown) =>
        ipcRenderer.invoke("production:prompt:update", prompt),
      render: (template: string, vars: Record<string, string>) =>
        ipcRenderer.invoke("production:prompt:render", template, vars),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:prompt:delete", uuid),
    },
    workflow: {
      list: () =>
        ipcRenderer.invoke("production:workflow:list"),
      create: (input: {
        name: string; projectUuid?: string; definition?: { steps: unknown[] };
      }) =>
        ipcRenderer.invoke("production:workflow:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:workflow:get", uuid),
      updateState: (uuid: string, state: string) =>
        ipcRenderer.invoke("production:workflow:updateState", uuid, state),
      updateDefinition: (uuid: string, definition: unknown) =>
        ipcRenderer.invoke("production:workflow:updateDefinition", uuid, definition),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:workflow:delete", uuid),
    },
  },

  /** Plugin management — install, enable/disable, uninstall. */
  plugin: {
    list: () =>
      ipcRenderer.invoke("plugin:list"),
    get: (uuid: string) =>
      ipcRenderer.invoke("plugin:get", uuid),
    install: (input: { manifest: unknown; enabled?: boolean }) =>
      ipcRenderer.invoke("plugin:install", input),
    enable: (uuid: string) =>
      ipcRenderer.invoke("plugin:enable", uuid),
    disable: (uuid: string) =>
      ipcRenderer.invoke("plugin:disable", uuid),
    uninstall: (uuid: string) =>
      ipcRenderer.invoke("plugin:uninstall", uuid),
    getManifest: (uuid: string) =>
      ipcRenderer.invoke("plugin:getManifest", uuid),
  },
};

contextBridge.exposeInMainWorld("artworks", artworksApi);

export type ArtworksApi = typeof artworksApi;
