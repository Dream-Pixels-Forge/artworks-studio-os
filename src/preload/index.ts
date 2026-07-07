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
    /**
     * Pop a panel out into its own window. Resolves once main has opened the
     * secondary BrowserWindow. Channel mirrors WINDOW_CHANNELS.detachPanel.
     */
    detachPanel: (panelId: string, title: string): Promise<{ windowId: number }> =>
      ipcRenderer.invoke("window:detach-panel", { panelId, title }),
    /**
     * Subscribe to "a detached panel's window closed" events so the main
     * window can re-dock the panel. Returns an unsubscribe. Mirrors
     * WINDOW_EVENTS.detachedClosed.
     */
    onDetachedPanelClosed: (cb: (panelId: string) => void): (() => void) => {
      const listener = (_event: unknown, panelId: string): void => cb(panelId);
      ipcRenderer.on("window:detached-closed", listener);
      return () => ipcRenderer.off("window:detached-closed", listener);
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
      all: () =>
        ipcRenderer.invoke("production:graph:all"),
      neighbors: (uuid: string) =>
        ipcRenderer.invoke("production:graph:neighbors", uuid),
      "shortest-path": (from: string, to: string) =>
        ipcRenderer.invoke("production:graph:shortest-path", from, to),
      subgraph: (uuid: string, maxHops?: number) =>
        ipcRenderer.invoke("production:graph:subgraph", uuid, maxHops),
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

    /** Node Workflows — visual production workflows with React Flow canvas. */
    nodeWorkflow: {
      list: () =>
        ipcRenderer.invoke("production:nodeWorkflow:list"),
      create: (input: { name: string; description?: string; nodes?: string; edges?: string; viewport?: string }) =>
        ipcRenderer.invoke("production:nodeWorkflow:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("production:nodeWorkflow:get", uuid),
      update: (uuid: string, input: { name?: string; description?: string; status?: string; nodes?: string; edges?: string; viewport?: string }) =>
        ipcRenderer.invoke("production:nodeWorkflow:update", uuid, input),
      updateGraph: (uuid: string, nodes: string, edges: string, viewport?: string) =>
        ipcRenderer.invoke("production:nodeWorkflow:updateGraph", uuid, nodes, edges, viewport),
      delete: (uuid: string) =>
        ipcRenderer.invoke("production:nodeWorkflow:delete", uuid),
      listByStatus: (status: "draft" | "active" | "archived") =>
        ipcRenderer.invoke("production:nodeWorkflow:listByStatus", status),
      stats: () =>
        ipcRenderer.invoke("production:nodeWorkflow:stats"),
    },
  },

  /** Production Intelligence — cross-cutting analytics dashboard. */
  intelligence: {
    health: () =>
      ipcRenderer.invoke("intelligence:health"),
    activity: (since?: string) =>
      ipcRenderer.invoke("intelligence:activity", since),
    timeline: (projectUuid?: string) =>
      ipcRenderer.invoke("intelligence:timeline", projectUuid),
    entities: () =>
      ipcRenderer.invoke("intelligence:entities"),
    "ai-usage": () =>
      ipcRenderer.invoke("intelligence:ai-usage"),
    team: () =>
      ipcRenderer.invoke("intelligence:team"),
    summary: () =>
      ipcRenderer.invoke("intelligence:summary"),
  },

  /** Production Lifecycle — state machine with transition guards and audit trail. */
  lifecycle: {
    get: (entityUuid: string) =>
      ipcRenderer.invoke("lifecycle:get", entityUuid),
    list: (filter?: { state?: string }) =>
      ipcRenderer.invoke("lifecycle:list", filter),
    create: (entityUuid: string, enteredBy?: string) =>
      ipcRenderer.invoke("lifecycle:create", entityUuid, enteredBy),
    transition: (entityUuid: string, toState: string, triggeredBy?: string, reason?: string) =>
      ipcRenderer.invoke("lifecycle:transition", entityUuid, toState, triggeredBy, reason),
    "can-transition": (from: string, to: string) =>
      ipcRenderer.invoke("lifecycle:can-transition", from, to),
    "valid-transitions": (from: string) =>
      ipcRenderer.invoke("lifecycle:valid-transitions", from),
    history: (entityUuid: string, limit?: number) =>
      ipcRenderer.invoke("lifecycle:history", entityUuid, limit),
    "all-transitions": (limit?: number) =>
      ipcRenderer.invoke("lifecycle:all-transitions", limit),
    stats: () =>
      ipcRenderer.invoke("lifecycle:stats"),
    delete: (entityUuid: string) =>
      ipcRenderer.invoke("lifecycle:delete", entityUuid),
  },

  /** Plugin management — install, enable/disable, uninstall, execute commands. */
  notification: {
    create: (input: {
      type: string; title: string; message: string;
      source?: string; source_uuid?: string; actor_uuid?: string;
      action_url?: string; metadata?: Record<string, unknown>;
    }) => ipcRenderer.invoke("notification:create", input),
    list: (filter?: { type?: string; source?: string; read?: boolean; dismissed?: boolean; since?: string; limit?: number }) =>
      ipcRenderer.invoke("notification:list", filter),
    get: (uuid: string) =>
      ipcRenderer.invoke("notification:get", uuid),
    "mark-read": (uuid: string) =>
      ipcRenderer.invoke("notification:mark-read", uuid),
    "mark-all-read": () =>
      ipcRenderer.invoke("notification:mark-all-read"),
    dismiss: (uuid: string) =>
      ipcRenderer.invoke("notification:dismiss", uuid),
    "dismiss-all": () =>
      ipcRenderer.invoke("notification:dismiss-all"),
    "unread-count": () =>
      ipcRenderer.invoke("notification:unread-count"),
    stats: () =>
      ipcRenderer.invoke("notification:stats"),
    delete: (uuid: string) =>
      ipcRenderer.invoke("notification:delete", uuid),
  },

  /** Collaboration — CRDT-based concurrent editing + presence tracking. */
  collab: {
    getDocumentContent: (documentId: string) =>
      ipcRenderer.invoke("collab:getDocumentContent", documentId),
    getDocumentMetadata: (documentId: string) =>
      ipcRenderer.invoke("collab:getDocumentMetadata", documentId),
    getStateVector: (documentId: string) =>
      ipcRenderer.invoke("collab:getStateVector", documentId),
    applyUpdate: (documentId: string, updateBase64: string) =>
      ipcRenderer.invoke("collab:applyUpdate", documentId, updateBase64),
    getVersionClock: (documentId: string) =>
      ipcRenderer.invoke("collab:getVersionClock", documentId),
    flush: () =>
      ipcRenderer.invoke("collab:flush"),
    destroyDoc: (documentId: string) =>
      ipcRenderer.invoke("collab:destroyDoc", documentId),
    updatePresence: (
      userUuid: string,
      userName: string,
      documentId: string,
      cursor?: { index: number; length: number },
      selection?: { anchor: number; head: number },
    ) =>
      ipcRenderer.invoke("collab:updatePresence", userUuid, userName, documentId, cursor, selection),
    removePresence: (userUuid: string, documentId: string) =>
      ipcRenderer.invoke("collab:removePresence", userUuid, documentId),
    getDocumentPresence: (documentId: string) =>
      ipcRenderer.invoke("collab:getDocumentPresence", documentId),
    getActiveDocuments: () =>
      ipcRenderer.invoke("collab:getActiveDocuments"),
    removeUser: (userUuid: string) =>
      ipcRenderer.invoke("collab:removeUser", userUuid),
  },

  /** Backup & Recovery — database backup/restore, production export/import, crash recovery. */
  backup: {
    create: (type?: string, label?: string) =>
      ipcRenderer.invoke("backup:create", type, label),
    list: () =>
      ipcRenderer.invoke("backup:list"),
    restore: (backupPath: string) =>
      ipcRenderer.invoke("backup:restore", backupPath),
    delete: (uuid: string) =>
      ipcRenderer.invoke("backup:delete", uuid),
    "export-production": (entityUuid: string) =>
      ipcRenderer.invoke("backup:export-production", entityUuid),
    "import-production": (data: { entities: Array<Record<string, unknown>>; graphs?: Array<Record<string, unknown>> }) =>
      ipcRenderer.invoke("backup:import-production", data),
    "recover-latest": () =>
      ipcRenderer.invoke("backup:recover-latest"),
    stats: () =>
      ipcRenderer.invoke("backup:stats"),
  },

  /** Production Export — export production data as Markdown or JSON. */
  "export": {
    production: (options: {
      format: "json" | "markdown";
      includeGraph?: boolean;
      includeTimeline?: boolean;
      includeComments?: boolean;
      entityTypes?: string[];
    }) => ipcRenderer.invoke("export:production", options),
  },

  /** API key management — store/retrieve/delete AI provider keys. */
  "api-keys": {
    get: () =>
      ipcRenderer.invoke("api-keys:get"),
    set: (provider: string, apiKey: string) =>
      ipcRenderer.invoke("api-keys:set", provider, apiKey),
    delete: (provider: string) =>
      ipcRenderer.invoke("api-keys:delete", provider),
  },

  /** Keyboard shortcuts — get/set/reset custom shortcuts. */
  shortcuts: {
    get: () =>
      ipcRenderer.invoke("shortcuts:get"),
    set: (actionId: string, accelerator: string) =>
      ipcRenderer.invoke("shortcuts:set", actionId, accelerator),
    "reset-action": (actionId: string) =>
      ipcRenderer.invoke("shortcuts:reset-action", actionId),
    "reset-all": () =>
      ipcRenderer.invoke("shortcuts:reset-all"),
  },

  /** AI Gateway — model listing and completions. */
  ai: {
    listModels: () =>
      ipcRenderer.invoke("ai:listModels"),
    complete: (messages: Array<{ role: string; content: string }>, options?: { model?: string; provider?: string; temperature?: number; maxTokens?: number }) =>
      ipcRenderer.invoke("ai:complete", messages, options),
    stream: (
      messages: Array<{ role: string; content: string }>,
      options?: { model?: string; provider?: string; temperature?: number; maxTokens?: number },
    ): {
      subscribe: (onChunk: (chunk: { type: string; text?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; error?: string }) => void) => () => void;
      /** Abort the in-flight stream on the main process (stops the fetch + token burn). */
      cancel: () => Promise<boolean>;
    } => {
      const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      // Start the stream on the main process
      ipcRenderer.invoke("ai:stream", streamId, messages, options);
      return {
        subscribe: (onChunk) => {
          const listener = (_event: unknown, id: string, chunk: { type: string; text?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; error?: string }) => {
            if (id === streamId) onChunk(chunk);
          };
          ipcRenderer.on("ai:stream:chunk", listener);
          return () => ipcRenderer.off("ai:stream:chunk", listener);
        },
        cancel: () => ipcRenderer.invoke("ai:cancel", streamId) as Promise<boolean>,
      };
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

  /** Marketplace — browse, install, rate, and publish listings. */
  marketplace: {
    list: (filter?: Record<string, unknown>) =>
      ipcRenderer.invoke("marketplace:list", filter),
    featured: (limit?: number) =>
      ipcRenderer.invoke("marketplace:featured", limit),
    recent: (limit?: number) =>
      ipcRenderer.invoke("marketplace:recent", limit),
    search: (query: string, limit?: number) =>
      ipcRenderer.invoke("marketplace:search", query, limit),
    popular: (limit?: number) =>
      ipcRenderer.invoke("marketplace:popular", limit),
    topRated: (limit?: number) =>
      ipcRenderer.invoke("marketplace:top-rated", limit),
    getByUuid: (uuid: string) =>
      ipcRenderer.invoke("marketplace:getByUuid", uuid),
    getBySlug: (slug: string) =>
      ipcRenderer.invoke("marketplace:getBySlug", slug),
    publish: (input: Record<string, unknown>) =>
      ipcRenderer.invoke("marketplace:publish", input),
    install: (uuid: string, version: string) =>
      ipcRenderer.invoke("marketplace:install", uuid, version),
    uninstall: (uuid: string) =>
      ipcRenderer.invoke("marketplace:uninstall", uuid),
    rate: (uuid: string, input: { rating: number }) =>
      ipcRenderer.invoke("marketplace:rate", uuid, input),
    delete: (uuid: string) =>
      ipcRenderer.invoke("marketplace:delete", uuid),
    stats: () =>
      ipcRenderer.invoke("marketplace:stats"),
  },

  /** Enterprise — teams, roles, permissions, audit log, licenses. */
  enterprise: {
    team: {
      list: () =>
        ipcRenderer.invoke("enterprise:team:list"),
      create: (input: { name: string; slug: string; description?: string }) =>
        ipcRenderer.invoke("enterprise:team:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("enterprise:team:get", uuid),
      update: (uuid: string, input: { name?: string; slug?: string; description?: string }) =>
        ipcRenderer.invoke("enterprise:team:update", uuid, input),
      delete: (uuid: string) =>
        ipcRenderer.invoke("enterprise:team:delete", uuid),
      addMember: (input: { teamUuid: string; userUuid: string; role?: string }) =>
        ipcRenderer.invoke("enterprise:team:addMember", input),
      removeMember: (teamUuid: string, userUuid: string) =>
        ipcRenderer.invoke("enterprise:team:removeMember", teamUuid, userUuid),
      updateMemberRole: (input: { teamUuid: string; userUuid: string; role: string }) =>
        ipcRenderer.invoke("enterprise:team:updateMemberRole", input),
      userTeams: (userUuid: string) =>
        ipcRenderer.invoke("enterprise:team:userTeams", userUuid),
      stats: () =>
        ipcRenderer.invoke("enterprise:team:stats"),
    },
    role: {
      list: () =>
        ipcRenderer.invoke("enterprise:role:list"),
      create: (input: { name: string; description?: string; isSystem?: boolean }) =>
        ipcRenderer.invoke("enterprise:role:create", input),
      get: (uuid: string) =>
        ipcRenderer.invoke("enterprise:role:get", uuid),
      update: (uuid: string, input: { name?: string; description?: string }) =>
        ipcRenderer.invoke("enterprise:role:update", uuid, input),
      delete: (uuid: string) =>
        ipcRenderer.invoke("enterprise:role:delete", uuid),
      assignPermission: (roleUuid: string, permissionUuid: string) =>
        ipcRenderer.invoke("enterprise:role:assignPermission", roleUuid, permissionUuid),
      revokePermission: (roleUuid: string, permissionUuid: string) =>
        ipcRenderer.invoke("enterprise:role:revokePermission", roleUuid, permissionUuid),
      assignToUser: (input: { userUuid: string; roleUuid: string }) =>
        ipcRenderer.invoke("enterprise:role:assignToUser", input),
      revokeFromUser: (input: { userUuid: string; roleUuid: string }) =>
        ipcRenderer.invoke("enterprise:role:revokeFromUser", input),
      userRoles: (userUuid: string) =>
        ipcRenderer.invoke("enterprise:role:userRoles", userUuid),
      userHasPermission: (input: { userUuid: string; permission: string }) =>
        ipcRenderer.invoke("enterprise:role:userHasPermission", input),
      stats: () =>
        ipcRenderer.invoke("enterprise:role:stats"),
    },
    permission: {
      list: () =>
        ipcRenderer.invoke("enterprise:permission:list"),
      create: (input: { name: string; resource: string; action: string; description?: string }) =>
        ipcRenderer.invoke("enterprise:permission:create", input),
      delete: (uuid: string) =>
        ipcRenderer.invoke("enterprise:permission:delete", uuid),
    },
    audit: {
      list: (filter?: { user_uuid?: string; action?: string; resource_type?: string; since?: string; until?: string; limit?: number; offset?: number }) =>
        ipcRenderer.invoke("enterprise:audit:list", filter),
      log: (input: { user_uuid?: string; action: string; resource_type: string; resource_uuid?: string; details?: Record<string, unknown> }) =>
        ipcRenderer.invoke("enterprise:audit:log", input),
      count: (filter?: { user_uuid?: string; action?: string; resource_type?: string }) =>
        ipcRenderer.invoke("enterprise:audit:count", filter),
      stats: () =>
        ipcRenderer.invoke("enterprise:audit:stats"),
    },
    license: {
      list: () =>
        ipcRenderer.invoke("enterprise:license:list"),
      get: (uuid: string) =>
        ipcRenderer.invoke("enterprise:license:get", uuid),
      getActive: () =>
        ipcRenderer.invoke("enterprise:license:getActive"),
      create: (input: { key: string; type?: string; holder_name?: string; holder_email?: string; features?: string[]; max_users?: number; max_projects?: number; expires_at?: string | null }) =>
        ipcRenderer.invoke("enterprise:license:create", input),
      update: (uuid: string, input: Record<string, unknown>) =>
        ipcRenderer.invoke("enterprise:license:update", uuid, input),
      delete: (uuid: string) =>
        ipcRenderer.invoke("enterprise:license:delete", uuid),
      hasFeature: (input: { uuid: string; feature: string }) =>
        ipcRenderer.invoke("enterprise:license:hasFeature", input),
      stats: () =>
        ipcRenderer.invoke("enterprise:license:stats"),
    },
  },
};

contextBridge.exposeInMainWorld("artworks", artworksApi);

export type ArtworksApi = typeof artworksApi;
