/**
 * Production Dashboard panel.
 *
 * Shows summary statistics from the database: project count, asset
 * count, document count, and assets broken down by type.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface DashboardStats {
  projectCount: number;
  assetCount: number;
  documentCount: number;
  entityCount: number;
  assetsByType: Record<string, number>;
}

export function DashboardPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    void window.artworks.production.stats().then((s) => setStats(s as DashboardStats));
  }, []);

  if (!stats) return <div className="dashboard">Loading…</div>;

  return (
    <div className="dashboard">
      <h2 className="dashboard__title">Production Dashboard</h2>
      <div className="dashboard__grid">
        <div className="dashboard__card">
          <span className="dashboard__card-value">{stats.projectCount}</span>
          <span className="dashboard__card-label">Projects</span>
        </div>
        <div className="dashboard__card">
          <span className="dashboard__card-value">{stats.assetCount}</span>
          <span className="dashboard__card-label">Assets</span>
        </div>
        <div className="dashboard__card">
          <span className="dashboard__card-value">{stats.documentCount}</span>
          <span className="dashboard__card-label">Documents</span>
        </div>
        <div className="dashboard__card">
          <span className="dashboard__card-value">{stats.entityCount}</span>
          <span className="dashboard__card-label">Entities</span>
        </div>
      </div>
      {Object.keys(stats.assetsByType).length > 0 && (
        <div className="dashboard__section">
          <h3 className="dashboard__section-title">Assets by Type</h3>
          <div className="dashboard__bars">
            {Object.entries(stats.assetsByType).map(([type, count]) => (
              <div key={type} className="dashboard__bar">
                <span className="dashboard__bar-label">{type}</span>
                <div className="dashboard__bar-track">
                  <div
                    className="dashboard__bar-fill"
                    style={{ width: `${(count / stats.assetCount) * 100}%` }}
                  />
                </div>
                <span className="dashboard__bar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

panelRegistry.register({
  id: "dashboard",
  title: "Dashboard",
  icon: "\u{1f4ca}", // 📊
  component: DashboardPanel,
  defaultSlot: "center",
  defaultVisible: false,
});