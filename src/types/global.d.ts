/** Type declaration for the preload-exposed window.artworks bridge. */

type ThemeMode = "studio-dark" | "studio-light" | "system";
type ResolvedTheme = "studio-dark" | "studio-light";
type MenuAction =
  | "new-production"
  | "open-production"
  | "command-palette"
  | "toggle-theme"
  | "save"
  | "new-entity"
  | "search"
  | "open-settings"
  | "toggle-sidebar"
  | "toggle-terminal";
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
    /** Pop a panel out into its own BrowserWindow. */
    detachPanel: (panelId: string, title: string) => Promise<{ windowId: number }>;
    /** Subscribe to "a detached panel's window closed" events (for re-docking). */
    onDetachedPanelClosed: (cb: (panelId: string) => void) => () => void;
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
      all: () => Promise<{ entities: Array<{ uuid: string; name: string; type: string; status: string }>; relationships: Array<{ source: string; target: string; type: string }> }>;
      neighbors: (uuid: string) => Promise<Array<{ source: string; target: string; type: string }>>;
      "shortest-path": (from: string, to: string) => Promise<string[] | null>;
      subgraph: (uuid: string, maxHops?: number) => Promise<{ entities: Array<{ uuid: string; name: string; type: string; status: string }>; relationships: Array<{ source: string; target: string; type: string }> }>;
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

    department: {
      list: () => Promise<unknown>;
      create: (input: { name: string; description?: string; leadUuid?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, updates: Record<string, unknown>) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      members: (departmentUuid: string) => Promise<unknown>;
      addMember: (input: { departmentUuid: string; userUuid: string; role?: string }) => Promise<unknown>;
      removeMember: (departmentUuid: string, userUuid: string) => Promise<unknown>;
      userDepartments: (userUuid: string) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    approval: {
      list: (filters?: { status?: string; approverUuid?: string; requesterUuid?: string }) => Promise<unknown>;
      create: (input: { entityUuid: string; requesterUuid: string; approverUuid: string; notes?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      updateStatus: (uuid: string, status: string, notes?: string) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      byEntity: (entityUuid: string) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    review: {
      list: (filters?: { status?: string; reviewerUuid?: string }) => Promise<unknown>;
      create: (input: { entityUuid: string; reviewerUuid: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, updates: Record<string, unknown>) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      byEntity: (entityUuid: string) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };

    agent: {
      list: () => Promise<unknown>;
      create: (input: { name: string; role: string; systemPrompt?: string; model?: string; avatar?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      getByRole: (role: string) => Promise<unknown>;
      update: (uuid: string, input: { name?: string; role?: string; systemPrompt?: string; model?: string; avatar?: string }) => Promise<unknown>;
      updateStatus: (uuid: string, status: "idle" | "busy" | "paused" | "offline") => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    agentTask: {
      list: (filters?: { status?: string; agentId?: string }) => Promise<unknown>;
      create: (input: { agentId: string; title: string; description?: string; priority?: string; input?: Record<string, unknown>; dueDate?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, input: { title?: string; description?: string; priority?: string; input?: Record<string, unknown>; dueDate?: string }) => Promise<unknown>;
      start: (uuid: string) => Promise<unknown>;
      complete: (uuid: string, output: Record<string, unknown>) => Promise<unknown>;
      fail: (uuid: string, reason: string) => Promise<unknown>;
      cancel: (uuid: string) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    agentMessage: {
      list: (filters?: { agentId?: string; taskId?: string; limit?: number }) => Promise<unknown>;
      create: (input: { agentId: string; taskId?: string; role: string; content: string; tokensUsed?: number; model?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      deleteByAgent: (agentId: string) => Promise<unknown>;
      deleteByTask: (taskId: string) => Promise<unknown>;
      stats: (agentId: string) => Promise<unknown>;
    };

    nodeWorkflow: {
      list: () => Promise<unknown>;
      create: (input: { name: string; description?: string; nodes?: string; edges?: string; viewport?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, input: { name?: string; description?: string; status?: string; nodes?: string; edges?: string; viewport?: string }) => Promise<unknown>;
      updateGraph: (uuid: string, nodes: string, edges: string, viewport?: string) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      listByStatus: (status: "draft" | "active" | "archived") => Promise<unknown>;
      stats: () => Promise<unknown>;
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

  marketplace: {
    list: (filter?: Record<string, unknown>) => Promise<unknown>;
    featured: (limit?: number) => Promise<unknown>;
    recent: (limit?: number) => Promise<unknown>;
    search: (query: string, limit?: number) => Promise<unknown>;
    popular: (limit?: number) => Promise<unknown>;
    topRated: (limit?: number) => Promise<unknown>;
    getByUuid: (uuid: string) => Promise<unknown>;
    getBySlug: (slug: string) => Promise<unknown>;
    publish: (input: Record<string, unknown>) => Promise<unknown>;
    install: (uuid: string, version: string) => Promise<unknown>;
    uninstall: (uuid: string) => Promise<unknown>;
    rate: (uuid: string, input: { rating: number }) => Promise<unknown>;
    delete: (uuid: string) => Promise<unknown>;
    stats: () => Promise<unknown>;
  };

  intelligence: {
    health: () => Promise<unknown>;
    activity: (since?: string) => Promise<unknown>;
    timeline: (projectUuid?: string) => Promise<unknown>;
    entities: () => Promise<unknown>;
    "ai-usage": () => Promise<unknown>;
    team: () => Promise<unknown>;
    summary: () => Promise<unknown>;
  };

  lifecycle: {
    get: (entityUuid: string) => Promise<unknown>;
    list: (filter?: { state?: string }) => Promise<unknown>;
    create: (entityUuid: string, enteredBy?: string) => Promise<unknown>;
    transition: (entityUuid: string, toState: string, triggeredBy?: string, reason?: string) => Promise<unknown>;
    "can-transition": (from: string, to: string) => Promise<unknown>;
    "valid-transitions": (from: string) => Promise<unknown>;
    history: (entityUuid: string, limit?: number) => Promise<unknown>;
    "all-transitions": (limit?: number) => Promise<unknown>;
    stats: () => Promise<unknown>;
    delete: (entityUuid: string) => Promise<unknown>;
  };

  notification: {
    create: (input: {
      type: string; title: string; message: string;
      source?: string; source_uuid?: string; actor_uuid?: string;
      action_url?: string; metadata?: Record<string, unknown>;
    }) => Promise<unknown>;
    list: (filter?: { type?: string; source?: string; read?: boolean; dismissed?: boolean; since?: string; limit?: number }) => Promise<unknown>;
    get: (uuid: string) => Promise<unknown>;
    "mark-read": (uuid: string) => Promise<unknown>;
    "mark-all-read": () => Promise<unknown>;
    dismiss: (uuid: string) => Promise<unknown>;
    "dismiss-all": () => Promise<unknown>;
    "unread-count": () => Promise<unknown>;
    stats: () => Promise<unknown>;
    delete: (uuid: string) => Promise<unknown>;
  };

  backup: {
    create: (type?: string, label?: string) => Promise<unknown>;
    list: () => Promise<unknown>;
    restore: (backupPath: string) => Promise<unknown>;
    delete: (uuid: string) => Promise<unknown>;
    "export-production": (entityUuid: string) => Promise<unknown>;
    "import-production": (data: { entities: Array<Record<string, unknown>>; graphs?: Array<Record<string, unknown>> }) => Promise<unknown>;
    "recover-latest": () => Promise<unknown>;
    stats: () => Promise<unknown>;
  };

  "export": {
    production: (options: {
      format: "json" | "markdown";
      includeGraph?: boolean;
      includeTimeline?: boolean;
      includeComments?: boolean;
      entityTypes?: string[];
    }) => Promise<{ content: string; filename: string; mimeType: string; entityCount: number }>;
  };

  "api-keys": {
    get: () => Promise<{ keys: Record<string, string> }>;
    set: (provider: string, apiKey: string) => Promise<{ keys: Record<string, string> }>;
    delete: (provider: string) => Promise<{ keys: Record<string, string> }>;
  };

  shortcuts: {
    get: () => Promise<{ shortcuts: Record<string, string>; defaults: Record<string, string> }>;
    set: (actionId: string, accelerator: string) => Promise<{ shortcuts: Record<string, string>; defaults: Record<string, string> }>;
    "reset-action": (actionId: string) => Promise<{ shortcuts: Record<string, string>; defaults: Record<string, string> }>;
    "reset-all": () => Promise<{ shortcuts: Record<string, string>; defaults: Record<string, string> }>;
  };

  ai: {
    listModels: () => Promise<Array<{ id: string; provider: string; displayName: string; maxTokens: number; supportsStreaming: boolean; supportsImages: boolean; costPer1kInput: number; costPer1kOutput: number }>>;
    complete: (messages: Array<{ role: string; content: string }>, options?: { model?: string; provider?: string; temperature?: number; maxTokens?: number }) => Promise<{ content: string; model: string; provider: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }>;
    stream: (
      messages: Array<{ role: string; content: string }>,
      options?: { model?: string; provider?: string; temperature?: number; maxTokens?: number },
    ) => {
      subscribe: (onChunk: (chunk: { type: string; text?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; error?: string }) => void) => () => void;
      /** Abort the in-flight stream on the main process (stops the fetch + token burn). */
      cancel: () => Promise<boolean>;
    };
  };

  collab: {
    getDocumentContent: (documentId: string) => Promise<string>;
    getDocumentMetadata: (documentId: string) => Promise<Record<string, unknown>>;
    getStateVector: (documentId: string) => Promise<string>;
    applyUpdate: (documentId: string, updateBase64: string) => Promise<boolean>;
    getVersionClock: (documentId: string) => Promise<number>;
    flush: () => Promise<void>;
    destroyDoc: (documentId: string) => Promise<void>;
    updatePresence: (
      userUuid: string,
      userName: string,
      documentId: string,
      cursor?: { index: number; length: number },
      selection?: { anchor: number; head: number },
    ) => Promise<void>;
    removePresence: (userUuid: string, documentId: string) => Promise<void>;
    getDocumentPresence: (documentId: string) => Promise<Array<{
      userUuid: string;
      userName: string;
      documentId: string;
      cursor?: { index: number; length: number };
      selection?: { anchor: number; head: number };
      lastSeen: string;
    }>>;
    getActiveDocuments: () => Promise<string[]>;
    removeUser: (userUuid: string) => Promise<void>;
  };

  enterprise: {
    team: {
      list: () => Promise<unknown>;
      create: (input: { name: string; slug: string; description?: string }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, input: { name?: string; slug?: string; description?: string }) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      addMember: (input: { teamUuid: string; userUuid: string; role?: string }) => Promise<unknown>;
      removeMember: (teamUuid: string, userUuid: string) => Promise<unknown>;
      updateMemberRole: (input: { teamUuid: string; userUuid: string; role: string }) => Promise<unknown>;
      userTeams: (userUuid: string) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    role: {
      list: () => Promise<unknown>;
      create: (input: { name: string; description?: string; isSystem?: boolean }) => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      update: (uuid: string, input: { name?: string; description?: string }) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      assignPermission: (roleUuid: string, permissionUuid: string) => Promise<unknown>;
      revokePermission: (roleUuid: string, permissionUuid: string) => Promise<unknown>;
      assignToUser: (input: { userUuid: string; roleUuid: string }) => Promise<unknown>;
      revokeFromUser: (input: { userUuid: string; roleUuid: string }) => Promise<unknown>;
      userRoles: (userUuid: string) => Promise<unknown>;
      userHasPermission: (input: { userUuid: string; permission: string }) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    permission: {
      list: () => Promise<unknown>;
      create: (input: { name: string; resource: string; action: string; description?: string }) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
    };
    audit: {
      list: (filter?: { user_uuid?: string; action?: string; resource_type?: string; since?: string; until?: string; limit?: number; offset?: number }) => Promise<unknown>;
      log: (input: { user_uuid?: string; action: string; resource_type: string; resource_uuid?: string; details?: Record<string, unknown> }) => Promise<unknown>;
      count: (filter?: { user_uuid?: string; action?: string; resource_type?: string }) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
    license: {
      list: () => Promise<unknown>;
      get: (uuid: string) => Promise<unknown>;
      getActive: () => Promise<unknown>;
      create: (input: { key: string; type?: string; holder_name?: string; holder_email?: string; features?: string[]; max_users?: number; max_projects?: number; expires_at?: string | null }) => Promise<unknown>;
      update: (uuid: string, input: Record<string, unknown>) => Promise<unknown>;
      delete: (uuid: string) => Promise<unknown>;
      hasFeature: (input: { uuid: string; feature: string }) => Promise<unknown>;
      stats: () => Promise<unknown>;
    };
  };
}

declare global {
  interface Window {
    artworks: ArtworksApi;
  }
}

export {};
