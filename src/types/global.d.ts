/** Type declaration for the preload-exposed window.artworks bridge. */

type ThemeMode = "studio-dark" | "studio-light" | "system";
type ResolvedTheme = "studio-dark" | "studio-light";
type MenuAction = "new-production" | "open-production";
type PreferenceKey = "default-production";

interface ArtworksApi {
  version: string;
  product: string;
  tagline: string;

  studio: {
    status: () => Promise<{ initialized: boolean; home: string }>;
  };

  theme: {
    get: () => Promise<{ mode: ThemeMode; resolvedTheme: ResolvedTheme }>;
    set: (mode: ThemeMode) => Promise<{ mode: ThemeMode; resolvedTheme: ResolvedTheme }>;
    onNativeUpdated: (cb: (resolved: ResolvedTheme) => void) => () => void;
  };

  explorer: {
    listProductions: () => Promise<unknown>;
    getActive: () => Promise<unknown>;
    open: (name: string) => Promise<unknown>;
    tree: (name: string) => Promise<unknown>;
    expand: (path: string) => Promise<unknown>;
    manifest: (name: string) => Promise<unknown>;
  };

  window: {
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
    onMaximizedChanged: (cb: (isMaximized: boolean) => void) => () => void;
  };

  dialog: {
    openFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<unknown>;
  };

  menu: {
    onAction: (cb: (action: MenuAction) => void) => () => void;
  };

  settings: {
    get: () => Promise<{ preferences: Partial<Record<PreferenceKey, string>> }>;
    set: (key: PreferenceKey, value: string | undefined) => Promise<{ preferences: Partial<Record<PreferenceKey, string>> }>;
    reset: () => Promise<{ preferences: Partial<Record<PreferenceKey, string>> }>;
  };

  production: {
    project: {
      list: () => Promise<unknown>;
      create: (input: { name: string; description?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (project: unknown) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
    };
    asset: {
      list: (filter?: { type?: "image" | "video" | "audio" | "document" }) => Promise<unknown>;
      create: (input: { name: string; assetType: string; path: string; mimeType: string; sizeBytes?: number }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
    };
    document: {
      list: (projectUuid?: string) => Promise<unknown>;
      create: (input: { name: string; docType: string; content?: string; projectUuid?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (doc: unknown) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
    };
    search: (query: string) => Promise<unknown>;
    stats: () => Promise<unknown>;
    graph: {
      connect: (source: string, target: string, type: string) => Promise<unknown>;
      relationships: (from: string) => Promise<unknown>;
      disconnect: (source: string, target: string, type: string) => Promise<unknown>;
    };
    version: {
      list: (entityUuid: string) => Promise<unknown>;
      get: (entityUuid: string, version: number) => Promise<unknown>;
    };
    entity: {
      get: (uuid: string) => Promise<unknown>;
      listByType: (type: string) => Promise<unknown>;
      tag: (uuid: string, tag: string) => Promise<unknown>;
      untag: (uuid: string, tag: string) => Promise<unknown>;
      patchStatus: (uuid: string, status: string) => Promise<unknown>;
    };
    conversation: {
      list: () => Promise<unknown>;
      create: (input: { name: string; projectUuid?: string; provider?: string; model?: string; messages?: { role: string; content: string }[] }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      addMessage: (uuid: string, msg: { role: string; content: string }) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
    };
    prompt: {
      list: () => Promise<unknown>;
      create: (input: { name: string; projectUuid?: string; provider?: string; model?: string; template: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (prompt: unknown) => Promise<unknown>;
      render: (template: string, vars: Record<string, string>) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
    };
    workflow: {
      list: () => Promise<unknown>;
      create: (input: { name: string; projectUuid?: string; definition?: { steps: unknown[] } }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      updateState: (uuid: string, state: string) => Promise<unknown>;
      updateDefinition: (uuid: string, definition: unknown) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
    };
    timeline: {
      list: (filter?: { projectUuid?: string; timelineType?: string }) => Promise<unknown>;
      create: (input: { name: string; timelineType: "task" | "milestone"; projectUuid?: string; startDate?: string; endDate?: string; assignedTo?: string; priority?: string; progress?: number; dependencies?: string[] }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, updates: Record<string, unknown>) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      dependents: (uuid: string) => Promise<unknown>;
      stats: (projectUuid?: string) => Promise<unknown>;
    };

    user: {
      list: () => Promise<unknown>;
      listActive: () => Promise<unknown>;
      create: (input: { displayName: string; email?: string; avatarUrl?: string; role?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, updates: Record<string, unknown>) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    activity: {
      list: (filter?: { userUuid?: string; entityUuid?: string; entityType?: string; action?: string; since?: string }, limit?: number) => Promise<unknown>;
      log: (input: { userUuid?: string; entityUuid?: string; action: string; entityType: string; details?: Record<string, unknown> }) => Promise<unknown>;
      count: (filter?: { userUuid?: string; entityType?: string; action?: string }) => Promise<unknown>;
    };
    comment: {
      listByEntity: (entityUuid: string) => Promise<unknown>;
      listRecent: (limit?: number) => Promise<unknown>;
      create: (input: { entityUuid: string; body: string; userUuid?: string; parentUuid?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, updates: Record<string, unknown>) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      countByEntity: (entityUuid: string) => Promise<unknown>;
      countUnresolved: (entityUuid: string) => Promise<unknown>;
    };
  };

  plugin: {
    list: () => Promise<unknown>;
    get: (uuid: string) => Promise<unknown>;
    install: (input: { manifest: unknown; enabled?: boolean }) => Promise<unknown>;
    installFromFile: (filePath: string) => Promise<unknown>;
    enable: (uuid: string) => Promise<unknown>;
    disable: (uuid: string) => Promise<unknown>;
    uninstall: (uuid: string) => Promise<unknown>;
    getManifest: (uuid: string) => Promise<unknown>;
    executeCommand: (pluginId: string, commandId: string) => Promise<unknown>;
  };
}

declare global {
  interface Window {
    artworks: ArtworksApi;
  }
}

export {};
