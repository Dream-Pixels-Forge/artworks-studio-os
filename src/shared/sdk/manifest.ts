/**
 * Plugin manifest contract.
 *
 * Every plugin declares a manifest.json describing its identity, the
 * permissions it needs, and the SDK version it targets. The runtime reads
 * the manifest before loading any plugin code, enforcing least privilege.
 *
 * Mirrors docs/plugin-sdk.md "manifest" and "permissions".
 */

/** Capabilities a plugin may request. Least-privilege: request only what you use. */
export enum Permission {
  Filesystem = "filesystem",
  Network = "network",
  AI = "ai",
  Git = "git",
  Automation = "automation",
  Database = "database",
  Media = "media",
  Notification = "notification",
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

/** A command the plugin contributes to the command palette / API. */
export interface PluginCommand {
  readonly id: string;
  readonly title: string;
  /**
   * Event types this command responds to. Declarative metadata for
   * discovery and the future marketplace — the plugin is still
   * responsible for subscribing in its own activate() function.
   */
  readonly listensTo?: readonly string[];
}

/** Plugin lifecycle hooks. All optional; the runtime calls what's present. */
export interface PluginLifecycle {
  onActivate?(): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;
}

/** The shape of a plugin's manifest.json — the unit the runtime trusts. */
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly category: PluginCategory;
  readonly description: string;
  readonly sdkVersion: string;
  readonly permissions: readonly Permission[];
  readonly commands?: readonly PluginCommand[];
}

export type PluginCategory =
  | "production"
  | "ai"
  | "integration"
  | "workflow"
  | "ui"
  | "utility";

export const PLUGIN_CATEGORIES: readonly PluginCategory[] = [
  "production",
  "ai",
  "integration",
  "workflow",
  "ui",
  "utility",
];
