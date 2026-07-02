/**
 * Team repository — manages teams and their members.
 *
 * Teams group users together with role-based membership (owner, admin, member, viewer).
 * Provides CRUD, membership queries, and stats.
 */
import type { StudioDatabase } from "../db.js";

export interface Team {
  uuid: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  uuid: string;
  team_uuid: string;
  user_uuid: string;
  role: string;
  joined_at: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  member_count: number;
}

export class TeamRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: { name: string; slug: string; description?: string; avatar_url?: string }): Team {
    const uuid = crypto.randomUUID();
    this.db.exec(
      `INSERT INTO teams (uuid, name, slug, description, avatar_url)
       VALUES (?, ?, ?, ?, ?)`,
      [uuid, input.name, input.slug, input.description ?? "", input.avatar_url ?? ""],
    );
    return this.getByUuid(uuid)!;
  }

  getByUuid(uuid: string): Team | undefined {
    return this.db.get<Team>("SELECT * FROM teams WHERE uuid = ?", [uuid]);
  }

  getBySlug(slug: string): Team | undefined {
    return this.db.get<Team>("SELECT * FROM teams WHERE slug = ?", [slug]);
  }

  list(): Team[] {
    return this.db.all<Team>("SELECT * FROM teams ORDER BY name");
  }

  update(uuid: string, input: Partial<Pick<Team, "name" | "slug" | "description" | "avatar_url">>): Team | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.slug !== undefined) { fields.push("slug = ?"); values.push(input.slug); }
    if (input.description !== undefined) { fields.push("description = ?"); values.push(input.description); }
    if (input.avatar_url !== undefined) { fields.push("avatar_url = ?"); values.push(input.avatar_url); }
    if (fields.length === 0) return this.getByUuid(uuid);
    fields.push("updated_at = datetime('now')");
    values.push(uuid);
    this.db.exec(`UPDATE teams SET ${fields.join(", ")} WHERE uuid = ?`, values);
    return this.getByUuid(uuid);
  }

  delete(uuid: string): boolean {
    const exists = this.db.get("SELECT 1 FROM teams WHERE uuid = ?", [uuid]);
    if (!exists) return false;
    this.db.exec("DELETE FROM teams WHERE uuid = ?", [uuid]);
    return true;
  }

  // ── Member management ──────────────────────────────────────

  addMember(teamUuid: string, userUuid: string, role = "member"): TeamMember {
    const uuid = crypto.randomUUID();
    this.db.exec(
      `INSERT INTO team_members (uuid, team_uuid, user_uuid, role)
       VALUES (?, ?, ?, ?)`,
      [uuid, teamUuid, userUuid, role],
    );
    return this.db.get<TeamMember>("SELECT * FROM team_members WHERE uuid = ?", [uuid])!;
  }

  removeMember(teamUuid: string, userUuid: string): boolean {
    const exists = this.db.get(
      "SELECT 1 FROM team_members WHERE team_uuid = ? AND user_uuid = ?",
      [teamUuid, userUuid],
    );
    if (!exists) return false;
    this.db.exec(
      "DELETE FROM team_members WHERE team_uuid = ? AND user_uuid = ?",
      [teamUuid, userUuid],
    );
    return true;
  }

  updateMemberRole(teamUuid: string, userUuid: string, role: string): TeamMember | undefined {
    this.db.exec(
      "UPDATE team_members SET role = ? WHERE team_uuid = ? AND user_uuid = ?",
      [role, teamUuid, userUuid],
    );
    return this.db.get<TeamMember>(
      "SELECT * FROM team_members WHERE team_uuid = ? AND user_uuid = ?",
      [teamUuid, userUuid],
    );
  }

  getMembers(teamUuid: string): TeamMember[] {
    return this.db.all<TeamMember>(
      "SELECT * FROM team_members WHERE team_uuid = ? ORDER BY joined_at",
      [teamUuid],
    );
  }

  getTeamsForUser(userUuid: string): TeamMember[] {
    return this.db.all<TeamMember>(
      "SELECT * FROM team_members WHERE user_uuid = ? ORDER BY joined_at",
      [userUuid],
    );
  }

  getTeamWithMembers(uuid: string): TeamWithMembers | undefined {
    const team = this.getByUuid(uuid);
    if (!team) return undefined;
    const members = this.getMembers(uuid);
    return { ...team, members, member_count: members.length };
  }

  // ── Stats ──────────────────────────────────────────────────

  stats(): { total: number; totalMembers: number; byRole: Record<string, number> } {
    const total = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM teams") ?? { c: 0 }).c;
    const totalMembers = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM team_members") ?? { c: 0 }).c;
    const rows = this.db.all<{ role: string; c: number }>(
      "SELECT role, COUNT(*) as c FROM team_members GROUP BY role",
    );
    const byRole: Record<string, number> = {};
    for (const row of rows) byRole[row.role] = row.c;
    return { total, totalMembers, byRole };
  }
}
