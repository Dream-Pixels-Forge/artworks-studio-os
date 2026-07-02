/**
 * Production domain DTOs — the typed payloads crossing the IPC boundary.
 *
 * These mirror the shared models but are strictly JSON-serializable (no
 * class instances, no dates) so main→renderer data is typed on both ends.
 */
import type { Project, Asset, Entity, EntityStatus } from "@shared/models/index.js";

/** Project DTO (same as Project model — already serializable). */
export type ProjectDto = Project;

/** Asset DTO (same as Asset model — already serializable). */
export type AssetDto = Asset;

/** Document entity (extends Entity with document-specific fields). */
export interface DocumentDto extends Entity {
  readonly type: "document";
  projectUuid?: string;
  docType: string;
  content: string;
}

/** Search result: a lightweight entity reference + highlighted snippet. */
export interface SearchResultDto {
  readonly uuid: string;
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly status: EntityStatus;
}

/** Input for creating a project via IPC. */
export interface CreateProjectDto {
  readonly name: string;
  readonly description?: string;
}

/** Input for creating an asset via IPC. */
export interface CreateAssetDto {
  readonly name: string;
  readonly assetType: "image" | "video" | "audio" | "document";
  readonly path: string;
  readonly mimeType: string;
  readonly sizeBytes?: number;
}

/** Input for creating a document via IPC. */
export interface CreateDocumentDto {
  readonly name: string;
  readonly docType: string;
  readonly content?: string;
  readonly projectUuid?: string;
}

/** Production dashboard stats. */
export interface DashboardStatsDto {
  readonly projectCount: number;
  readonly assetCount: number;
  readonly documentCount: number;
  readonly entityCount: number;
  readonly assetsByType: Record<string, number>;
}