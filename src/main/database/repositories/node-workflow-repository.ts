/**
 * Node Workflow repository.
 *
 * Visual production workflows stored as JSON node/edge graphs
 * in the `node_workflows` table.
 */
import type { StudioDatabase } from "../db.js";

export interface NodeWorkflow {
  uuid: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  nodes: string; // JSON array of React Flow nodes
  edges: string; // JSON array of React Flow edges
  viewport: string; // JSON viewport state
  createdAt: string;
  updatedAt: string;
}

export interface CreateNodeWorkflowInput {
  name: string;
  description?: string;
  nodes?: string;
  edges?: string;
  viewport?: string;
}

export interface NodeWorkflowMeta {
  uuid: string;
  name: string;
  description: string;
  status: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export class NodeWorkflowRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: CreateNodeWorkflowInput): NodeWorkflow {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      this.db.exec(
        "INSERT INTO node_workflows (uuid, name, description, status, nodes, edges, viewport, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          uuid,
          input.name,
          input.description ?? "",
          "draft",
          input.nodes ?? "[]",
          input.edges ?? "[]",
          input.viewport ?? '{"x":0,"y":0,"zoom":1}',
          now,
          now,
        ],
      );
      return this.db.get<NodeWorkflow>(
        "SELECT uuid, name, description, status, nodes, edges, viewport, created_at as createdAt, updated_at as updatedAt FROM node_workflows WHERE uuid = ?",
        [uuid],
      )!;
    });
  }

  findByUuid(uuid: string): NodeWorkflow | undefined {
    return this.db.get<NodeWorkflow>(
      "SELECT uuid, name, description, status, nodes, edges, viewport, created_at as createdAt, updated_at as updatedAt FROM node_workflows WHERE uuid = ?",
      [uuid],
    );
  }

  list(): NodeWorkflowMeta[] {
    const rows = this.db.all<NodeWorkflow>(
      "SELECT uuid, name, description, status, nodes, edges, created_at as createdAt, updated_at as updatedAt FROM node_workflows ORDER BY updated_at DESC",
    );
    return rows.map((r) => ({
      uuid: r.uuid,
      name: r.name,
      description: r.description,
      status: r.status,
      nodeCount: JSON.parse(r.nodes).length,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  listByStatus(status: NodeWorkflow["status"]): NodeWorkflowMeta[] {
    const rows = this.db.all<NodeWorkflow>(
      "SELECT uuid, name, description, status, nodes, edges, created_at as createdAt, updated_at as updatedAt FROM node_workflows WHERE status = ? ORDER BY updated_at DESC",
      [status],
    );
    return rows.map((r) => ({
      uuid: r.uuid,
      name: r.name,
      description: r.description,
      status: r.status,
      nodeCount: JSON.parse(r.nodes).length,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  update(uuid: string, input: Partial<CreateNodeWorkflowInput> & { status?: string }): void {
    const now = new Date().toISOString();
    const existing = this.findByUuid(uuid);
    if (!existing) return;
    this.db.exec(
      "UPDATE node_workflows SET name = ?, description = ?, status = ?, nodes = ?, edges = ?, viewport = ?, updated_at = ? WHERE uuid = ?",
      [
        input.name ?? existing.name,
        input.description ?? existing.description,
        input.status ?? existing.status,
        input.nodes ?? existing.nodes,
        input.edges ?? existing.edges,
        input.viewport ?? existing.viewport,
        now,
        uuid,
      ],
    );
  }

  updateGraph(uuid: string, nodes: string, edges: string, viewport?: string): void {
    const now = new Date().toISOString();
    const existing = this.findByUuid(uuid);
    if (!existing) return;
    this.db.exec(
      "UPDATE node_workflows SET nodes = ?, edges = ?, viewport = ?, updated_at = ? WHERE uuid = ?",
      [
        nodes,
        edges,
        viewport ?? existing.viewport,
        now,
        uuid,
      ],
    );
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM node_workflows WHERE uuid = ?", [uuid]);
  }

  stats(): { total: number; draft: number; active: number; archived: number } {
    const row = this.db.get<{ total: number; draft: number; active: number; archived: number }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
      FROM node_workflows`,
    );
    return row ?? { total: 0, draft: 0, active: 0, archived: 0 };
  }
}
