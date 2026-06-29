/**
 * Permission-gated PluginContext builder.
 *
 * The frozen PluginContext interface marks all services required, so
 * gating is implemented as throw-on-use proxies: a service the plugin
 * did not earn via its permissions is structurally present (satisfies the
 * interface) but throws if called. `event` is always real — it's a core
 * service the runtime needs for subscription teardown.
 */
import { Permission, type PluginContext, type PluginManifest } from "@shared/sdk/index.js";
import type { HostServices } from "./host-services.js";

/** Which permission gates each context service. "core" = always available. */
export const PERMISSION_SERVICE_MAP: Record<
  Exclude<keyof PluginContext, "manifest">,
  Permission | "core"
> = {
  project: Permission.Database,
  asset: Permission.Database,
  graph: Permission.Database,
  prompt: Permission.AI,
  ai: Permission.AI,
  file: Permission.Filesystem,
  media: Permission.Media,
  event: "core",
  notification: Permission.Notification,
};

/** Build a context whose services are gated by the plugin's permissions. */
export function buildPluginContext(
  manifest: PluginManifest,
  services: HostServices,
): PluginContext {
  const granted = new Set<Permission>(manifest.permissions);

  function maybe<T>(serviceName: keyof typeof PERMISSION_SERVICE_MAP, real: T): T {
    const gate = PERMISSION_SERVICE_MAP[serviceName];
    if (gate === "core" || granted.has(gate)) {
      return real;
    }
    return gatedProxy<T>(serviceName, gate, manifest.id);
  }

  return {
    manifest,
    project: maybe("project", services.project),
    asset: maybe("asset", services.asset),
    graph: maybe("graph", services.graph),
    prompt: maybe("prompt", services.prompt),
    ai: maybe("ai", services.ai),
    file: maybe("file", services.file),
    media: maybe("media", services.media),
    event: services.event, // always real
    notification: maybe("notification", services.notification),
  };
}

/** A proxy whose method calls throw a permission error. */
function gatedProxy<T>(serviceName: string, permission: Permission, pluginId: string): T {
  const message = `${serviceName} requires permission '${permission}' not granted to plugin '${pluginId}'.`;
  const trap = () => {
    throw new Error(message);
  };
  // A proxy over a function so both method calls and property access trap.
  return new Proxy(trap, {
    apply: trap,
    get: () => gatedProxy(serviceName, permission, pluginId),
  }) as unknown as T;
}
