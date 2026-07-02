/**
 * Enterprise IPC handlers.
 *
 * Wires the Team, Role, Audit, and License repositories to the renderer
 * via IPC channels prefixed with `enterprise:`.
 */
import { ipcMain } from "electron";
import { createLogger } from "@main/core/logger.js";
import type { StudioDatabase } from "@main/database/db.js";
import { TeamRepository } from "@main/database/repositories/team-repository.js";
import { RoleRepository } from "@main/database/repositories/role-repository.js";
import { AuditRepository } from "@main/database/repositories/audit-repository.js";
import { LicenseRepository } from "@main/database/repositories/license-repository.js";

const log = createLogger("enterprise-ipc");

export function registerEnterpriseIpc(db: StudioDatabase): void {
  const teams = new TeamRepository(db);
  const roles = new RoleRepository(db);
  const audit = new AuditRepository(db);
  const licenses = new LicenseRepository(db);

  // ── Teams ──────────────────────────────────────────────────

  ipcMain.handle("enterprise:team:list", () => {
    log.debug("team:list");
    return teams.list();
  });

  ipcMain.handle("enterprise:team:create", (_e, input: { name: string; slug: string; description?: string }) => {
    log.debug("team:create", { name: input.name });
    return teams.create(input);
  });

  ipcMain.handle("enterprise:team:get", (_e, uuid: string) => {
    log.debug("team:get", { uuid });
    return teams.getTeamWithMembers(uuid);
  });

  ipcMain.handle("enterprise:team:update", (_e, uuid: string, input: Record<string, unknown>) => {
    log.debug("team:update", { uuid });
    return teams.update(uuid, input as { name?: string; slug?: string; description?: string });
  });

  ipcMain.handle("enterprise:team:delete", (_e, uuid: string) => {
    log.debug("team:delete", { uuid });
    return teams.delete(uuid);
  });

  ipcMain.handle("enterprise:team:addMember", (_e, input: { teamUuid: string; userUuid: string; role?: string }) => {
    log.debug("team:addMember", { teamUuid: input.teamUuid, userUuid: input.userUuid });
    return teams.addMember(input.teamUuid, input.userUuid, input.role);
  });

  ipcMain.handle("enterprise:team:removeMember", (_e, teamUuid: string, userUuid: string) => {
    log.debug("team:removeMember", { teamUuid, userUuid });
    return teams.removeMember(teamUuid, userUuid);
  });

  ipcMain.handle("enterprise:team:updateMemberRole", (_e, input: { teamUuid: string; userUuid: string; role: string }) => {
    log.debug("team:updateMemberRole", { teamUuid: input.teamUuid, userUuid: input.userUuid });
    return teams.updateMemberRole(input.teamUuid, input.userUuid, input.role);
  });

  ipcMain.handle("enterprise:team:userTeams", (_e, userUuid: string) => {
    log.debug("team:userTeams", { userUuid });
    return teams.getTeamsForUser(userUuid);
  });

  ipcMain.handle("enterprise:team:stats", () => {
    return teams.stats();
  });

  // ── Roles ──────────────────────────────────────────────────

  ipcMain.handle("enterprise:role:list", () => {
    log.debug("role:list");
    return roles.listRoles();
  });

  ipcMain.handle("enterprise:role:create", (_e, input: { name: string; description?: string; isSystem?: boolean }) => {
    log.debug("role:create", { name: input.name });
    return roles.createRole({ name: input.name, description: input.description, is_system: input.isSystem });
  });

  ipcMain.handle("enterprise:role:get", (_e, uuid: string) => {
    log.debug("role:get", { uuid });
    return roles.getRoleWithPermissions(uuid);
  });

  ipcMain.handle("enterprise:role:update", (_e, uuid: string, input: { name?: string; description?: string }) => {
    log.debug("role:update", { uuid });
    return roles.updateRole(uuid, input);
  });

  ipcMain.handle("enterprise:role:delete", (_e, uuid: string) => {
    log.debug("role:delete", { uuid });
    return roles.deleteRole(uuid);
  });

  ipcMain.handle("enterprise:role:assignPermission", (_e, roleUuid: string, permissionUuid: string) => {
    log.debug("role:assignPermission", { roleUuid, permissionUuid });
    roles.assignPermissionToRole(roleUuid, permissionUuid);
    return { success: true };
  });

  ipcMain.handle("enterprise:role:revokePermission", (_e, roleUuid: string, permissionUuid: string) => {
    log.debug("role:revokePermission", { roleUuid, permissionUuid });
    roles.revokePermissionFromRole(roleUuid, permissionUuid);
    return { success: true };
  });

  ipcMain.handle("enterprise:role:assignToUser", (_e, input: { userUuid: string; roleUuid: string }) => {
    log.debug("role:assignToUser", { userUuid: input.userUuid, roleUuid: input.roleUuid });
    return roles.assignRoleToUser(input.userUuid, input.roleUuid);
  });

  ipcMain.handle("enterprise:role:revokeFromUser", (_e, input: { userUuid: string; roleUuid: string }) => {
    log.debug("role:revokeFromUser", { userUuid: input.userUuid, roleUuid: input.roleUuid });
    roles.revokeRoleFromUser(input.userUuid, input.roleUuid);
    return { success: true };
  });

  ipcMain.handle("enterprise:role:userRoles", (_e, userUuid: string) => {
    log.debug("role:userRoles", { userUuid });
    return roles.getRolesForUser(userUuid);
  });

  ipcMain.handle("enterprise:role:userHasPermission", (_e, input: { userUuid: string; permission: string }) => {
    log.debug("role:userHasPermission", { userUuid: input.userUuid, permission: input.permission });
    return roles.userHasPermission(input.userUuid, input.permission);
  });

  ipcMain.handle("enterprise:role:stats", () => {
    return roles.stats();
  });

  // ── Permissions ────────────────────────────────────────────

  ipcMain.handle("enterprise:permission:list", () => {
    log.debug("permission:list");
    return roles.listPermissions();
  });

  ipcMain.handle("enterprise:permission:create", (_e, input: { name: string; resource: string; action: string; description?: string }) => {
    log.debug("permission:create", { name: input.name });
    return roles.createPermission(input);
  });

  ipcMain.handle("enterprise:permission:delete", (_e, uuid: string) => {
    log.debug("permission:delete", { uuid });
    return roles.deletePermission(uuid);
  });

  // ── Audit Log ──────────────────────────────────────────────

  ipcMain.handle("enterprise:audit:list", (_e, filter?: {
    user_uuid?: string;
    action?: string;
    resource_type?: string;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
  }) => {
    log.debug("audit:list", filter);
    return audit.list(filter);
  });

  ipcMain.handle("enterprise:audit:log", (_e, input: {
    user_uuid?: string;
    action: string;
    resource_type: string;
    resource_uuid?: string;
    details?: Record<string, unknown>;
  }) => {
    log.debug("audit:log", { action: input.action, resource_type: input.resource_type });
    return audit.log(input);
  });

  ipcMain.handle("enterprise:audit:count", (_e, filter?: {
    user_uuid?: string;
    action?: string;
    resource_type?: string;
  }) => {
    log.debug("audit:count", filter);
    return audit.count(filter);
  });

  ipcMain.handle("enterprise:audit:stats", () => {
    return audit.stats();
  });

  // ── Licenses ───────────────────────────────────────────────

  ipcMain.handle("enterprise:license:list", () => {
    log.debug("license:list");
    return licenses.list();
  });

  ipcMain.handle("enterprise:license:get", (_e, uuid: string) => {
    log.debug("license:get", { uuid });
    return licenses.getByUuid(uuid);
  });

  ipcMain.handle("enterprise:license:getActive", () => {
    log.debug("license:getActive");
    return licenses.getActive();
  });

  ipcMain.handle("enterprise:license:create", (_e, input: {
    key: string; type?: string; holder_name?: string; holder_email?: string;
    features?: string[]; max_users?: number; max_projects?: number; expires_at?: string | null;
  }) => {
    log.debug("license:create", { key: input.key });
    return licenses.create(input);
  });

  ipcMain.handle("enterprise:license:update", (_e, uuid: string, input: Record<string, unknown>) => {
    log.debug("license:update", { uuid });
    return licenses.update(uuid, input as Parameters<LicenseRepository["update"]>[1]);
  });

  ipcMain.handle("enterprise:license:delete", (_e, uuid: string) => {
    log.debug("license:delete", { uuid });
    return licenses.delete(uuid);
  });

  ipcMain.handle("enterprise:license:hasFeature", (_e, input: { uuid: string; feature: string }) => {
    log.debug("license:hasFeature", { uuid: input.uuid, feature: input.feature });
    const lic = licenses.getByUuid(input.uuid);
    if (!lic) return false;
    return licenses.hasFeature(lic, input.feature);
  });

  ipcMain.handle("enterprise:license:stats", () => {
    return licenses.stats();
  });

  log.info("enterprise IPC registered");
}
