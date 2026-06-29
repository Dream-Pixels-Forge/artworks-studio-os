/**
 * Domain models: Character, Scene, Shot, Asset, Film, Project.
 *
 * Pure data contracts — no behavior, no dependencies. Every field traces
 * back to a column in database.md so the type system and the schema stay
 * in lockstep.
 */

/** Fields every persisted entity carries (database.md "Entity Structure"). */
export interface Entity {
  readonly uuid: string;
  /** Permanent human-readable ID, e.g. "CHR-001". */
  readonly id: string;
  readonly name: string;
  readonly type: string;
  status: EntityStatus;
  version: number;
  readonly createdAt: string;
  updatedAt: string;
  owner?: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export type EntityStatus =
  | "draft"
  | "active"
  | "review"
  | "approved"
  | "final"
  | "archived";

export interface Project extends Entity {
  readonly type: "production";
  description: string;
}

export interface Character extends Entity {
  readonly type: "character";
  role: string;
  arc: string;
  backstory: string;
}

export interface Scene extends Entity {
  readonly type: "scene";
  projectId: string;
  /** Display order within the project. */
  order: number;
  synopsis: string;
}

export interface Shot extends Entity {
  readonly type: "shot";
  sceneId: string;
  /** Camera framing: wide, medium, close-up, ... */
  shotType: string;
  durationFrames: number;
}

export interface Asset extends Entity {
  readonly type: "asset";
  assetType: "image" | "video" | "audio" | "document";
  /** Filesystem path relative to the project root. */
  path: string;
  mimeType: string;
}

export interface Film extends Entity {
  readonly type: "film";
  projectId: string;
  runtimeSeconds: number;
}
