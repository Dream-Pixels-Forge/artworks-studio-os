/**
 * Role repository — manages roles, permissions, and assignments.
 *
 * Roles define what actions a user can perform. Permissions are granular
 * resource+action pairs (e.g. "project.create"). Roles are assigned to users
 * globally; permissions are assigned to roles.
 */
import type { StudioDatabase } from "../db.js";

export interface Role {
  uuid: string;
  name: string;
  description: string;
  is_system: number;
  created_at: string;
}

export interface Permission {
  uuid: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface UserRole {
  uuid: string;
  user_uuid: string;
  role_uuid: string;
  granted_at: string;
  granted_by: string | null;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export class RoleRepository {
  constructor(private readonly db: StudioDatabase) {}

  // ── Roles ──────────────────────────────────────────────────

  createRole(input: { name: string; description?: string; is_system?: boolean }): Role {
    const uuid = crypto.randomUUID();
    this.db.exec(
      `INSERT INTO roles (uuid, name, description, is_system)
       VALUES (?, ?, ?, ?)`,
      [uuid, input.name, input.description ?? "", input.is_system ? 1 : 0],
    );
    return this.getRoleByUuid(uuid)!;
  }

  getRoleByUuid(uuid: string): Role | undefined {
    return this.db.get<Role>("SELECT * FROM roles WHERE uuid = ?", [uuid]);
  }

  getRoleByName(name: string): Role | undefined {
    return this.db.get<Role>("SELECT * FROM roles WHERE name = ?", [name]);
  }

  listRoles(): Role[] {
    return this.db.all<Role>("SELECT * FROM roles ORDER BY name");
  }

  updateRole(uuid: string, input: Partial<Pick<Role, "name" | "description">>): Role | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) { fields.push("name = ?"); values.push(input.name); }
    if (input.description !== undefined) { fields.push("description = ?"); values.push(input.description); }
    if (fields.length === 0) return this.getRoleByUuid(uuid);
    values.push(uuid);
    this.db.exec(`UPDATE roles SET ${fields.join(", ")} WHERE uuid = ?`, values);
    return this.getRoleByUuid(uuid);
  }

  deleteRole(uuid: string): boolean {
    const role = this.getRoleByUuid(uuid);
    if (!role || role.is_system) return false;
    this.db.transaction(() => {
      this.db.exec("DELETE FROM role_permissions WHERE role_uuid = ?", [uuid]);
      this.db.exec("DELETE FROM user_roles WHERE role_uuid = ?", [uuid]);
      this.db.exec("DELETE FROM roles WHERE uuid = ?", [uuid]);
    });
    return true;
  }

  // ── Permissions ────────────────────────────────────────────

  createPermission(input: { name: string; resource: string; action: string; description?: string }): Permission {
    const uuid = crypto.randomUUID();
    this.db.exec(
      `INSERT INTO permissions (uuid, name, resource, action, description)
       VALUES (?, ?, ?, ?, ?)`,
      [uuid, input.name, input.resource, input.action, input.description ?? ""],
    );
    return this.db.get<Permission>("SELECT * FROM permissions WHERE uuid = ?", [uuid])!;
  }

  getPermissionByUuid(uuid: string): Permission | undefined {
    return this.db.get<Permission>("SELECT * FROM permissions WHERE uuid = ?", [uuid]);
  }

  getPermissionByName(name: string): Permission | undefined {
    return this.db.get<Permission>("SELECT * FROM permissions WHERE name = ?", [name]);
  }

  listPermissions(): Permission[] {
    return this.db.all<Permission>("SELECT * FROM permissions ORDER BY resource, action");
  }

  deletePermission(uuid: string): boolean {
    this.db.transaction(() => {
      this.db.exec("DELETE FROM role_permissions WHERE permission_uuid = ?", [uuid]);
      this.db.exec("DELETE FROM permissions WHERE uuid = ?", [uuid]);
    });
    return true;
  }

  // ── Role ↔ Permission mapping ──────────────────────────────

  assignPermissionToRole(roleUuid: string, permissionUuid: string): void {
    this.db.exec(
      `INSERT OR IGNORE INTO role_permissions (role_uuid, permission_uuid)
       VALUES (?, ?)`,
      [roleUuid, permissionUuid],
    );
  }

