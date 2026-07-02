/**
 * Department repository.
 *
 * Manages organizational departments and their membership.
 */
import type { StudioDatabase } from "../db.js";

export interface Department {
  uuid: string;
  name: string;
  description: string;
  leadUuid?: string;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentRow {
  uuid: string;
  name: string;
  description: string;
  lead_uuid: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string;
  leadUuid?: string;
}

export interface DepartmentMember {
  uuid: string;
  departmentUuid: string;
  userUuid: string;
  role: "lead" | "member";
  joinedAt: string;
}

interface DepartmentMemberRow {
  uuid: string;
  department_uuid: string;
  user_uuid: string;
  role: string;
  joined_at: string;
}

export interface AddMemberInput {
  departmentUuid: string;
  userUuid: string;
  role?: "lead" | "member";
}

export class DepartmentRepository {
  constructor(private readonly db: StudioDatabase) {}

  private toDepartment(row: DepartmentRow): Department {
    return {
      uuid: row.uuid,
      name: row.name,
      description: row.description,
      leadUuid: row.lead_uuid ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toMember(row: DepartmentMemberRow): DepartmentMember {
    return {
      uuid: row.uuid,
      departmentUuid: row.department_uuid,
      userUuid: row.user_uuid,
      role: row.role as "lead" | "member",
      joinedAt: row.joined_at,
    };
  }

  create(input: CreateDepartmentInput): Department {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const department: Department = {
      uuid,
      name: input.name,
      description: input.description ?? "",
      leadUuid: input.leadUuid,
      createdAt: now,
      updatedAt: now,
    };

    this.db.exec(
      `INSERT INTO departments (uuid, name, description, lead_uuid, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid, department.name, department.description, department.leadUuid ?? null, now, now],
    );

    return department;
  }

  findByUuid(uuid: string): Department | undefined {
    const row = this.db.get<DepartmentRow>(
      "SELECT * FROM departments WHERE uuid = ?",
      [uuid],
    );
    return row ? this.toDepartment(row) : undefined;
  }

  findByName(name: string): Department | undefined {
    const row = this.db.get<DepartmentRow>(
      "SELECT * FROM departments WHERE name = ?",
      [name],
    );
    return row ? this.toDepartment(row) : undefined;
  }

  list(): Department[] {
    const rows = this.db.all<DepartmentRow>(
      "SELECT * FROM departments ORDER BY name ASC",
    );
    return rows.map((r) => this.toDepartment(r));
  }

  update(uuid: string, updates: Partial<Pick<Department, "name" | "description" | "leadUuid">>): void {
    const existing = this.findByUuid(uuid);
    if (!existing) throw new Error(`Department ${uuid} not found`);

    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      params.push(updates.description);
    }
    if (updates.leadUuid !== undefined) {
      fields.push("lead_uuid = ?");
      params.push(updates.leadUuid);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(uuid);

    this.db.exec(
      `UPDATE departments SET ${fields.join(", ")} WHERE uuid = ?`,
      params,
    );
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM departments WHERE uuid = ?", [uuid]);
  }

  // --- Members ---

  addMember(input: AddMemberInput): DepartmentMember {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const member: DepartmentMember = {
      uuid,
      departmentUuid: input.departmentUuid,
      userUuid: input.userUuid,
      role: input.role ?? "member",
      joinedAt: now,
    };

    this.db.exec(
      `INSERT INTO department_members (uuid, department_uuid, user_uuid, role, joined_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuid, member.departmentUuid, member.userUuid, member.role, now],
    );

    return member;
  }

  listMembers(departmentUuid: string): DepartmentMember[] {
    const rows = this.db.all<DepartmentMemberRow>(
      "SELECT * FROM department_members WHERE department_uuid = ? ORDER BY joined_at ASC",
      [departmentUuid],
    );
    return rows.map((r) => this.toMember(r));
  }

  listUserDepartments(userUuid: string): Department[] {
    const rows = this.db.all<DepartmentRow>(
      `SELECT d.* FROM departments d
       INNER JOIN department_members dm ON dm.department_uuid = d.uuid
       WHERE dm.user_uuid = ?
       ORDER BY d.name ASC`,
      [userUuid],
    );
    return rows.map((r) => this.toDepartment(r));
  }

  removeMember(departmentUuid: string, userUuid: string): void {
    this.db.exec(
      "DELETE FROM department_members WHERE department_uuid = ? AND user_uuid = ?",
      [departmentUuid, userUuid],
    );
  }

  count(): number {
    const row = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM departments",
    );
    return row?.count ?? 0;
  }

  memberCount(departmentUuid: string): number {
    const row = this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM department_members WHERE department_uuid = ?",
      [departmentUuid],
    );
    return row?.count ?? 0;
  }
}
