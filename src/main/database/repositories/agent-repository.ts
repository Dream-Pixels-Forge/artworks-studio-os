/**
 * AI Agent repository.
 *
 * Agents represent specialized AI roles (Creative Director, Character Designer, etc.)
 * stored in `ai_agents` table.
 */
import type { StudioDatabase } from "../db.js";

export interface AIAgent {
  uuid: string;
  name: string;
  role: string;
  systemPrompt: string;
  model?: string;
  avatar?: string;
  status: "idle" | "busy" | "paused" | "offline";
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  role: string;
  systemPrompt?: string;
  model?: string;
  avatar?: string;
}

export class AgentRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: CreateAgentInput): AIAgent {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const agent: AIAgent = {
        uuid,
        name: input.name,
        role: input.role,
        systemPrompt: input.systemPrompt ?? "",
        model: input.model,
        avatar: input.avatar,
        status: "idle",
        createdAt: now,
        updatedAt: now,
      };
      this.db.exec(
        "INSERT INTO ai_agents (uuid, name, role, system_prompt, model, avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [uuid, input.name, input.role, input.systemPrompt ?? "", input.model ?? null, input.avatar ?? null, "idle", now, now],
      );
      return agent;
    });
  }

  findByUuid(uuid: string): AIAgent | undefined {
    return this.db.get<AIAgent>(
      "SELECT uuid, name, name as name, role, system_prompt as systemPrompt, model, avatar, status, created_at as createdAt, updated_at as updatedAt FROM ai_agents WHERE uuid = ?",
      [uuid],
    );
  }

  findByRole(role: string): AIAgent | undefined {
    return this.db.get<AIAgent>(
      "SELECT uuid, name, role, system_prompt as systemPrompt, model, avatar, status, created_at as createdAt, updated_at as updatedAt FROM ai_agents WHERE role = ?",
      [role],
    );
  }

  list(): AIAgent[] {
    return this.db.all<AIAgent>(
      "SELECT uuid, name, role, system_prompt as systemPrompt, model, avatar, status, created_at as createdAt, updated_at as updatedAt FROM ai_agents ORDER BY created_at DESC",
    );
  }

  listByStatus(status: AIAgent["status"]): AIAgent[] {
    return this.db.all<AIAgent>(
      "SELECT uuid, name, role, system_prompt as systemPrompt, model, avatar, status, created_at as createdAt, updated_at as updatedAt FROM ai_agents WHERE status = ? ORDER BY created_at DESC",
      [status],
    );
  }

  updateStatus(uuid: string, status: AIAgent["status"]): void {
    const now = new Date().toISOString();
    this.db.exec("UPDATE ai_agents SET status = ?, updated_at = ? WHERE uuid = ?", [status, now, uuid]);
  }

  update(uuid: string, input: Partial<CreateAgentInput>): void {
    const now = new Date().toISOString();
    const agent = this.findByUuid(uuid);
    if (!agent) return;
    this.db.exec(
      "UPDATE ai_agents SET name = ?, role = ?, system_prompt = ?, model = ?, avatar = ?, updated_at = ? WHERE uuid = ?",
      [
        input.name ?? agent.name,
        input.role ?? agent.role,
        input.systemPrompt ?? agent.systemPrompt,
        input.model ?? agent.model ?? null,
        input.avatar ?? agent.avatar ?? null,
        now,
        uuid,
      ],
    );
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM ai_agents WHERE uuid = ?", [uuid]);
  }

  stats(): { total: number; idle: number; busy: number; paused: number; offline: number } {
    const row = this.db.get<{ total: number; idle: number; busy: number; paused: number; offline: number }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'idle' THEN 1 ELSE 0 END) as idle,
        SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
      FROM ai_agents`,
    );
    return row ?? { total: 0, idle: 0, busy: 0, paused: 0, offline: 0 };
  }
}
