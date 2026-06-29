/**
 * Artworks Studio OS Plugin SDK — type contracts.
 *
 * Plugins are written against these interfaces. The host app provides the
 * implementations at runtime (Phase 1). This module is the single import
 * surface: `import { ... } from "@shared/sdk"`.
 */
export * from "./manifest.js";
export * from "./services.js";
export * from "./host.js";
