/**
 * Studio panel.
 *
 * Dashboard for studio operations: departments, approvals, and reviews.
 */
import { useCallback, useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Department {
  uuid: string;
  name: string;
  description: string;
  leadUuid?: string;
  createdAt: string;
}

interface Approval {
  uuid: string;
  entityUuid: string;
  requesterUuid: string;
  approverUuid: string;
  status: "pending" | "approved" | "rejected";
  notes: string;
  createdAt: string;
}

interface Review {
  uuid: string;
  entityUuid: string;
  reviewerUuid: string;
  status: "pending" | "in_progress" | "completed";
  rating?: number;
  feedback: string;
  createdAt: string;
}

interface StudioStats {
  departments: { total: number; members: number };
  approvals: { total: number; pending: number; approved: number; rejected: number };
  reviews: { total: number; pending: number; inProgress: number; completed: number; avgRating: number };
}

type Tab = "overview" | "departments" | "approvals" | "reviews";

const STATUS_COLORS: Record<string, string> = {
  pending: "#e2b714",
  approved: "#2cb67d",
  rejected: "#e53170",
  in_progress: "#7f5af0",
  completed: "#2cb67d",
};

export function StudioPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");

  const loadStats = useCallback(async () => {
    const [deptStats, approvalStats, reviewStats] = await Promise.all([
      window.artworks.production.department.stats(),
      window.artworks.production.approval.stats(),
      window.artworks.production.review.stats(),
    ]);
    setStats({
      departments: deptStats as StudioStats["departments"],
      approvals: approvalStats as StudioStats["approvals"],
      reviews: reviewStats as StudioStats["reviews"],
    });
  }, []);

  const loadDepartments = useCallback(async () => {
    const list = await window.artworks.production.department.list();
    setDepartments(list as Department[]);
  }, []);

  const loadApprovals = useCallback(async () => {
    const list = await window.artworks.production.approval.list();
    setApprovals(list as Approval[]);
  }, []);

  const loadReviews = useCallback(async () => {
    const list = await window.artworks.production.review.list();
    setReviews(list as Review[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadDepartments(), loadApprovals(), loadReviews()])
      .finally(() => setLoading(false));
  }, [loadStats, loadDepartments, loadApprovals, loadReviews]);

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    await window.artworks.production.department.create({
      name: newDeptName.trim(),
      description: newDeptDesc.trim() || undefined,
    });
    setNewDeptName("");
    setNewDeptDesc("");
    setShowCreateDept(false);
    await Promise.all([loadDepartments(), loadStats()]);
  };

  const handleDeleteDepartment = async (uuid: string) => {
    await window.artworks.production.department.delete(uuid);
    await Promise.all([loadDepartments(), loadStats()]);
  };

  const handleApprovalStatus = async (uuid: string, status: string) => {
    await window.artworks.production.approval.updateStatus(uuid, status);
    await Promise.all([loadApprovals(), loadStats()]);
  };

  const handleReviewUpdate = async (uuid: string, status: string) => {
    await window.artworks.production.review.update(uuid, { status });
    await Promise.all([loadReviews(), loadStats()]);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "departments", label: "Departments" },
    { key: "approvals", label: "Approvals" },
    { key: "reviews", label: "Reviews" },
  ];

  return (
    <div className="studio">
      <h2 className="studio__title">Studio</h2>

      <div className="studio__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`studio__tab ${tab === t.key ? "studio__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="studio__loading">Loading…</div>}

      {!loading && tab === "overview" && stats && (
        <div className="studio__overview">
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.departments.total}</span>
            <span className="studio__stat-label">Departments</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.departments.members}</span>
            <span className="studio__stat-label">Members</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.approvals.pending}</span>
            <span className="studio__stat-label">Pending Approvals</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.reviews.pending}</span>
            <span className="studio__stat-label">Pending Reviews</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.reviews.avgRating.toFixed(1)}</span>
            <span className="studio__stat-label">Avg Rating</span>
          </div>
        </div>
      )}

      {!loading && tab === "departments" && (
        <div className="studio__section">
          <div className="studio__section-header">
            <h3 className="studio__section-title">Departments ({departments.length})</h3>
            <button
              className="studio__btn studio__btn--primary"
              onClick={() => setShowCreateDept(true)}
            >
              + Add
            </button>
          </div>

          {showCreateDept && (
            <div className="studio__form">
              <input
                className="studio__input"
                placeholder="Department name"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
              />
              <input
                className="studio__input"
                placeholder="Description (optional)"
                value={newDeptDesc}
                onChange={(e) => setNewDeptDesc(e.target.value)}
              />
              <div className="studio__form-actions">
                <button className="studio__btn" onClick={() => setShowCreateDept(false)}>
                  Cancel
                </button>
                <button className="studio__btn studio__btn--primary" onClick={handleCreateDepartment}>
                  Create
                </button>
              </div>
            </div>
          )}

          {departments.length === 0 ? (
            <div className="studio__empty">No departments yet.</div>
          ) : (
            <div className="studio__list">
              {departments.map((dept) => (
                <div key={dept.uuid} className="studio__item">
                  <div className="studio__item-info">
                    <span className="studio__item-name">{dept.name}</span>
                    {dept.description && (
                      <span className="studio__item-desc">{dept.description}</span>
                    )}
                  </div>
                  <button
                    className="studio__btn studio__btn--danger"
                    onClick={() => handleDeleteDepartment(dept.uuid)}
                    title="Delete department"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === "approvals" && (
        <div className="studio__section">
          <h3 className="studio__section-title">Approvals ({approvals.length})</h3>
          {approvals.length === 0 ? (
            <div className="studio__empty">No approvals yet.</div>
          ) : (
            <div className="studio__list">
              {approvals.map((a) => (
                <div key={a.uuid} className="studio__item">
                  <div className="studio__item-info">
                    <span className="studio__item-name">
                      Entity {a.entityUuid.slice(0, 8)}
                    </span>
                    <span className="studio__item-desc">
                      Requested by {a.requesterUuid.slice(0, 8)}
                    </span>
                  </div>
                  <span
                    className="studio__badge"
                    style={{ backgroundColor: STATUS_COLORS[a.status] ?? "#666" }}
                  >
                    {a.status}
                  </span>
                  {a.status === "pending" && (
                    <div className="studio__item-actions">
                      <button
                        className="studio__btn studio__btn--success"
                        onClick={() => handleApprovalStatus(a.uuid, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="studio__btn studio__btn--danger"
                        onClick={() => handleApprovalStatus(a.uuid, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === "reviews" && (
        <div className="studio__section">
          <h3 className="studio__section-title">Reviews ({reviews.length})</h3>
          {reviews.length === 0 ? (
            <div className="studio__empty">No reviews yet.</div>
          ) : (
            <div className="studio__list">
              {reviews.map((r) => (
                <div key={r.uuid} className="studio__item">
                  <div className="studio__item-info">
                    <span className="studio__item-name">
                      Entity {r.entityUuid.slice(0, 8)}
                    </span>
                    <span className="studio__item-desc">
                      Reviewer {r.reviewerUuid.slice(0, 8)}
                      {r.rating !== undefined && ` · Rating: ${r.rating}/5`}
                    </span>
                  </div>
                  <span
                    className="studio__badge"
                    style={{ backgroundColor: STATUS_COLORS[r.status] ?? "#666" }}
                  >
                    {r.status}
                  </span>
                  {r.status === "pending" && (
                    <button
                      className="studio__btn"
                      onClick={() => handleReviewUpdate(r.uuid, "in_progress")}
                    >
                      Start
                    </button>
                  )}
                  {r.status === "in_progress" && (
                    <button
                      className="studio__btn studio__btn--success"
                      onClick={() => handleReviewUpdate(r.uuid, "completed")}
                    >
                      Complete
                    </button>
                  )}
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
  id: "studio",
  title: "Studio",
  icon: "\u{1f3ad}", // 🎭
  component: StudioPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
