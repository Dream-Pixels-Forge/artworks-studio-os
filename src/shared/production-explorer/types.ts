/**
 * Production explorer DTOs.
 *
 * Cross-process types shared by the main service and the renderer panel.
 * Lives in shared/ so both process tsconfigs can import it.
 */
import type { ProductionDirectory } from "@shared/production/index.js";

/** The manifest shape written by `aw project new` (see aw/templates/project). */
export interface ProductionManifest {
  schema: string;
  schema_version: number;
  uuid: string;
  id: string;
  name: string;
  type: "production";
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  description: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface ProductionSummary {
  name: string;
  root: string;
  manifestPath: string;
  isActive: boolean;
  manifest: ProductionManifest | null;
}

export type TreeNodeKind = "production" | "directory" | "file";

export interface TreeNode {
  name: string;
  path: string;
  kind: TreeNodeKind;
  /** For capability dirs (docs/assets/...), the matching directory type. */
  directoryType?: ProductionDirectory;
  /** Present for directories; undefined for files. */
  children?: TreeNode[];
}