  revokePermissionFromRole(roleUuid: string, permissionUuid: string): boolean {
    const exists = this.db.get(
      "SELECT 1 FROM role_permissions WHERE role_uuid = ? AND permission_uuid = ?",
      [roleUuid, permissionUuid],
    );
    if (!exists) return false;
    this.db.exec(
      "DELETE FROM role_permissions WHERE role_uuid = ? AND permission_uuid = ?",
      [roleUuid, permissionUuid],
    );
    return true;
  }

  getPermissionsForRole(roleUuid: string): Permission[] {
    return this.db.all<Permission>(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON rp.permission_uuid = p.uuid
       WHERE rp.role_uuid = ?
       ORDER BY p.resource, p.action`,
      [roleUuid],
    );
  }

  getRolesForPermission(permissionUuid: string): Role[] {
    return this.db.all<Role>(
      `SELECT r.* FROM roles r
       JOIN role_permissions rp ON rp.role_uuid = r.uuid
       WHERE rp.permission_uuid = ?
       ORDER BY r.name`,
      [permissionUuid],
    );
  }

  getRoleWithPermissions(uuid: string): RoleWithPermissions | undefined {
    const role = this.getRoleByUuid(uuid);
    if (!role) return undefined;
    const permissions = this.getPermissionsForRole(uuid);
    return { ...role, permissions };
  }

  // ── User ↔ Role assignments ────────────────────────────────

  assignRoleToUser(userUuid: string, roleUuid: string, grantedBy?: string): UserRole {
    const uuid = crypto.randomUUID();
    this.db.exec(
      `INSERT INTO user_roles (uuid, user_uuid, role_uuid, granted_by)
       VALUES (?, ?, ?, ?)`,
      [uuid, userUuid, roleUuid, grantedBy ?? null],
    );
    return this.db.get<UserRole>("SELECT * FROM user_roles WHERE uuid = ?", [uuid])!;
  }

  revokeRoleFromUser(userUuid: string, roleUuid: string): boolean {
    const exists = this.db.get(
      "SELECT 1 FROM user_roles WHERE user_uuid = ? AND role_uuid = ?",
      [userUuid, roleUuid],
    );
    if (!exists) return false;
    this.db.exec(
      "DELETE FROM user_roles WHERE user_uuid = ? AND role_uuid = ?",
      [userUuid, roleUuid],
    );
    return true;
  }

  getRolesForUser(userUuid: string): Role[] {
    return this.db.all<Role>(
      `SELECT r.* FROM roles r
       JOIN user_roles ur ON ur.role_uuid = r.uuid
       WHERE ur.user_uuid = ?
       ORDER BY r.name`,
      [userUuid],
    );
  }

  getUsersForRole(roleUuid: string): Array<{ user_uuid: string; granted_at: string; granted_by: string | null }> {
    return this.db.all<{ user_uuid: string; granted_at: string; granted_by: string | null }>(
      "SELECT user_uuid, granted_at, granted_by FROM user_roles WHERE role_uuid = ?",
      [roleUuid],
    );
  }

  // ── Convenience: check if user has permission ──────────────

  userHasPermission(userUuid: string, permissionName: string): boolean {
    const row = this.db.get(
      `SELECT 1 FROM user_roles ur
       JOIN role_permissions rp ON rp.role_uuid = ur.role_uuid
       JOIN permissions p ON p.uuid = rp.permission_uuid
       WHERE ur.user_uuid = ? AND p.name = ?
       LIMIT 1`,
      [userUuid, permissionName],
    );
    return row !== undefined;
  }

  getUserPermissions(userUuid: string): Permission[] {
    return this.db.all<Permission>(
      `SELECT DISTINCT p.* FROM permissions p
       JOIN role_permissions rp ON rp.permission_uuid = p.uuid
       JOIN user_roles ur ON ur.role_uuid = rp.role_uuid
       WHERE ur.user_uuid = ?
       ORDER BY p.resource, p.action`,
      [userUuid],
    );
  }

  // ── Stats ──────────────────────────────────────────────────

  stats(): { roles: number; permissions: number; assignments: number; byResource: Record<string, number> } {
    const roles = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM roles") ?? { c: 0 }).c;
    const permissions = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM permissions") ?? { c: 0 }).c;
    const assignments = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM user_roles") ?? { c: 0 }).c;
    const rows = this.db.all<{ resource: string; c: number }>(
      "SELECT resource, COUNT(*) as c FROM permissions GROUP BY resource",
    );
    const byResource: Record<string, number> = {};
    for (const row of rows) byResource[row.resource] = row.c;
    return { roles, permissions, assignments, byResource };
  }
}
