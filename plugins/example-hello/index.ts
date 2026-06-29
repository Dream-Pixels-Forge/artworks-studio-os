/**
 * example-hello — reference plugin.
 *
 * Demonstrates the minimal plugin shape: a manifest-backed lifecycle that
 * registers a command and subscribes to an event. Written against the SDK
 * contract in @shared/sdk. There is no plugin runtime yet (Phase 1); this
 * file exists to prove the contract is usable and type-checks.
 */
import type { PluginContext, PluginLifecycle } from "@shared/sdk/index.js";

export function activate(ctx: PluginContext): PluginLifecycle {
  // Greet whenever a project is opened — the manifest declares the command
  // listens to this event, and the runtime wires it.
  ctx.event.subscribe("project:opened", (payload) => {
    ctx.notification.show({
      level: "info",
      message: `Welcome to ${payload.name}.`,
    });
  });

  return {
    onActivate() {
      ctx.notification.show({ level: "success", message: "Hello, Studio." });
    },
  };
}
