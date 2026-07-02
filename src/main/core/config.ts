/**
 * Runtime configuration.
 *
 * Reads from environment variables with production-safe defaults. The
 * studio home mirrors the `aw` CLI's AW_HOME convention so both the app
 * and the sidecar agree on where productions live.
 */
import { homedir } from "node:os";
import { join } from "node:path";

export interface StudioConfig {
  /** Root directory for studios and productions. */
  readonly home: string;
  /** Environment label (production, development). */
  readonly environment: "production" | "development";
  /** Whether we are running in a development build. */
  readonly isDev: boolean;
}

function readConfig(): StudioConfig {
  return {
    home: process.env["AW_HOME"] ?? join(homedir(), ".artworks"),
    environment:
      (process.env["AW_ENVIRONMENT"] as StudioConfig["environment"]) ??
      "production",
    // Tests run from source, so treat "test" the same as "development"
    // for entry-resolution purposes (e.g. loading .ts plugin files).
    isDev: process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test",
  };
}

export const config: StudioConfig = readConfig();
