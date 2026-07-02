/**
 * Agent Task repository.
 *
 * Tasks represent work items assigned to AI agents, stored in `agent_tasks` table.
 */
import type { StudioDatabase } from "../db.js";

export interface AgentTask {
  uuid: string;
  agentId: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  dueDate?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  agentId: string;
  title: string;
  description?: string;
  priority?: AgentTask["priority"];
  input?: Record<string, unknown>;
  dueDate?: string;
}

export class AgentTaskRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: CreateTaskInput): AgentTask {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const task: AgentTask = {
        uuid,
        agentId: input.agentId,
        title: input.title,
        description: input.description ?? "",
        status: "pending",
        priority: input.priority ?? "medium",
        input: input.input ?? {},
        output: {},
        dueDate: input.dueDate,
        createdAt: now,
        updatedAt: now,
      };
      this.db.exec(
        "INSERT INTO agent_tasks (uuid, agent_id, title, description, status, priority, input, output, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [uuid, input.agentId, input.title, input.description ?? "", "pending", input.priority ?? "medium", JSON.stringify(input.input ?? {}), "{}", input.dueDate ?? null, now, now],
      );
      return task;
    });
  }

  findByUuid(uuid: string): AgentTask | undefined {
    const row = this.db.get<{
      uuid: string; agent_id: string; title: string; description: string;
      status: string; priority: string; input: string; output: string;
      due_date: string | null; started_at: string | null; completed_at: string | null;
      created_at: string; updated_at: string;
    }>("SELECT * FROM agent_tasks WHERE uuid = ?", [uuid]);
    if (!row) return undefined;
    return this.mapRow(row);
  }

  listByAgent(agentId: string): AgentTask[] {
    return this.db.all<{
      uuid: string; agent_id: string; title: string; description: string;
      status: string; priority: string; input: string; output: string;
      due_date: string | null; started_at: string | null; completed_at: string | null;
      created_at: string; updated_at: string;
    }>("SELECT * FROM agent_tasks WHERE agent_id = ? ORDER BY created_at DESC", [agentId]).map((r) => this.mapRow(r));
  }

  listByStatus(status: AgentTask["status"]): AgentTask[] {
    return this.db.all<{
      uuid: string; agent_id: string; title: string; description: string;
      status: string; priority: string; input: string; output: string;
      due_date: string | null; started_at: string | null; completed_at: string | null;
      created_at: string; updated_at: string;
    }>("SELECT * FROM agent_tasks WHERE status = ? ORDER BY priority DESC, created_at DESC", [status]).map((r) => this.mapRow(r));
  }

  list(): AgentTask[] {
    return this.db.all<{
      uuid: string; agent_id: string; title: string; description: string;
      status: string; priority: string; input: string; output: string;
      due_date: string | null; started_at: string | null; completed_at: string | null;
      created_at: string; updated_at: string;
    }>("SELECT * FROM agent_tasks ORDER BY created_at DESC").map((r) => this.mapRow(r));
  }

  start(uuid: string): void {
    const now = new Date().toISOString();
    this.db.exec(
      "UPDATE agent_tasks SET status = 'in_progress', started_at = ?, updated_at = ? WHERE uuid = ?",
      [now, now, uuid],
    );
  }

  complete(uuid: string, output: Record<string, unknown>): void {
    const now = new Date().toISOString();
    this.db.exec(
      "UPDATE agent_tasks SET status = 'completed', output = ?, completed_at = ?, updated_at = ? WHERE uuid = ?",
      [JSON.stringify(output), now, now, uuid],
    );
  }

  fail(uuid: string, reason: string): void {
    const now = new Date().toISOString();
    this.db.exec(
      "UPDATE agent_tasks SET status = 'failed', output = ?, updated_at = ? WHERE uuid = ?",
      [JSON.stringify({ error: reason }), now, uuid],
    );
  }

  cancel(uuid: string): void {
    const now = new Date().toISOString();
    this.db.exec(
      "UPDATE agent_tasks SET status = 'cancelled', updated_at = ? WHERE uuid = ?",
      [now, uuid],
    );
  }

  update(uuid: string, input: Partial<CreateTaskInput>): void {
    const now = new Date().toISOString();
    const task = this.findByUuid(uuid);
    if (!task) return;
    this.db.exec(
      "UPDATE agent_tasks SET title = ?, description = ?, priority = ?, input = ?, due_date = ?, updated_at = ? WHERE uuid = ?",
      [
        input.title ?? task.title,
        input.description ?? task.description,
        input.priority ?? task.priority,
        JSON.stringify(input.input ?? task.input),
        input.dueDate ?? task.dueDate ?? null,
        now,
        uuid,
      ],
    );
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM agent_tasks WHERE uuid = ?", [uuid]);
  }

  stats(): { total: number; pending: number; inProgress: number; completed: number; failed: number } {
    const row = this.db.get<{
      total: number; pending: number; inProgress: number; completed: number; failed: number;
    }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM agent_tasks`,
    );
    return row ?? { total: 0, pending: 0, inProgress: 0, completed: 0, failed: 0 };
  }

  private mapRow(row: {
    uuid: string; agent_id: string; title: string; description: string;
    status: string; priority: string; input: string; output: string;
    due_date: string | null; started_at: string | null; completed_at: string | null;
    created_at: string; updated_at: string;
  }): AgentTask {
    return {
      uuid: row.uuid,
      agentId: row.agent_id,
      title: row.title,
      description: row.description,
      status: row.status as AgentTask["status"],
      priority: row.priority as AgentTask["priority"],
      input: JSON.parse(row.input) as Record<string, unknown>,
      output: JSON.parse(row.output) as Record<string, unknown>,
      dueDate: row.due_date ?? undefined,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
