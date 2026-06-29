/**
 * Host context — the bundle of services a plugin receives on activation.
 *
 * Plugins never instantiate services themselves; the runtime hands them a
 * `PluginContext` whose members are gated by the plugin's declared
 * permissions. A service the plugin didn't request is `undefined`.
 */
import type { PluginManifest } from "./manifest.js";
import type {
  AIService,
  AssetService,
  EventService,
  FileService,
  GraphService,
  MediaService,
  NotificationService,
  ProjectService,
  PromptService,
} from "./services.js";

export interface PluginContext {
  readonly manifest: PluginManifest;
  readonly project: ProjectService;
  readonly asset: AssetService;
  readonly graph: GraphService;
  readonly prompt: PromptService;
  readonly ai: AIService;
  readonly file: FileService;
  readonly media: MediaService;
  readonly event: EventService;
  readonly notification: NotificationService;
}
