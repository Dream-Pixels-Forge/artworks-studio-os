/**
 * Node-graph execution run repository.
 *
 * Persists one row per graph "Run" plus a per-node audit trail (the step
 * history). Mirrors the lifecycle state-machine pattern: a current-state
 * row in `node_workflow_runs` and an append-only log in `node_run_steps`.
 *
 * All multi-statement writes go through `db.transaction()` per db.ts's
 * "every multi-table write MUST use transaction()" rule.
 */
import type { StudioDatabase } from "../db.js";
import type { GraphRunStatus, NodeKind, NodeRunStatus } from "@shared/production/node-types.js";

/** A run's current state (row in node_workflow_runs). */
export interface NodeWorkflowRun {
  runId: string;
  workflowUuid: string;
  status: GraphRunStatus;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

/** A per-node execution record (row in node_run_steps). */
export interface NodeRunStep {
  id: number;
  runId: string;
  nodeId: string;
  nodeKind: NodeKind;
  status: NodeRunStatus;
  inputJson: string | null;
  outputJson: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** Patch applied to a step during execution. */
export interface NodeRunStepPatch {
  status?: NodeRunStatus;
  inputJson?: string | null;
  outputJson?: string | null;
  error?: string | null;
}

/** A run with its steps hydrated (used for history display). */
export interface NodeWorkflowRunWithSteps extends NodeWorkflowRun {
  steps: NodeRunStep[];
}

export class NodeRunRepository {
  constructor(private readonly db: StudioDatabase) {}

  /**
   * Create a run record. The run id is generated as "run_<uuidv4>" so it
   * is globally unique and easily greppable in logs.
   */
  createRun(workflowUuid: string): NodeWorkflowRun {
    const runId = `run_${crypto.randomUUID()}`;
    this.db.exec(
      "INSERT INTO node_workflow_runs (run_id, workflow_uuid, status) VALUES (?, ?, 'running')",
      [runId, workflowUuid],
    );
    return this.getRun(runId)!;
  }

  /** Update a run's terminal status and, on completion, stamp completed_at. */
  updateRunStatus(runId: string, status: GraphRunStatus, error?: string): void {
    const finished: GraphRunStatus[] = [
      "completed",
      "failed",
      "cancelled",
      "awaiting-review",
    ];
    const completedAt = finished.includes(status) ? new Date().toISOString() : null;
    this.db.exec(
      "UPDATE node_workflow_runs SET status = ?, completed_at = COALESCE(?, completed_at), error = ? WHERE run_id = ?",
      [status, completedAt, error ?? null, runId],
    );
  }

  /** Upsert the step row for (runId, nodeId). Created on node:started. */
  upsertStep(
    runId: string,
    nodeId: string,
    nodeKind: NodeKind,
  ): void {
    this.db.exec(
      `INSERT INTO node_run_steps (run_id, node_id, node_kind, status, started_at)
       VALUES (?, ?, ?, 'running', datetime('now'))
       ON CONFLICT(run_id, node_id) DO UPDATE SET
         status = 'running',
         started_at = datetime('now')`,
      [runId, nodeId, nodeKind],
    );
  }

  /** Apply a patch to a step row. */
  updateStep(runId: string, nodeId: string, patch: NodeRunStepPatch): void {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.status !== undefined) {
      sets.push("status = ?");
      params.push(patch.status);
    }
    if (patch.inputJson !== undefined) {
      sets.push("input_json = ?");
      params.push(patch.inputJson);
    }
    if (patch.outputJson !== undefined) {
      sets.push("output_json = ?");
      params.push(patch.outputJson);
    }
    if (patch.error !== undefined) {
      sets.push("error = ?");
      params.push(patch.error);
    }
    if (patch.status === "completed" || patch.status === "failed") {
      sets.push("completed_at = datetime('now')");
    }
    if (sets.length === 0) return;
    params.push(runId, nodeId);
    this.db.exec(
      `UPDATE node_run_steps SET ${sets.join(", ")} WHERE run_id = ? AND node_id = ?`,
      params,
    );
  }

  getRun(runId: string): NodeWorkflowRun | undefined {
    return this.db.get<NodeWorkflowRun>(
      `SELECT run_id as runId, workflow_uuid as workflowUuid, status,
              started_at as startedAt, completed_at as completedAt, error
       FROM node_workflow_runs WHERE run_id = ?`,
      [runId],
    );
  }

  /** A run with its step history. */
  getRunWithSteps(runId: string): NodeWorkflowRunWithSteps | undefined {
    const run = this.getRun(runId);
    if (!run) return undefined;
    const steps = this.db.all<NodeRunStep>(
      `SELECT id, run_id as runId, node_id as nodeId, node_kind as nodeKind,
              status, input_json as inputJson, output_json as outputJson, error,
              started_at as startedAt, completed_at as completedAt
       FROM node_run_steps WHERE run_id = ? ORDER BY id ASC`,
      [runId],
    );
    return { ...run, steps };
  }

  /** Recent runs for a workflow (newest first). */
  listRuns(workflowUuid: string, limit = 25): NodeWorkflowRun[] {
    return this.db.all<NodeWorkflowRun>(
      `SELECT run_id as runId, workflow_uuid as workflowUuid, status,
              started_at as startedAt, completed_at as completedAt, error
       FROM node_workflow_runs WHERE workflow_uuid = ?
       ORDER BY started_at DESC LIMIT ?`,
      [workflowUuid, limit],
    );
  }
}
