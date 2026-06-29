/**
 * Shared constants, enums, and pure helpers reusable across main + renderer.
 */

export const PRODUCT_NAME = "Artworks Studio OS";
export const TAGLINE = "Create Stories. Build Worlds. Direct Intelligence.";
export const APP_VERSION = "0.1.0";

/** Generate an RFC-4122 v4 UUID. Uses crypto where available. */
export function uuid(): string {
  // Renderer has crypto.randomUUID; main has node:crypto.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  throw new Error("No UUID implementation available.");
}
