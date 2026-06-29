/**
 * Production explorer types.
 *
 * The shared DTOs live in @shared/production-explorer (importable by both
 * processes). This module re-exports them plus the main-only error types.
 */
export type {
  ProductionManifest,
  ProductionSummary,
  TreeNode,
  TreeNodeKind,
} from "@shared/production-explorer/types.js";

/** Structured error returned over IPC instead of a raw Error string. */
export type ExplorerErrorCode =
  | "STUDIO_NOT_INITIALIZED"
  | "PRODUCTION_NOT_FOUND"
  | "MANIFEST_INVALID";

export interface ExplorerError {
  code: ExplorerErrorCode;
  message: string;
}
