/**
 * Comment repository.
 *
 * Manages threaded comments on any entity in the `comments` table.
 */
import type { StudioDatabase } from "../db.js";

export interface Comment {
  uuid: string;
  userUuid?: string;
  entityUuid: string;
  body: string;
  parentUuid?: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommentRow {
  uuid: string;
  user_uuid: string | null;
  entity_uuid: string;
  body: string;
  parent_uuid: string | null;
  resolved: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentInput {
  userUuid?: string;
  entityUuid: string;
  body: string;
  parentUuid?: string;
}

export class CommentRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: CreateCommentInput): Comment {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const comment: Comment = {
      uuid,
      userUuid: input.userUuid,
      entityUuid: input.entityUuid,
      body: input.body,
      parentUuid: input.parentUuid,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.exec(
      `INSERT INTO comments (uuid, user_uuid, entity_uuid, body, parent_uuid, resolved, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, input.userUuid ?? null, input.entityUuid, input.body, input.parentUuid ?? null, 0, now, now],
    );
    return comment;
  }

  findByUuid(uuid: string): Comment | undefined {
    const row = this.db.get<CommentRow>("SELECT * FROM comments WHERE uuid = ?", [uuid]);
    return row ? this.toComment(row) : undefined;
  }

  listByEntity(entityUuid: string): Comment[] {
    const rows = this.db.all<CommentRow>(
      "SELECT * FROM comments WHERE entity_uuid = ? ORDER BY created_at ASC",
      [entityUuid],
    );
    return rows.map((r) => this.toComment(r));
  }

  listByUser(userUuid: string): Comment[] {
    const rows = this.db.all<CommentRow>(
      "SELECT * FROM comments WHERE user_uuid = ? ORDER BY created_at DESC",
      [userUuid],
    );
    return rows.map((r) => this.toComment(r));
  }

  listRecent(limit = 50): Comment[] {
    const rows = this.db.all<CommentRow>(
      "SELECT * FROM comments ORDER BY created_at DESC LIMIT ?",
      [limit],
    );
    return rows.map((r) => this.toComment(r));
  }

  update(uuid: string, updates: Partial<Pick<Comment, "body" | "resolved">>): void {
    this.db.transaction(() => {
      const existing = this.findByUuid(uuid);
      if (!existing) throw new Error(`Comment ${uuid} not found`);

      const fields: string[] = [];
      const params: unknown[] = [];

      if (updates.body !== undefined) {
        fields.push("body = ?");
        params.push(updates.body);
      }
      if (updates.resolved !== undefined) {
        fields.push("resolved = ?");
        params.push(updates.resolved ? 1 : 0);
      }

      if (fields.length > 0) {
        const now = new Date().toISOString();
        fields.push("updated_at = ?");
        params.push(now);
        params.push(uuid);
        this.db.exec(`UPDATE comments SET ${fields.join(", ")} WHERE uuid = ?`, params);
      }
    });
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM comments WHERE uuid = ?", [uuid]);
  }

  countByEntity(entityUuid: string): number {
    const result = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM comments WHERE entity_uuid = ?",
      [entityUuid],
    );
    return result?.count ?? 0;
  }

  countUnresolved(entityUuid: string): number {
    const result = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM comments WHERE entity_uuid = ? AND resolved = 0",
      [entityUuid],
    );
    return result?.count ?? 0;
  }

  private toComment(row: CommentRow): Comment {
    return {
      uuid: row.uuid,
      userUuid: row.user_uuid ?? undefined,
      entityUuid: row.entity_uuid,
      body: row.body,
      parentUuid: row.parent_uuid ?? undefined,
      resolved: row.resolved === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
