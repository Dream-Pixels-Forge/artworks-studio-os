/**
 * Services: IPC handlers + business services (AI gateway, CRDT
 * collaboration, settings, theme, backup/recovery, production lifecycle,
 * notifications, plugin/marketplace/enterprise CRUD). Cross-cutting
 * infrastructure used by every production module.
 *
 * Each `*-ipc.ts` module exports a `register*Ipc(...)` wired in
 * `src/main/index.ts` during `app.whenReady()`.
 */
export {};
