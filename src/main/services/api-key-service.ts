/**
 * API key management service (main process).
 *
 * Stores AI provider API keys in a dedicated JSON file under the studio home.
 * Keys are stored as-is (the file is local-only, not committed to git).
 * The renderer never touches the filesystem — it reads/writes through IPC.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "@main/core/config.js";
import { createLogger } from "@main/core/logger.js";

const log = createLogger("api-keys");

function apiKeysFile(): string {
  return join(config.home, "settings", "api-keys.json");
}

export interface ApiKeyEntry {
  provider: string;
  apiKey: string;
  updatedAt: string;
}

export interface ApiKeysState {
  keys: Record<string, string>; // provider → apiKey (masked in renderer)
}

export class ApiKeyService {
  private keys: Record<string, string> = {};

  async init(): Promise<ApiKeysState> {
    this.keys = await this.readKeys();
    log.info("api keys initialized", { providers: Object.keys(this.keys) });
    return this.state();
  }

  async setKey(provider: string, apiKey: string): Promise<ApiKeysState> {
    this.keys[provider] = apiKey;
    await this.writeKeys();
    log.info("api key set", { provider });
    return this.state();
  }

  async deleteKey(provider: string): Promise<ApiKeysState> {
    delete this.keys[provider];
    await this.writeKeys();
    log.info("api key deleted", { provider });
    return this.state();
  }

  /** Get a key for internal use (not masked). */
  getKey(provider: string): string | undefined {
    return this.keys[provider];
  }

  state(): ApiKeysState {
    // Return masked keys for renderer
    const masked: Record<string, string> = {};
    for (const [provider, key] of Object.entries(this.keys)) {
      masked[provider] = key.length > 8
        ? key.slice(0, 4) + "••••••••" + key.slice(-4)
        : "••••••••";
    }
    return { keys: masked };
  }

  /** Unmasked state for internal use. */
  stateRaw(): ApiKeysState {
    return { keys: { ...this.keys } };
  }

  private async readKeys(): Promise<Record<string, string>> {
    const file = apiKeysFile();
    try {
      if (!existsSync(file)) return {};
      const raw = await readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as { keys?: unknown };
      if (typeof parsed.keys === "object" && parsed.keys !== null) {
        const keys = parsed.keys as Record<string, unknown>;
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(keys)) {
          if (typeof v === "string") result[k] = v;
        }
        return result;
      }
      return {};
    } catch {
      return {};
    }
  }

  private async writeKeys(): Promise<void> {
    const file = apiKeysFile();
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ keys: this.keys }, null, 2), "utf-8");
    } catch (err) {
      log.error("could not persist api keys", { error: (err as Error).message });
    }
  }
}
