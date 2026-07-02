/**
 * Agent Message repository.
 *
 * Messages represent conversations with AI agents, stored in `agent_messages` table.
 */
import type { StudioDatabase } from "../db.js";

export interface AgentMessage {
  uuid: string;
  agentId: string;
  taskId?: string;
  role: "system" | "user" | "assistant";
  content: string;
  tokensUsed?: number;
  model?: string;
  createdAt: string;
}

export interface CreateMessageInput {
  agentId: string;
  taskId?: string;
  role: AgentMessage["role"];
  content: string;
  tokensUsed?: number;
  model?: string;
}

export class AgentMessageRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: CreateMessageInput): AgentMessage {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const msg: AgentMessage = {
        uuid,
        agentId: input.agentId,
        taskId: input.taskId,
        role: input.role,
        content: input.content,
        tokensUsed: input.tokensUsed,
        model: input.model,
        createdAt: now,
      };
      this.db.exec(
        "INSERT INTO agent_messages (uuid, agent_id, task_id, role, content, tokens_used, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uuid, input.agentId, input.taskId ?? null, input.role, input.content, input.tokensUsed ?? null, input.model ?? null, now],
      );
      return msg;
    });
  }

  findByUuid(uuid: string): AgentMessage | undefined {
    const row = this.db.get<{
      uuid: string; agent_id: string; task_id: string | null; role: string;
      content: string; tokens_used: number | null; model: string | null; created_at: string;
    }>("SELECT * FROM agent_messages WHERE uuid = ?", [uuid]);
    if (!row) return undefined;
    return this.mapRow(row);
  }

  listByAgent(agentId: string, limit = 50): AgentMessage[] {
    return this.db.all<{
      uuid: string; agent_id: string; task_id: string | null; role: string;
      content: string; tokens_used: number | null; model: string | null; created_at: string;
    }>(
      "SELECT * FROM agent_messages WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?",
      [agentId, limit],
    ).map((r) => this.mapRow(r)).reverse();
  }

  listByTask(taskId: string): AgentMessage[] {
    return this.db.all<{
      uuid: string; agent_id: string; task_id: string | null; role: string;
      content: string; tokens_used: number | null; model: string | null; created_at: string;
    }>(
      "SELECT * FROM agent_messages WHERE task_id = ? ORDER BY created_at ASC",
      [taskId],
    ).map((r) => this.mapRow(r));
  }

  list(limit = 100): AgentMessage[] {
    return this.db.all<{
      uuid: string; agent_id: string; task_id: string | null; role: string;
      content: string; tokens_used: number | null; model: string | null; created_at: string;
    }>(
      "SELECT * FROM agent_messages ORDER BY created_at DESC LIMIT ?",
      [limit],
    ).map((r) => this.mapRow(r)).reverse();
  }

  deleteByAgent(agentId: string): void {
    this.db.exec("DELETE FROM agent_messages WHERE agent_id = ?", [agentId]);
  }

  deleteByTask(taskId: string): void {
    this.db.exec("DELETE FROM agent_messages WHERE task_id = ?", [taskId]);
  }

  countByAgent(agentId: string): number {
    const row = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM agent_messages WHERE agent_id = ?",
      [agentId],
    );
    return row?.count ?? 0;
  }

  tokensByAgent(agentId: string): number {
    const row = this.db.get<{ total: number }>(
      "SELECT COALESCE(SUM(tokens_used), 0) as total FROM agent_messages WHERE agent_id = ?",
      [agentId],
    );
    return row?.total ?? 0;
  }

  private mapRow(row: {
    uuid: string; agent_id: string; task_id: string | null; role: string;
    content: string; tokens_used: number | null; model: string | null; created_at: string;
  }): AgentMessage {
    return {
      uuid: row.uuid,
      agentId: row.agent_id,
      taskId: row.task_id ?? undefined,
      role: row.role as AgentMessage["role"],
      content: row.content,
      tokensUsed: row.tokens_used ?? undefined,
      model: row.model ?? undefined,
      createdAt: row.created_at,
    };
  }
}
