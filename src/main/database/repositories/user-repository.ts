/**
 * User repository.
 *
 * Manages team members in the `users` table.
 * Users are standalone entities (not in the `entities` table) since they
 * represent people, not production content.
 */
import type { StudioDatabase } from "../db.js";

export interface User {
  uuid: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member" | "viewer";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  uuid: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role?: User["role"];
}

export class UserRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: CreateUserInput): User {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const user: User = {
      uuid,
      displayName: input.displayName,
      email: input.email,
      avatarUrl: input.avatarUrl,
      role: input.role ?? "member",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.db.exec(
      `INSERT INTO users (uuid, display_name, email, avatar_url, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, input.displayName, input.email ?? null, input.avatarUrl ?? null, user.role, 1, now, now],
    );
    return user;
  }

  findByUuid(uuid: string): User | undefined {
    const row = this.db.get<UserRow>("SELECT * FROM users WHERE uuid = ?", [uuid]);
    return row ? this.toUser(row) : undefined;
  }

  findByEmail(email: string): User | undefined {
    const row = this.db.get<UserRow>("SELECT * FROM users WHERE email = ?", [email]);
    return row ? this.toUser(row) : undefined;
  }

  list(): User[] {
    const rows = this.db.all<UserRow>(
      "SELECT * FROM users ORDER BY created_at DESC",
    );
    return rows.map((r) => this.toUser(r));
  }

  listActive(): User[] {
    const rows = this.db.all<UserRow>(
      "SELECT * FROM users WHERE is_active = 1 ORDER BY display_name ASC",
    );
    return rows.map((r) => this.toUser(r));
  }

  update(uuid: string, updates: Partial<Pick<User, "displayName" | "email" | "avatarUrl" | "role" | "isActive">>): void {
    this.db.transaction(() => {
      const existing = this.findByUuid(uuid);
      if (!existing) throw new Error(`User ${uuid} not found`);

      const fields: string[] = [];
      const params: unknown[] = [];

      if (updates.displayName !== undefined) {
        fields.push("display_name = ?");
        params.push(updates.displayName);
      }
      if (updates.email !== undefined) {
        fields.push("email = ?");
        params.push(updates.email);
      }
      if (updates.avatarUrl !== undefined) {
        fields.push("avatar_url = ?");
        params.push(updates.avatarUrl);
      }
      if (updates.role !== undefined) {
        fields.push("role = ?");
        params.push(updates.role);
      }
      if (updates.isActive !== undefined) {
        fields.push("is_active = ?");
        params.push(updates.isActive ? 1 : 0);
      }

      if (fields.length > 0) {
        const now = new Date().toISOString();
        fields.push("updated_at = ?");
        params.push(now);
        params.push(uuid);
        this.db.exec(`UPDATE users SET ${fields.join(", ")} WHERE uuid = ?`, params);
      }
    });
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM users WHERE uuid = ?", [uuid]);
  }

  stats(): { total: number; active: number; byRole: Record<string, number> } {
    const total = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM users",
    )?.count ?? 0;
    const active = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE is_active = 1",
    )?.count ?? 0;
    const roleRows = this.db.all<{ role: string; count: number }>(
      "SELECT role, COUNT(*) as count FROM users GROUP BY role",
    );
    const byRole: Record<string, number> = {};
    for (const r of roleRows) {
      byRole[r.role] = r.count;
    }
    return { total, active, byRole };
  }

  private toUser(row: UserRow): User {
    return {
      uuid: row.uuid,
      displayName: row.display_name,
      email: row.email ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      role: row.role as User["role"],
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
