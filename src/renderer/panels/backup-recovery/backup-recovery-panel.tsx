/**
 * Backup & Recovery panel.
 *
 * Database backup/restore, production export/import, crash recovery points,
 * and backup stats. Phase 18.3.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { panelRegistry } from "../../workspace/registry.js";


interface BackupMeta {
  uuid: string;
  type: string;
  label: string;
  backupPath: string;
  sizeBytes: number;
  createdAt: string;
}

interface BackupStats {
  totalBackups: number;
  totalSizeBytes: number;
  oldestBackup: string | null;
  newestBackup: string | null;
  recoveryPoints: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles: Record<string, any> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "var(--font-family, system-ui, sans-serif)",
    fontSize: "var(--font-size, 13px)",
    color: "var(--text-primary, #e5e5e5)",
    backgroundColor: "var(--bg-primary, #1a1a2e)",
  },
  section: {
    padding: "12px",
    borderBottom: "1px solid var(--border-color, #333)",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--text-secondary, #999)",
    marginBottom: 8,
  },
  btn: {
    padding: "6px 12px",
    borderRadius: 4,
    border: "none",
    background: "var(--accent, #6366f1)",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "6px 12px",
    borderRadius: 4,
    border: "1px solid #ef4444",
    background: "transparent",
    color: "#ef4444",
    fontSize: 12,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "6px 12px",
    borderRadius: 4,
    border: "1px solid var(--border-color, #333)",
    background: "transparent",
    color: "var(--text-secondary, #999)",
    fontSize: 12,
    cursor: "pointer",
  },
  btnRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    marginBottom: 8,
  },
  backupItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid var(--border-color, #333)",
    fontSize: 12,
  },
  backupInfo: {
    flex: 1,
  },
  backupLabel: {
    fontWeight: 500,
  },
  backupMeta: {
    fontSize: 11,
    color: "var(--text-tertiary, #666)",
    marginTop: 2,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
    fontSize: 12,
  },
  statCard: {
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid var(--border-color, #333)",
    background: "var(--bg-secondary, #16213e)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-primary, #e5e5e5)",
  },
  statLabel: {
    fontSize: 10,
    color: "var(--text-tertiary, #666)",
    marginTop: 2,
  },
  empty: {
    padding: 20,
    textAlign: "center" as const,
    color: "var(--text-tertiary, #666)",
    fontSize: 12,
  },
  exportArea: {
    width: "100%",
    minHeight: 60,
    padding: 8,
    borderRadius: 4,
    border: "1px solid var(--border-color, #333)",
    background: "var(--bg-secondary, #16213e)",
    color: "var(--text-primary, #e5e5e5)",
    fontSize: 11,
    fontFamily: "monospace",
    resize: "vertical" as const,
    marginTop: 8,
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function BackupRecoveryPanel(): ReactElement {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const b = await window.artworks.backup.list() as BackupMeta[];
      setBackups(b);
      const s = await window.artworks.backup.stats() as BackupStats;
      setStats(s);
    } catch {
      /* not wired yet */
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createBackup = async () => {
    setLoading(true);
    try {
      await window.artworks.backup.create("manual", `Manual backup`);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const deleteBackup = async (uuid: string) => {
    await window.artworks.backup.delete(uuid);
    refresh();
  };

  const recoverLatest = async () => {
    if (!window.confirm("Recover from the latest recovery point? This will overwrite the current database.")) return;
    setLoading(true);
    try {
      const r = await window.artworks.backup["recover-latest"]() as { success: boolean };
      if (r.success) window.alert("Recovery complete. Please restart the application.");
      else window.alert("No recovery points available.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.root}>
        {/* Backup Actions */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Actions</div>
          <div style={styles.btnRow}>
            <button style={styles.btn} onClick={createBackup} disabled={loading}>
              {loading ? "Working..." : "Create Backup"}
            </button>
            <button style={styles.btnDanger} onClick={recoverLatest} disabled={loading}>
              Recover Latest
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Overview</div>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.totalBackups}</div>
                <div style={styles.statLabel}>Backups</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{formatSize(stats.totalSizeBytes)}</div>
                <div style={styles.statLabel}>Total Size</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.recoveryPoints}</div>
                <div style={styles.statLabel}>Recovery Points</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.newestBackup ? timeAgo(stats.newestBackup) : "Never"}</div>
                <div style={styles.statLabel}>Last Backup</div>
              </div>
            </div>
          </div>
        )}

        {/* Backup List */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Backups</div>
          {backups.length === 0 ? (
            <div style={styles.empty}>No backups yet</div>
          ) : (
            backups.map(b => (
              <div key={b.uuid} style={styles.backupItem}>
                <div style={styles.backupInfo}>
                  <div style={styles.backupLabel}>{b.label}</div>
                  <div style={styles.backupMeta}>
                    {b.type} | {formatSize(b.sizeBytes)} | {timeAgo(b.createdAt)}
                  </div>
                </div>
                <button
                  style={styles.btnSecondary}
                  onClick={() => deleteBackup(b.uuid)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
  );
}

panelRegistry.register({
  id: "backup-recovery",
  title: "Backup & Recovery",
  icon: "\u{1f6e1}", // 🛡️
  component: BackupRecoveryPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
