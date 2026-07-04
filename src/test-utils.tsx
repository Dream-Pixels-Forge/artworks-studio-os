import { render, type RenderOptions } from "@testing-library/react";
import { type ReactElement } from "react";

/** Mock the window.artworks bridge for renderer tests. */
export function mockArtworks(overrides?: Record<string, unknown>): void {
  (window as Record<string, unknown>).artworks = {
    version: "0.0.0-test",
    product: "Test",
    tagline: "",
    studio: { status: async () => ({ initialized: true, home: "/tmp" }) },
    theme: { get: async () => ({ mode: "studio-dark", resolvedTheme: "studio-dark" }), set: async () => ({ mode: "studio-dark", resolvedTheme: "studio-dark" }), onNativeUpdated: () => () => {} },
    window: { minimize: () => {}, toggleMaximize: () => {}, close: () => {}, isMaximized: async () => false, onMaximizedChanged: () => () => {} },
    production: {
      project: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => {} },
      asset: { list: async () => [], create: async () => ({}), get: async () => null, delete: async () => {} },
      document: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => {} },
      search: async () => [],
      stats: async () => ({ projectCount: 0, assetCount: 0, documentCount: 0, entityCount: 0, assetsByType: {} }),
      graph: { connect: async () => {}, relationships: async () => [], disconnect: async () => {}, all: async () => ({ entities: [], relationships: [] }), neighbors: async () => [], "shortest-path": async () => null, subgraph: async () => ({ entities: [], relationships: [] }) },
      entity: { get: async () => null, listByType: async () => [], tag: async () => ({}), untag: async () => ({}), patchStatus: async () => {} },
      conversation: { list: async () => [], create: async () => ({}), get: async () => null, addMessage: async () => ({}), delete: async () => {} },
      prompt: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), render: async () => "", delete: async () => {} },
      workflow: { list: async () => [], create: async () => ({}), get: async () => null, updateState: async () => ({}), updateDefinition: async () => ({}), delete: async () => {} },
      timeline: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => {}, dependents: async () => [], stats: async () => ({}) },
      user: { list: async () => [], listActive: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => {}, stats: async () => ({}) },
      activity: { list: async () => [], log: async () => ({}), count: async () => 0 },
      comment: { listByEntity: async () => [], listRecent: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => {}, countByEntity: async () => 0, countUnresolved: async () => 0 },
      department: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => {}, members: async () => [], addMember: async () => ({}), removeMember: async () => ({}), userDepartments: async () => [], stats: async () => ({}) },
      approval: { list: async () => [], create: async () => ({}), get: async () => null, updateStatus: async () => ({}), delete: async () => {}, byEntity: async () => [], stats: async () => ({}) },
      review: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => {}, byEntity: async () => [], stats: async () => ({}) },
      agent: { list: async () => [], create: async () => ({}), get: async () => null, getByRole: async () => null, update: async () => ({}), updateStatus: async () => ({}), delete: async () => {}, stats: async () => ({}) },
      agentTask: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), start: async () => ({}), complete: async () => ({}), fail: async () => ({}), cancel: async () => ({}), delete: async () => {}, stats: async () => ({}) },
      agentMessage: { list: async () => [], create: async () => ({}), get: async () => null, deleteByAgent: async () => ({}), deleteByTask: async () => ({}), stats: async () => ({}) },
      nodeWorkflow: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), updateGraph: async () => ({}), delete: async () => {}, listByStatus: async () => [], stats: async () => ({}) },
    },
    intelligence: { health: async () => ({}), activity: async () => [], timeline: async () => ({}), entities: async () => [], "ai-usage": async () => ({}), team: async () => ({}), summary: async () => ({}) },
    lifecycle: { get: async () => null, list: async () => [], create: async () => ({}), transition: async () => ({}), "can-transition": async () => true, "valid-transitions": async () => [], history: async () => [], "all-transitions": async () => [], stats: async () => ({}), delete: async () => {} },
    notification: { create: async () => ({}), list: async () => [], get: async () => null, "mark-read": async () => ({}), "mark-all-read": async () => ({}), dismiss: async () => ({}), "dismiss-all": async () => ({}), "unread-count": async () => 0, stats: async () => ({}), delete: async () => {} },
    backup: { create: async () => ({}), list: async () => [], restore: async () => ({}), delete: async () => ({}), "export-production": async () => ({}), "import-production": async () => ({}), "recover-latest": async () => ({}), stats: async () => ({}) },
    "api-keys": { get: async () => ({}), set: async () => ({}), delete: async () => ({}) },
    shortcuts: { get: async () => ({}), set: async () => ({}), "reset-action": async () => ({}), "reset-all": async () => ({}) },
    "export": { production: async () => ({ content: "", filename: "", mimeType: "", entityCount: 0 }) },
    ai: { listModels: async () => [], complete: async () => ({ content: "", model: "", provider: "", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }) },
    plugin: { list: async () => [], get: async () => null, install: async () => ({}), installFromFile: async () => ({}), enable: async () => ({}), disable: async () => ({}), uninstall: async () => ({}), getManifest: async () => null, executeCommand: async () => ({}) },
    marketplace: { list: async () => [], featured: async () => [], recent: async () => [], getByUuid: async () => null, getBySlug: async () => null, publish: async () => ({}), install: async () => ({}), uninstall: async () => ({}), rate: async () => ({}), delete: async () => ({}), stats: async () => ({}) },
    enterprise: {
      team: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => ({}), addMember: async () => ({}), removeMember: async () => ({}), updateMemberRole: async () => ({}), userTeams: async () => [], stats: async () => ({}) },
      role: { list: async () => [], create: async () => ({}), get: async () => null, update: async () => ({}), delete: async () => ({}), assignPermission: async () => ({}), revokePermission: async () => ({}), assignToUser: async () => ({}), revokeFromUser: async () => ({}), userRoles: async () => [], userHasPermission: async () => false, stats: async () => ({}) },
      permission: { list: async () => [], create: async () => ({}), delete: async () => ({}) },
      audit: { list: async () => [], log: async () => ({}), count: async () => 0, stats: async () => ({}) },
      license: { list: async () => [], get: async () => null, getActive: async () => null, create: async () => ({}), update: async () => ({}), delete: async () => ({}), hasFeature: async () => false, stats: async () => ({}) },
    },
    explorer: { listProductions: async () => [], getActive: async () => null, open: async () => ({}), tree: async () => null, expand: async () => [], manifest: async () => null },
    dialog: { openFile: async () => null },
    menu: { onAction: () => () => {} },
    settings: { get: async () => ({ preferences: {} }), set: async () => ({ preferences: {} }), reset: async () => ({ preferences: {} }) },
    ...overrides,
  } as never;
}

/** Custom render that injects the mock artworks bridge. */
export function renderWithMock(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">): ReturnType<typeof render> {
  mockArtworks();
  return render(ui, options);
}
