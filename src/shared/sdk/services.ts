/**
 * SDK service contracts.
 *
 * These interfaces are the typed surface plugins are written against. They
 * describe WHAT a plugin can do, not HOW it's implemented — the host app
 * injects concrete implementations at runtime (Phase 1).
 *
 * Mirrors the service list in docs/plugin-sdk.md.
 */
import type { Asset, Project } from "@shared/models/index.js";
import type { StudioEvent, StudioEventType } from "@shared/events/index.js";

// --------------------------------------------------------------------------- //
// Project service                                                             //
// --------------------------------------------------------------------------- //

export interface ProjectService {
  create(input: { name: string; description?: string }): Promise<Project>;
  open(id: string): Promise<Project>;
  active(): Promise<Project | null>;
}

// --------------------------------------------------------------------------- //
// Asset service                                                               //
// --------------------------------------------------------------------------- //

export interface AssetService {
  list(filter?: { type?: Asset["assetType"]; tags?: string[] }): Promise<Asset[]>;
  read(uuid: string): Promise<Asset>;
  link(assetUuid: string, targetUuid: string, relation: string): Promise<void>;
}

// --------------------------------------------------------------------------- //
// Knowledge graph service                                                     //
// --------------------------------------------------------------------------- //

export interface GraphRelationship {
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

export interface GraphService {
  relationships(from: string): Promise<GraphRelationship[]>;
  connect(source: string, target: string, type: string): Promise<void>;
}

// --------------------------------------------------------------------------- //
// Prompt service                                                              //
// --------------------------------------------------------------------------- //

export interface GeneratedPrompt {
  readonly text: string;
  readonly model: string;
}

export interface PromptService {
  build(template: string, vars: Record<string, string>): Promise<GeneratedPrompt>;
  history(limit?: number): Promise<GeneratedPrompt[]>;
}

// --------------------------------------------------------------------------- //
// AI service                                                                  //
// --------------------------------------------------------------------------- //

export interface AIMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface AIProvider {
  readonly id: string;
  readonly models: readonly string[];
}

export interface AIService {
  providers(): Promise<AIProvider[]>;
  complete(
    messages: readonly AIMessage[],
    options?: { model?: string; provider?: string },
  ): Promise<string>;
}

// --------------------------------------------------------------------------- //
// File service                                                                //
// --------------------------------------------------------------------------- //

export interface FileService {
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
  watch(path: string, onChange: (event: { path: string; kind: string }) => void): () => void;
}

// --------------------------------------------------------------------------- //
// Media service                                                               //
// --------------------------------------------------------------------------- //

export interface MediaService {
  generate(input: {
    prompt: string;
    kind: "image" | "video";
    model?: string;
  }): Promise<Asset>;
  transcode(input: { path: string; format: string }): Promise<Asset>;
}

// --------------------------------------------------------------------------- //
// Event service                                                               //
// --------------------------------------------------------------------------- //

export type EventHandler<T extends StudioEventType> = (
  payload: Extract<StudioEvent, { type: T }>["payload"],
) => void;

export interface EventService {
  subscribe<T extends StudioEventType>(type: T, handler: EventHandler<T>): () => void;
  publish<T extends StudioEventType>(
    type: T,
    payload: Extract<StudioEvent, { type: T }>["payload"],
  ): void;
}

// --------------------------------------------------------------------------- //
// Notification service                                                        //
// --------------------------------------------------------------------------- //

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface Notification {
  readonly level: NotificationLevel;
  readonly message: string;
  readonly actionLabel?: string;
}

export interface NotificationService {
  show(notification: Notification): void;
}
