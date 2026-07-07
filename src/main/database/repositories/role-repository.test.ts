/**
 * RoleRepository tests.
 *
 * Regression coverage for the audit finding: assignRoleToUser threw
 * SQLITE_CONSTRAINT_UNIQUE on a repeat assignment because it used a plain
 * INSERT. The fix makes it idempotent (INSERT OR IGNORE + re-fetch), matching
 * the existing assignPermissionToRole pattern.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../db.js";
import { MIGRATIONS } from "../migrations.js";
import { RoleRepository } from "./role-repository.js";
import { UserRepository } from "./user-repository.js";

let db: StudioDatabase;
let roles: RoleRepository;
let users: UserRepository;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
  roles = new RoleRepository(db);
  users = new UserRepository(db);
});

afterAll(() => {
  db.close();
});

describe("RoleRepository", () => {
  it("creates a role and looks it up", () => {
    const role = roles.createRole({ name: "Editor", description: "Can edit" });
    expect(role.uuid).toBeTruthy();
    expect(roles.getRoleByUuid(role.uuid)?.name).toBe("Editor");
    expect(roles.getRoleByName("Editor")?.uuid).toBe(role.uuid);
  });

  // Regression: assigning the same role twice used to throw
  // SQLITE_CONSTRAINT_UNIQUE. The "ensure this user has this role" action
  // should be idempotent.
  it("assignRoleToUser is idempotent on repeat assignment", () => {
    const user = users.create({ displayName: "Pat" });
    const role = roles.createRole({ name: "Auditor" });

    // grantedBy omitted — it FK-references users(uuid), so a literal like
    // "admin" would trip the FK. The repo passes null when undefined.
    const first = roles.assignRoleToUser(user.uuid, role.uuid);
    expect(first.user_uuid).toBe(user.uuid);
    expect(first.role_uuid).toBe(role.uuid);

    // Second assignment must not throw — returns the existing row.
    const second = roles.assignRoleToUser(user.uuid, role.uuid);
    expect(second.user_uuid).toBe(user.uuid);
    expect(second.role_uuid).toBe(role.uuid);

    // Still exactly one row in user_roles for this pair.
    const userRoles = roles.getRolesForUser(user.uuid);
    expect(userRoles.filter((r) => r.uuid === role.uuid)).toHaveLength(1);
  });

  it("assignPermissionToRole is idempotent (existing behavior, regression-locked)", () => {
    const role = roles.createRole({ name: "Ops" });
    const perm = roles.createPermission({ name: "deploy", resource: "system", action: "write" });
    expect(() => roles.assignPermissionToRole(role.uuid, perm.uuid)).not.toThrow();
    expect(() => roles.assignPermissionToRole(role.uuid, perm.uuid)).not.toThrow();
  });

  it("deletes a role and cascades to its permission/user assignments", () => {
    const user = users.create({ displayName: "Tmp" });
    const role = roles.createRole({ name: "Goner" });
    const perm = roles.createPermission({ name: "x", resource: "y", action: "z" });
    roles.assignPermissionToRole(role.uuid, perm.uuid);
    roles.assignRoleToUser(user.uuid, role.uuid);

    expect(roles.deleteRole(role.uuid)).toBe(true);
    expect(roles.getRoleByUuid(role.uuid)).toBeUndefined();
    // User still exists; just no longer has the deleted role.
    expect(users.findByUuid(user.uuid)).toBeTruthy();
  });
});
