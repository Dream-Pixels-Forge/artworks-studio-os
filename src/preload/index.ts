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

  /** System dialogs — file open, etc. */
  dialog: {
    openFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) =>
      ipcRenderer.invoke("dialog:openFile", options),
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
    timeline: {
      list: (filter?: { projectUuid?: string; timelineType?: string }) =>
        ipcRenderer.invoke("production:timeline:list", filter),
      create: (input: {
        name: string; timelineType: "task" | "milestone"; projectUuid?: string;
        startDate?: string; endDate?: string; assignedTo?: string;
        priority?: string; progress?: number; dependencies?: string[];
      }) =>
        ipcRenderer.invoke("production:timeline:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:timeline:get", uuid),
      update: (uuid: string, updates: Record<string, unknown>) =>
        ipcRenderer.invoke("production:timeline:update", uuid, updates),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:timeline:delete", uuid),
      dependents: (uuid: string) =>
        ipcRenderer.invoke("production:timeline:dependents", uuid),
      stats: (projectUuid?: string) =>
        ipcRenderer.invoke("production:timeline:stats", projectUuid),
    },

    /** Collaboration — users, activity feed, comments. */
    user: {
      list: () =>
        ipcRenderer.invoke("production:user:list"),
      listActive: () =>
        ipcRenderer.invoke("production:user:listActive"),
      create: (input: { displayName: string; email?: string; avatarUrl?: string; role?: string }) =>
        ipcRenderer.invoke("production:user:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:user:get", uuid),
      update: (uuid: string, updates: Record<string, unknown>) =>
        ipcRenderer.invoke("production:user:update", uuid, updates),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:user:delete", uuid),
      stats: () =>
        ipcRenderer.invoke("production:user:stats"),
    },
    activity: {
      list: (filter?: { userUuid?: string; entityUuid?: string; entityType?: string; action?: string; since?: string }, limit?: number) =>
        ipcRenderer.invoke("production:activity:list", filter, limit),
      log: (input: { userUuid?: string; entityUuid?: string; action: string; entityType: string; details?: Record<string, unknown> }) =>
        ipcRenderer.invoke("production:activity:log", input),
      count: (filter?: { userUuid?: string; entityType?: string; action?: string }) =>
        ipcRenderer.invoke("production:activity:count", filter),
    },
    comment: {
      listByEntity: (entityUuid: string) =>
        ipcRenderer.invoke("production:comment:listByEntity", entityUuid),
      listRecent: (limit?: number) =>
        ipcRenderer.invoke("production:comment:listRecent", limit),
      create: (input: { entityUuid: string; body: string; userUuid?: string; parentUuid?: string }) =>
        ipcRenderer.invoke("production:comment:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:comment:get", uuid),
      update: (uuid: string, updates: Record<string, unknown>) =>
        ipcRenderer.invoke("production:comment:update", uuid, updates),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:comment:delete", uuid),
      countByEntity: (entityUuid: string) =>
        ipcRenderer.invoke("production:comment:countByEntity", entityUuid),
      countUnresolved: (entityUuid: string) =>
        ipcRenderer.invoke("production:comment:countUnresolved", entityUuid),
    },

    /** Studio Platform — departments, approvals, reviews. */
    department: {
      list: () =>
        ipcRenderer.invoke("production:department:list"),
      create: (input: { name: string; description?: string; leadUuid?: string }) =>
        ipcRenderer.invoke("production:department:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:department:get", uuid),
      update: (uuid: string, updates: Record<string, unknown>) =>
        ipcRenderer.invoke("production:department:update", uuid, updates),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:department:delete", uuid),
      members: (departmentUuid: string) =>
        ipcRenderer.invoke("production:department:members", departmentUuid),
      addMember: (input: { departmentUuid: string; userUuid: string; role?: "lead" | "member" }) =>
        ipcRenderer.invoke("production:department:addMember", input),
      removeMember: (departmentUuid: string, userUuid: string) =>
        ipcRenderer.invoke("production:department:removeMember", departmentUuid, userUuid),
      userDepartments: (userUuid: string) =>
        ipcRenderer.invoke("production:department:userDepartments", userUuid),
      stats: () =>
        ipcRenderer.invoke("production:department:stats"),
    },
    approval: {
      list: (filters?: { status?: string; approverUuid?: string; requesterUuid?: string }) =>
        ipcRenderer.invoke("production:approval:list", filters),
      create: (input: { entityUuid: string; requesterUuid: string; approverUuid: string; notes?: string }) =>
        ipcRenderer.invoke("production:approval:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:approval:get", uuid),
      updateStatus: (uuid: string, status: string, notes?: string) =>
        ipcRenderer.invoke("production:approval:updateStatus", uuid, status, notes),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:approval:delete", uuid),
      byEntity: (entityUuid: string) =>
        ipcRenderer.invoke("production:approval:byEntity", entityUuid),
      stats: () =>
        ipcRenderer.invoke("production:approval:stats"),
    },
    review: {
      list: (filters?: { status?: string; reviewerUuid?: string }) =>
        ipcRenderer.invoke("production:review:list", filters),
      create: (input: { entityUuid: string; reviewerUuid: string }) =>
        ipcRenderer.invoke("production:review:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:review:get", uuid),
      update: (uuid: string, updates: Record<string, unknown>) =>
        ipcRenderer.invoke("production:review:update", uuid, updates),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:review:delete", uuid),
      byEntity: (entityUuid: string) =>
        ipcRenderer.invoke("production:review:byEntity", entityUuid),
      stats: () =>
        ipcRenderer.invoke("production:review:stats"),
    },

    /** AI Production Teams — agents, tasks, messages. */
    agent: {
      list: () =>
        ipcRenderer.invoke("production:agent:list"),
      create: (input: { name: string; role: string; systemPrompt?: string; model?: string; avatar?: string }) =>
        ipcRenderer.invoke("production:agent:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:agent:get", uuid),
      getByRole: (role: string) =>
        ipcRenderer.invoke("production:agent:getByRole", role),
      update: (uuid: string, input: { name?: string; role?: string; systemPrompt?: string; model?: string; avatar?: string }) =>
        ipcRenderer.invoke("production:agent:update", uuid, input),
      updateStatus: (uuid: string, status: "idle" | "busy" | "paused" | "offline") =>
        ipcRenderer.invoke("production:agent:updateStatus", uuid, status),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:agent:delete", uuid),
      stats: () =>
        ipcRenderer.invoke("production:agent:stats"),
    },
    agentTask: {
      list: (filters?: { status?: string; agentId?: string }) =>
        ipcRenderer.invoke("production:agentTask:list", filters),
      create: (input: { agentId: string; title: string; description?: string; priority?: string; input?: Record<string, unknown>; dueDate?: string }) =>
        ipcRenderer.invoke("production:agentTask:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:agentTask:get", uuid),
      update: (uuid: string, input: { title?: string; description?: string; priority?: string; input?: Record<string, unknown>; dueDate?: string }) =>
        ipcRenderer.invoke("production:agentTask:update", uuid, input),
      start: (uuid: string) =>
        ipcRenderer.invoke("production:agentTask:start", uuid),
      complete: (uuid: string, output: Record<string, unknown>) =>
        ipcRenderer.invoke("production:agentTask:complete", uuid, output),
      fail: (uuid: string, reason: string) =>
        ipcRenderer.invoke("production:agentTask:fail", uuid, reason),
      cancel: (uuid: string) =>
        ipcRenderer.invoke("production:agentTask:cancel", uuid),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:agentTask:delete", uuid),
      stats: () =>
        ipcRenderer.invoke("production:agentTask:stats"),
    },
    agentMessage: {
      list: (filters?: { agentId?: string; taskId?: string; limit?: number }) =>
        ipcRenderer.invoke("production:agentMessage:list", filters),
      create: (input: { agentId: string; taskId?: string; role: string; content: string; tokensUsed?: number; model?: string }) =>
        ipcRenderer.invoke("production:agentMessage:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:agentMessage:get", uuid),
      deleteByAgent: (agentId: string) =>
        ipcRenderer.invoke("production:agentMessage:deleteByAgent", agentId),
      deleteByTask: (taskId: string) =>
        ipcRenderer.invoke("production:agentMessage:deleteByTask", taskId),
      stats: (agentId: string) =>
        ipcRenderer.invoke("production:agentMessage:stats", agentId),
    },
  },

  /** Plugin management — install, enable/disable, uninstall, execute commands. */
  plugin: {
    list: () =>
      ipcRenderer.invoke("plugin:list"),
    get: (uuid: string) =>
      ipcRenderer.invoke("plugin:get", uuid),
    install: (input: { manifest: unknown; enabled?: boolean }) =>
      ipcRenderer.invoke("plugin:install", input),
    installFromFile: (filePath: string) =>
      ipcRenderer.invoke("plugin:installFromFile", filePath),
    enable: (uuid: string) =>
      ipcRenderer.invoke("plugin:enable", uuid),
    disable: (uuid: string) =>
      ipcRenderer.invoke("plugin:disable", uuid),
    uninstall: (uuid: string) =>
      ipcRenderer.invoke("plugin:uninstall", uuid),
    getManifest: (uuid: string) =>
      ipcRenderer.invoke("plugin:getManifest", uuid),
    executeCommand: (pluginId: string, commandId: string) =>
      ipcRenderer.invoke("plugin:executeCommand", pluginId, commandId),
  },
};

contextBridge.exposeInMainWorld("artworks", artworksApi);

export type ArtworksApi = typeof artworksApi;
