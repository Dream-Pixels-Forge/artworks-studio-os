/**
 * Enterprise panel.
 *
 * Manage teams, roles, permissions, audit log, and license info.
 * Provides admin-level enterprise features for the studio.
 */
import { useState, useEffect, useCallback } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Team {
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TeamWithMembers extends Team {
  members: Array<{
    uuid: string;
    userUuid: string;
    role: string;
    joinedAt: string;
  }>;
}

interface Role {
  uuid: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  uuid: string;
  userUuid: string | null;
  action: string;
  resourceType: string;
  resourceUuid: string | null;
  details: string | null;
  createdAt: string;
}

interface License {
  uuid: string;
  key: string;
  type: string;
  holderName: string | null;
  holderEmail: string | null;
  features: string | null;
  maxUsers: number | null;
  maxProjects: number | null;
  isActive: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Tab = "teams" | "roles" | "audit" | "license";

export function EnterprisePanel() {
  const [tab, setTab] = useState<Tab>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [activeLicense, setActiveLicense] = useState<License | null>(null);
  const [teamStats, setTeamStats] = useState<{ total: number; members: number } | null>(null);
  const [roleStats, setRoleStats] = useState<{ total: number; system: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const PAGE_SIZE = 20;

  const loadTabData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      switch (tab) {
        case "teams": {
          const [t, s] = await Promise.all([
            window.artworks.enterprise.team.list(),
            window.artworks.enterprise.team.stats(),
          ]);
          setTeams(t as Team[]);
          setTeamStats(s as { total: number; members: number });
          break;
        }
        case "roles": {
          const [r, s] = await Promise.all([
            window.artworks.enterprise.role.list(),
            window.artworks.enterprise.role.stats(),
          ]);
          setRoles(r as Role[]);
          setRoleStats(s as { total: number; system: number });
          break;
        }
        case "audit": {
          const entries = await window.artworks.enterprise.audit.list({
            limit: PAGE_SIZE,
            offset: auditPage * PAGE_SIZE,
          });
          setAuditEntries(entries as AuditEntry[]);
          break;
        }
        case "license": {
          const lic = await window.artworks.enterprise.license.getActive();
          setActiveLicense(lic as License | null);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [tab, auditPage]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  const createTeam = useCallback(async () => {
    const name = window.prompt("Team name:");
    if (!name?.trim()) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    try {
      await window.artworks.enterprise.team.create({ name: name.trim(), slug });
      void loadTabData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    }
  }, [loadTabData]);

  const createRole = useCallback(async () => {
    const name = window.prompt("Role name:");
    if (!name?.trim()) return;
    try {
      await window.artworks.enterprise.role.create({ name: name.trim() });
      void loadTabData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    }
  }, [loadTabData]);

  const deleteTeam = useCallback(async (uuid: string, name: string) => {
    if (!window.confirm(`Delete team "${name}"?`)) return;
    try {
      await window.artworks.enterprise.team.delete(uuid);
      setSelectedTeam(null);
      void loadTabData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team");
    }
  }, [loadTabData]);

  const deleteRole = useCallback(async (uuid: string, name: string) => {
    if (!window.confirm(`Delete role "${name}"?`)) return;
    try {
      await window.artworks.enterprise.role.delete(uuid);
      setSelectedRole(null);
      void loadTabData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    }
  }, [loadTabData]);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  // ── Loading state ──
  if (loading) {
    return (
      <div className="enterprise">
        <p style={{ color: "var(--text-secondary)" }}>Loading enterprise data...</p>
      </div>
    );
  }

  // ── Error banner ──
  const renderError = () =>
    error ? (
      <div className="enterprise__error">
        <span>{error}</span>
        <button onClick={() => setError(null)} className="enterprise__dismiss">
          Dismiss
        </button>
      </div>
    ) : null;

  // ── Team detail view ──
  if (selectedTeam) {
    return (
      <div className="enterprise">
        <div className="enterprise__header">
          <button onClick={() => setSelectedTeam(null)} className="enterprise-back">
            Back
          </button>
          <h2 className="enterprise__title">{selectedTeam.name}</h2>
          <span className="enterprise-badge">{selectedTeam.memberCount} members</span>
        </div>
        {renderError()}
        <div className="enterprise-detail">
          <p className="enterprise-detail__desc">{selectedTeam.description || "No description"}</p>
          <div className="enterprise-detail__meta">
            <span>Slug: {selectedTeam.slug}</span>
            <span>Created: {formatDate(selectedTeam.createdAt)}</span>
          </div>
          <div className="enterprise-detail__section">
            <h3>Members</h3>
            {selectedTeam.members.length === 0 ? (
              <p className="enterprise-empty">No members yet.</p>
            ) : (
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTeam.members.map((m) => (
                    <tr key={m.uuid}>
                      <td>{m.userUuid}</td>
                      <td><span className="enterprise-badge">{m.role}</span></td>
                      <td>{formatDate(m.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="enterprise-detail__actions">
            <button onClick={() => void deleteTeam(selectedTeam.uuid, selectedTeam.name)} className="enterprise-btn enterprise-btn--danger">
              Delete Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Role detail view ──
  if (selectedRole) {
    return (
      <div className="enterprise">
        <div className="enterprise__header">
          <button onClick={() => setSelectedRole(null)} className="enterprise-back">
            Back
          </button>
          <h2 className="enterprise__title">{selectedRole.name}</h2>
          {selectedRole.isSystem && <span className="enterprise-badge enterprise-badge--system">System</span>}
        </div>
        {renderError()}
        <div className="enterprise-detail">
          <p className="enterprise-detail__desc">{selectedRole.description || "No description"}</p>
          <div className="enterprise-detail__meta">
            <span>Permissions: {selectedRole.permissionCount}</span>
            <span>Users: {selectedRole.userCount}</span>
            <span>Created: {formatDate(selectedRole.createdAt)}</span>
          </div>
          <div className="enterprise-detail__actions">
            <button onClick={() => void deleteRole(selectedRole.uuid, selectedRole.name)} className="enterprise-btn enterprise-btn--danger">
              Delete Role
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab view ──
  return (
    <div className="enterprise">
      <div className="enterprise__header">
        <h2 className="enterprise__title">Enterprise</h2>
        <div className="enterprise__tabs">
          <button className={`enterprise__tab ${tab === "teams" ? "enterprise__tab--active" : ""}`} onClick={() => setTab("teams")}>Teams</button>
          <button className={`enterprise__tab ${tab === "roles" ? "enterprise__tab--active" : ""}`} onClick={() => setTab("roles")}>Roles</button>
          <button className={`enterprise__tab ${tab === "audit" ? "enterprise__tab--active" : ""}`} onClick={() => setTab("audit")}>Audit Log</button>
          <button className={`enterprise__tab ${tab === "license" ? "enterprise__tab--active" : ""}`} onClick={() => setTab("license")}>License</button>
        </div>
      </div>

      {renderError()}

      {/* ── Teams tab ── */}
      {tab === "teams" && (
        <div className="enterprise-section">
          <div className="enterprise-section__header">
            <h3>Teams</h3>
            <button onClick={() => void createTeam()} className="enterprise-btn enterprise-btn--primary">New Team</button>
          </div>
          {teamStats && (
            <div className="enterprise-stats">
              <span>{teamStats.total} teams</span>
              <span>{teamStats.members} total members</span>
            </div>
          )}
          {teams.length === 0 ? (
            <p className="enterprise-empty">No teams yet. Create one to get started.</p>
          ) : (
            <div className="enterprise-list">
              {teams.map((team) => (
                <div
                  key={team.uuid}
                  className="enterprise-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    void (async () => {
                      const detail = await window.artworks.enterprise.team.get(team.uuid);
                      setSelectedTeam(detail as TeamWithMembers);
                    })();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void (async () => {
                        const detail = await window.artworks.enterprise.team.get(team.uuid);
                        setSelectedTeam(detail as TeamWithMembers);
                      })();
                    }
                  }}
                >
                  <div className="enterprise-card__info">
                    <h4 className="enterprise-card__name">{team.name}</h4>
                    <span className="enterprise-card__slug">{team.slug}</span>
                  </div>
                  <div className="enterprise-card__meta">
                    <span>{team.memberCount} members</span>
                    <span>{formatDate(team.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Roles tab ── */}
      {tab === "roles" && (
        <div className="enterprise-section">
          <div className="enterprise-section__header">
            <h3>Roles</h3>
            <button onClick={() => void createRole()} className="enterprise-btn enterprise-btn--primary">New Role</button>
          </div>
          {roleStats && (
            <div className="enterprise-stats">
              <span>{roleStats.total} roles</span>
              <span>{roleStats.system} system</span>
            </div>
          )}
          {roles.length === 0 ? (
            <p className="enterprise-empty">No roles yet. Create one to get started.</p>
          ) : (
            <div className="enterprise-list">
              {roles.map((role) => (
                <div
                  key={role.uuid}
                  className="enterprise-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRole(role)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelectedRole(role);
                  }}
                >
                  <div className="enterprise-card__info">
                    <h4 className="enterprise-card__name">{role.name}</h4>
                    {role.isSystem && <span className="enterprise-badge enterprise-badge--system">System</span>}
                  </div>
                  <div className="enterprise-card__meta">
                    <span>{role.permissionCount} permissions</span>
                    <span>{role.userCount} users</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Audit log tab ── */}
      {tab === "audit" && (
        <div className="enterprise-section">
          <div className="enterprise-section__header">
            <h3>Audit Log</h3>
          </div>
          {auditEntries.length === 0 ? (
            <p className="enterprise-empty">No audit entries yet.</p>
          ) : (
            <>
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>User</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => (
                    <tr key={entry.uuid}>
                      <td><span className="enterprise-badge">{entry.action}</span></td>
                      <td>{entry.resourceType}{entry.resourceUuid ? ` (${entry.resourceUuid.slice(0, 8)})` : ""}</td>
                      <td>{entry.userUuid ?? "system"}</td>
                      <td>{formatDate(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="enterprise-pagination">
                <button
                  disabled={auditPage === 0}
                  onClick={() => setAuditPage((p) => p - 1)}
                  className="enterprise-btn"
                >
                  Previous
                </button>
                <span>Page {auditPage + 1}</span>
                <button
                  disabled={auditEntries.length < PAGE_SIZE}
                  onClick={() => setAuditPage((p) => p + 1)}
                  className="enterprise-btn"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── License tab ── */}
      {tab === "license" && (
        <div className="enterprise-section">
          <div className="enterprise-section__header">
            <h3>License</h3>
          </div>
          {!activeLicense ? (
            <div className="enterprise-empty">
              <p>No active license found.</p>
              <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>Contact your administrator to set up a license.</p>
            </div>
          ) : (
            <div className="enterprise-license">
              <div className="enterprise-license__header">
                <h4>{activeLicense.type}</h4>
                <span className={`enterprise-badge ${activeLicense.isActive ? "enterprise-badge--active" : "enterprise-badge--inactive"}`}>
                  {activeLicense.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="enterprise-license__meta">
                <div className="enterprise-license__item">
                  <span>Holder</span>
                  <span>{activeLicense.holderName ?? "N/A"}</span>
                </div>
                <div className="enterprise-license__item">
                  <span>Email</span>
                  <span>{activeLicense.holderEmail ?? "N/A"}</span>
                </div>
                <div className="enterprise-license__item">
                  <span>Max Users</span>
                  <span>{activeLicense.maxUsers ?? "Unlimited"}</span>
                </div>
                <div className="enterprise-license__item">
                  <span>Max Projects</span>
                  <span>{activeLicense.maxProjects ?? "Unlimited"}</span>
                </div>
                <div className="enterprise-license__item">
                  <span>Activated</span>
                  <span>{activeLicense.activatedAt ? formatDate(activeLicense.activatedAt) : "N/A"}</span>
                </div>
                <div className="enterprise-license__item">
                  <span>Expires</span>
                  <span>{activeLicense.expiresAt ? formatDate(activeLicense.expiresAt) : "Never"}</span>
                </div>
              </div>
              {activeLicense.features && (
                <div className="enterprise-license__features">
                  <h5>Features</h5>
                  <div className="enterprise-license__feature-list">
                    {activeLicense.features.split(",").map((f) => (
                      <span key={f} className="enterprise-badge">{f.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

panelRegistry.register({
  id: "enterprise",
  title: "Enterprise",
  icon: "\u{1f3e2}", // 🏢
  component: EnterprisePanel,
  defaultSlot: "right",
  defaultVisible: false,
});
