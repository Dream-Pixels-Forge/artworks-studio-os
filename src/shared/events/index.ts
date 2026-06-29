/**
 * Studio events.
 *
 * Every module communicates through events rather than direct dependencies.
 * This discriminated union is the single source of truth for what can be
 * published on the bus. Add events here as modules grow.
 *
 * Mirrors the event names described in architecture.md / structure.md
 * (AssetCreated, SceneUpdated, CharacterModified, ProjectOpened, ...).
 */

export interface AssetCreatedPayload {
  readonly assetId: string;
  readonly type: "image" | "video" | "audio" | "document";
}

export interface SceneUpdatedPayload {
  readonly sceneId: string;
  readonly change: string;
}

export interface CharacterModifiedPayload {
  readonly characterId: string;
  readonly field: string;
}

export interface ProjectOpenedPayload {
  readonly projectId: string;
  readonly name: string;
}

export interface ProjectClosedPayload {
  readonly projectId: string;
}

export type StudioEvent =
  | { type: "asset:created"; payload: AssetCreatedPayload }
  | { type: "scene:updated"; payload: SceneUpdatedPayload }
  | { type: "character:modified"; payload: CharacterModifiedPayload }
  | { type: "project:opened"; payload: ProjectOpenedPayload }
  | { type: "project:closed"; payload: ProjectClosedPayload };

export type StudioEventType = StudioEvent["type"];
