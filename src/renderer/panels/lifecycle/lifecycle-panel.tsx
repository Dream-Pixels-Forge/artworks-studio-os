/**
 * Production Lifecycle panel.
 *
 * Formal production lifecycle state machine: draft → active → review →
 * published → archived. Shows current states, allows transitions with
 * guards, and displays the full audit trail.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { panelRegistry } from "../../workspace/registry.js";

type ArtworksApi = Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

type LifecycleState = "draft" | "active" | "review" | "published" | "archived";

interface ProductionLifecycle {
  uuid: string;
  entityUuid: string;
  state: LifecycleState;
  enteredAt: string;
  enteredBy: string | null;
  guardData: string;
  createdAt: string;
  updatedAt: string;
}

interface LifecycleTransition {
  uuid: string;
  entityUuid: string;
  fromState: LifecycleState;
  toState: LifecycleState;
  triggeredBy: string | null;
  reason: string;
  guardData: string;
  createdAt: string;
}

interface LifecycleStats {
  total: number;
  byState: Record<string, number>;
  transitionsToday: number;
  avgTimeInStateHours: number;
}

type Tab = "states" | "history" | "stats";

const STATE_COLORS: Record<string, string> = {
  draft: "#6b7280",
  active: "#3b82f6",
  review: "#f59e0b",
  published: "#10b981",
  archived: "#8b5cf6",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles: Record<string, any> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg-primary, #0f0f0f)",
    color: "var(--text-primary, #e0e0e0)",
    fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
    fontSize: 13,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-color, #2a2a2a)",
    flexShrink: 0,
  },
  title: { fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" },
  refreshBtn: {
    padding: "4px 10px",
    border: "1px solid var(--border-color, #2a2a2a)",
    borderRadius: 4,
    background: "transparent",
    color: "var(--text-secondary, #999)",
    cursor: "pointer",
    fontSize: 12,
  },
  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid var(--border-color, #2a2a2a)",
    flexShrink: 0,
  },
  tab: (active: boolean) => ({
    padding: "8px 16px",
    border: "none",
    borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--text-primary, #e0e0e0)" : "var(--text-secondary, #999)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    transition: "color 0.15s, border-color 0.15s",
  }),
  content: { flex: 1, overflow: "auto", padding: 16 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 20,
  },
  card: {
    background: "var(--bg-secondary, #1a1a1a)",
    border: "1px solid var(--border-color, #2a2a2a)",
    borderRadius: 8,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  cardLabel: { fontSize: 11, color: "var(--text-secondary, #999)", textTransform: "uppercase", letterSpacing: "0.05em" },
  cardValue: { fontSize: 20, fontWeight: 600 },
  sectionTitle: { fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text-primary, #e0e0e0)" },
  stateRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: "var(--bg-secondary, #1a1a1a)",
    border: "1px solid var(--border-color, #2a2a2a)",
    borderRadius: 6,
    marginBottom: 8,
  },
  stateInfo: { display: "flex", flexDirection: "column", gap: 2 },
  stateName: { fontWeight: 500 },
  stateId: { fontSize: 11, color: "var(--text-secondary, #999)" },
  badge: (color: string) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    color: "#fff",
    background: color,
  }),
  actions: { display: "flex", gap: 6 },
  actionBtn: (color: string) => ({
    padding: "4px 10px",
    border: "none",
    borderRadius: 4,
    background: color,
    color: "#fff",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 500,
  }),
  historyRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 14px",
    borderBottom: "1px solid var(--border-color, #2a2a2a)",
    fontSize: 12,
  },
  transitionArrow: { color: "var(--text-secondary, #999)", fontWeight: 500, minWidth: 90, textAlign: "center" as const },
  reason: { color: "var(--text-secondary, #999)", fontStyle: "italic", flex: 1 },
  timestamp: { color: "var(--text-tertiary, #666)", fontSize: 11, flexShrink: 0 },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid var(--border-color, #2a2a2a)",
    fontSize: 12,
  },
  statLabel: { color: "var(--text-secondary, #999)" },
  emptyState: {
    textAlign: "center" as const,
    color: "var(--text-secondary, #999)",
    padding: 40,
    fontSize: 13,
  },
};

function StateBadge({ state }: { state: string }): ReactElement {
  return <span style={styles.badge(STATE_COLORS[state] ?? "#6b7280")}>{state}</span>;
}

function StatsTab({ stats }: { stats: LifecycleStats | null }): ReactElement {
  if (!stats) return <div style={styles.emptyState}>No data yet</div>;
  return (
    <div>
      <div style={styles.grid}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Total Productions</span>
          <span style={styles.cardValue}>{stats.total}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Transitions Today</span>
          <span style={styles.cardValue}>{stats.transitionsToday}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Avg Time in State</span>
          <span style={styles.cardValue}>{stats.avgTimeInStateHours}h</span>
        </div>
      </div>
      <div style={styles.sectionTitle}>By State</div>
      {Object.entries(stats.byState).map(([state, count]) => (
        <div key={state} style={styles.statRow}>
          <StateBadge state={state} />
          <span style={styles.statLabel}>{count} production{count !== 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ transitions }: { transitions: LifecycleTransition[] }): ReactElement {
  if (transitions.length === 0) return <div style={styles.emptyState}>No transitions recorded</div>;
  return (
    <div>
      {transitions.map((t) => (
        <div key={t.uuid} style={styles.historyRow}>
          <StateBadge state={t.fromState} />
          <span style={styles.transitionArrow}>→</span>
          <StateBadge state={t.toState} />
          {t.reason && <span style={styles.reason}>{'\u201c'}{t.reason}{'\u201d'}</span>}
          <span style={styles.timestamp}>
            {new Date(t.createdAt).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatesTab({
  lifecycles,
  onTransition,
}: {
  lifecycles: ProductionLifecycle[];
  onTransition: (entityUuid: string, to: LifecycleState) => void;
}): ReactElement {
  const VALID: Record<string, string[]> = {
    draft: ["active"],
    active: ["review", "archived"],
    review: ["published", "active"],
    published: ["archived"],
    archived: [],
  };

  if (lifecycles.length === 0) return <div style={styles.emptyState}>No lifecycle entries. Create a production to start.</div>;
  return (
    <div>
      {lifecycles.map((lc) => {
        const targets = VALID[lc.state] ?? [];
        return (
          <div key={lc.uuid} style={styles.stateRow}>
            <div style={styles.stateInfo}>
              <span style={styles.stateName}>
                <StateBadge state={lc.state} />
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-secondary, #999)" }}>
                  {lc.entityUuid.slice(0, 8)}…
                </span>
              </span>
              <span style={styles.stateId}>
                Entered {new Date(lc.enteredAt).toLocaleString()}
              </span>
            </div>
            <div style={styles.actions}>
              {targets.map((t) => (
                <button
                  key={t}
                  style={styles.actionBtn(STATE_COLORS[t] ?? "#6b7280")}
                  onClick={() => onTransition(lc.entityUuid, t as LifecycleState)}
                >
                  → {t}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LifecyclePanel(): ReactElement {
  const [tab, setTab] = useState<Tab>("states");
  const [lifecycles, setLifecycles] = useState<ProductionLifecycle[]>([]);
  const [transitions, setTransitions] = useState<LifecycleTransition[]>([]);
  const [stats, setStats] = useState<LifecycleStats | null>(null);

  const w = window as unknown as { artworks: ArtworksApi };
  const api = w.artworks;

  const loadStates = useCallback(async () => {
    const data = await api.lifecycle.list();
    setLifecycles(data as ProductionLifecycle[]);
  }, [api]);

  const loadHistory = useCallback(async () => {
    const data = await api.lifecycle["all-transitions"]();
    setTransitions(data as LifecycleTransition[]);
  }, [api]);

  const loadStats = useCallback(async () => {
    const data = await api.lifecycle.stats();
    setStats(data as LifecycleStats);
  }, [api]);

  useEffect(() => {
    if (tab === "states") loadStates();
    else if (tab === "history") loadHistory();
    else loadStats();
  }, [tab, loadStates, loadHistory, loadStats]);

  const handleTransition = useCallback(
    async (entityUuid: string, toState: LifecycleState) => {
      await api.lifecycle.transition(entityUuid, toState);
      loadStates();
    },
    [api, loadStates]
  );

  const refresh = useCallback(() => {
    if (tab === "states") loadStates();
    else if (tab === "history") loadHistory();
    else loadStats();
  }, [tab, loadStates, loadHistory, loadStats]);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>Production Lifecycle</span>
        <button style={styles.refreshBtn} onClick={refresh}>
          Refresh
        </button>
      </div>
      <div style={styles.tabs}>
        {(["states", "history", "stats"] as Tab[]).map((t) => (
          <button key={t} style={styles.tab(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div style={styles.content}>
        {tab === "states" && <StatesTab lifecycles={lifecycles} onTransition={handleTransition} />}
        {tab === "history" && <HistoryTab transitions={transitions} />}
        {tab === "stats" && <StatsTab stats={stats} />}
      </div>
    </div>
  );
}

panelRegistry.register({
  id: "lifecycle",
  title: "Production Lifecycle",
  icon: "🔄",
  component: LifecyclePanel,
  defaultSlot: "center",
  defaultVisible: false,
});
