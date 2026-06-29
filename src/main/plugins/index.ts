/** Plugin runtime: discovery, validation, loading, and lifecycle. */
export { PluginRuntime } from "./runtime.js";
export type { RuntimeOptions } from "./runtime.js";
export { discoverPlugins } from "./discovery.js";
export type { DiscoveredPlugin, DiscoveryOptions } from "./discovery.js";
export { validateManifest, parseManifest, SDK_VERSION } from "./validator.js";
export type { ManifestValidation } from "./validator.js";
export { buildPluginContext, PERMISSION_SERVICE_MAP } from "./context.js";
export { buildHostServices } from "./host-services.js";
export type { HostServices } from "./host-services.js";
export { loadPlugin } from "./loader.js";
export type { LoadedPlugin } from "./loader.js";
