/**
 * Collaboration panel.
 *
 * Shows team members, activity feed, and comments across the production.
 */
import { useCallback, useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface User {
  uuid: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member" | "viewer";
  isActive: boolean;
  createdAt: string;
}

interface ActivityEntry {
  uuid: string;
  userUuid?: string;
  entityUuid?: string;
  action: string;
  entityType: string;
  details: Record<string, unknown>;
  createdAt: string;
}

interface Comment {
  uuid: string;
  userUuid?: string;
  entityUuid: string;
  body: string;
  parentUuid?: string;
  resolved: boolean;
  createdAt: string;
}

type Tab = "team" | "activity" | "comments";

const ACTION_LABELS: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  comment: "commented on",
  assign: "assigned",
  status_change: "changed status of",
};

export function CollaborationPanel() {
  const [tab, setTab] = useState<Tab>("team");
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("member");

  const loadUsers = useCallback(async () => {
    const list = await window.artworks.production.user.list();
    setUsers(list as User[]);
  }, []);

  const loadActivities = useCallback(async () => {
    const list = await window.artworks.production.activity.list(undefined, 50);
    setActivities(list as ActivityEntry[]);
  }, []);

  const loadComments = useCallback(async () => {
    const list = await window.artworks.production.comment.listRecent(50);
    setComments(list as Comment[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadUsers(), loadActivities(), loadComments()])
      .finally(() => setLoading(false));
  }, [loadUsers, loadActivities, loadComments]);

  const handleCreateUser = async () => {
    if (!newUserName.trim()) return;
    await window.artworks.production.user.create({
      displayName: newUserName.trim(),
      email: newUserEmail.trim() || undefined,
      role: newUserRole,
    });
    setNewUserName("");
    setNewUserEmail("");
    setNewUserRole("member");
    setShowCreateUser(false);
    await loadUsers();
  };

  const handleDeleteUser = async (uuid: string) => {
    await window.artworks.production.user.delete(uuid);
    await loadUsers();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "team", label: "Team" },
    { key: "activity", label: "Activity" },
    { key: "comments", label: "Comments" },
  ];

  return (
    <div className="collaboration">
      <h2 className="collaboration__title">Collaboration</h2>

      <div className="collaboration__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`collaboration__tab ${tab === t.key ? "collaboration__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="collaboration__loading">Loading…</div>}

      {!loading && tab === "team" && (
        <div className="collaboration__section">
          <div className="collaboration__section-header">
            <h3 className="collaboration__section-title">Team Members ({users.length})</h3>
            <button
              className="collaboration__btn collaboration__btn--primary"
              onClick={() => setShowCreateUser(true)}
            >
              + Add
            </button>
          </div>

          {showCreateUser && (
            <div className="collaboration__form">
              <input
                className="collaboration__input"
                placeholder="Display name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
              <input
                className="collaboration__input"
                placeholder="Email (optional)"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
              <select
                className="collaboration__select"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <div className="collaboration__form-actions">
                <button className="collaboration__btn" onClick={() => setShowCreateUser(false)}>
                  Cancel
                </button>
                <button className="collaboration__btn collaboration__btn--primary" onClick={handleCreateUser}>
                  Create
                </button>
              </div>
            </div>
          )}

          {users.length === 0 ? (
            <div className="collaboration__empty">No team members yet.</div>
          ) : (
            <div className="collaboration__user-list">
              {users.map((user) => (
                <div key={user.uuid} className="collaboration__user">
                  <div className="collaboration__user-avatar">
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.displayName} />
                      : <span className="collaboration__user-initials">
                          {user.displayName.slice(0, 2).toUpperCase()}
                        </span>
                    }
                  </div>
                  <div className="collaboration__user-info">
                    <span className="collaboration__user-name">{user.displayName}</span>
                    <span className="collaboration__user-role">{user.role}</span>
                    {user.email && <span className="collaboration__user-email">{user.email}</span>}
                  </div>
                  <span className={`collaboration__user-status ${user.isActive ? "collaboration__user-status--active" : ""}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                  <button
                    className="collaboration__btn collaboration__btn--danger"
                    onClick={() => handleDeleteUser(user.uuid)}
                    title="Remove user"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === "activity" && (
        <div className="collaboration__section">
          <h3 className="collaboration__section-title">Recent Activity</h3>
          {activities.length === 0 ? (
            <div className="collaboration__empty">No activity yet.</div>
          ) : (
            <div className="collaboration__activity-list">
              {activities.map((entry) => (
                <div key={entry.uuid} className="collaboration__activity">
                  <span className="collaboration__activity-action">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="collaboration__activity-entity">
                    {entry.entityType}
                  </span>
                  {entry.entityUuid && (
                    <span className="collaboration__activity-uuid">
                      {entry.entityUuid.slice(0, 8)}
                    </span>
                  )}
                  <span className="collaboration__activity-time">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === "comments" && (
        <div className="collaboration__section">
          <h3 className="collaboration__section-title">Recent Comments</h3>
          {comments.length === 0 ? (
            <div className="collaboration__empty">No comments yet.</div>
          ) : (
            <div className="collaboration__comment-list">
              {comments.map((comment) => (
                <div key={comment.uuid} className={`collaboration__comment ${comment.resolved ? "collaboration__comment--resolved" : ""}`}>
                  <div className="collaboration__comment-meta">
                    <span className="collaboration__comment-entity">
                      {comment.entityUuid.slice(0, 8)}
                    </span>
                    <span className="collaboration__comment-time">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                    {comment.resolved && <span className="collaboration__comment-resolved">Resolved</span>}
                  </div>
                  <div className="collaboration__comment-body">{comment.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

panelRegistry.register({
  id: "collaboration",
  title: "Collaboration",
  icon: "\u{1f465}", // 👥
  component: CollaborationPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
