/**
 * Production Intelligence Panel.
 *
 * Cross-cutting analytics dashboard with 4 tabs:
 * Overview, Timeline, Team, and AI.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { panelRegistry } from "../../workspace/registry.js";

type ArtworksApi = Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

interface ProductionHealth {
  entities: number;
  projects: number;
  assets: number;
  documents: number;
  activeWorkflows: number;
  pendingApprovals: number;
  openReviews: number;
  agents: number;
  activeTasks: number;
  timelines: number;
  overdueTimelines: number;
}

interface ActivityMetrics {
  total: number;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
  byEntityType: Record<string, number>;
  timeline: Array<{ date: string; count: number }>;
}

interface TimelineAnalytics {
  total: number;
  avgProgress: number;
  overdue: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  completionRate: number;
}

interface AiUsageMetrics {
  totalTasks: number;
  completionRate: number;
  totalTokens: number;
  byModel: Record<string, number>;
  byAgent: Record<string, number>;
  failures: number;
}

interface TeamProductivity {
  totalUsers: number;
  activeUsers: number;
  byDepartment: Record<string, number>;
  topContributors: Array<{ userUuid: string; actions: number }>;
  avgApprovalTimeHours: number;
}

type Tab = "overview" | "timeline" | "team" | "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles: Record<string, any> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "var(--font-sans, system-ui)",
    fontSize: 13,
    color: "var(--text-primary, #e6edf3)",
    background: "var(--surface, #161b22)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border, #30363d)",
  },
  title: { fontWeight: 600, fontSize: 15 },
  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid var(--border, #30363d)",
  },
  tab: (active: boolean) => ({
    padding: "8px 16px",
    cursor: "pointer",
    background: active ? "var(--surface-alt, #1c2128)" : "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--accent, #58a6ff)" : "2px solid transparent",
    color: active ? "var(--text-primary, #e6edf3)" : "var(--text-secondary, #8b949e)",
    fontWeight: active ? 600 : 400,
    fontSize: 13,
  }),
  content: { flex: 1, overflow: "auto", padding: 16 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 12,
  },
  card: {
    background: "var(--surface-alt, #1c2128)",
    border: "1px solid var(--border, #30363d)",
    borderRadius: 6,
    padding: 12,
  },
  cardLabel: { fontSize: 11, color: "var(--text-secondary, #8b949e)", marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: 700 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary, #8b949e)" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    borderBottom: "1px solid var(--border, #30363d)",
  },
  refreshBtn: {
    padding: "4px 12px",
    background: "var(--surface-alt, #1c2128)",
    border: "1px solid var(--border, #30363d)",
    borderRadius: 4,
    color: "var(--text-primary, #e6edf3)",
    cursor: "pointer",
    fontSize: 12,
  },
  badge: (color: string) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: color,
    color: "#fff",
  }),
};

function StatCard({ label, value }: { label: string; value: number | string }): ReactElement {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

function KeyValueRow({ label, value, color }: { label: string; value: number | string; color?: string }): ReactElement {
  return (
    <div style={styles.row}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
    </div>
  );
}

function OverviewTab({ health, activity }: { health: ProductionHealth | null; activity: ActivityMetrics | null }): ReactElement {
  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Production Health</div>
        <div style={styles.grid}>
          <StatCard label="Entities" value={health?.entities ?? 0} />
          <StatCard label="Projects" value={health?.projects ?? 0} />
          <StatCard label="Assets" value={health?.assets ?? 0} />
          <StatCard label="Documents" value={health?.documents ?? 0} />
          <StatCard label="Timelines" value={health?.timelines ?? 0} />
          <StatCard label="Overdue" value={health?.overdueTimelines ?? 0} />
          <StatCard label="Active Workflows" value={health?.activeWorkflows ?? 0} />
          <StatCard label="Pending Approvals" value={health?.pendingApprovals ?? 0} />
          <StatCard label="Open Reviews" value={health?.openReviews ?? 0} />
          <StatCard label="Active Agents" value={health?.agents ?? 0} />
          <StatCard label="Active Tasks" value={health?.activeTasks ?? 0} />
        </div>
      </div>
      {activity && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Recent Activity ({activity.total.toLocaleString()} total)</div>
          {Object.entries(activity.byAction).slice(0, 8).map(([action, count]) => (
            <KeyValueRow key={action} label={action} value={count} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineTab({ analytics }: { analytics: TimelineAnalytics | null }): ReactElement {
  if (!analytics) return <div style={{ color: "var(--text-secondary, #8b949e)", padding: 16 }}>Loading...</div>;
  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Timeline Overview</div>
        <div style={styles.grid}>
          <StatCard label="Total Items" value={analytics.total} />
          <StatCard label="Avg Progress" value={`${analytics.avgProgress}%`} />
          <StatCard label="Overdue" value={analytics.overdue} />
          <StatCard label="Completion Rate" value={`${analytics.completionRate}%`} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>By Priority</div>
          {Object.entries(analytics.byPriority).map(([p, c]) => (
            <KeyValueRow key={p} label={p} value={c} />
          ))}
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>By Status</div>
          {Object.entries(analytics.byStatus).map(([s, c]) => (
            <KeyValueRow key={s} label={s} value={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamTab({ team }: { team: TeamProductivity | null }): ReactElement {
  if (!team) return <div style={{ color: "var(--text-secondary, #8b949e)", padding: 16 }}>Loading...</div>;
  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Team Overview</div>
        <div style={styles.grid}>
          <StatCard label="Total Users" value={team.totalUsers} />
          <StatCard label="Active Users" value={team.activeUsers} />
          <StatCard label="Avg Approval Time" value={`${team.avgApprovalTimeHours}h`} />
        </div>
      </div>
      {Object.keys(team.byDepartment).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>By Department</div>
          {Object.entries(team.byDepartment).map(([dept, count]) => (
            <KeyValueRow key={dept} label={dept} value={count} />
          ))}
        </div>
      )}
      {team.topContributors.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Top Contributors</div>
          {team.topContributors.slice(0, 8).map((c, i) => (
            <KeyValueRow key={c.userUuid} label={`#${i + 1} ${c.userUuid.slice(0, 8)}...`} value={c.actions} />
          ))}
        </div>
      )}
    </div>
  );
}

function AiTab({ ai }: { ai: AiUsageMetrics | null }): ReactElement {
  if (!ai) return <div style={{ color: "var(--text-secondary, #8b949e)", padding: 16 }}>Loading...</div>;
  return (
    <div>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>AI Usage Overview</div>
        <div style={styles.grid}>
          <StatCard label="Total Tasks" value={ai.totalTasks} />
          <StatCard label="Completion Rate" value={`${ai.completionRate}%`} />
          <StatCard label="Total Tokens" value={ai.totalTokens.toLocaleString()} />
          <StatCard label="Failures" value={ai.failures} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {Object.keys(ai.byModel).length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>By Model</div>
            {Object.entries(ai.byModel).map(([model, count]) => (
              <KeyValueRow key={model} label={model} value={count} />
            ))}
          </div>
        )}
        {Object.keys(ai.byAgent).length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>By Agent</div>
            {Object.entries(ai.byAgent).map(([agent, count]) => (
              <KeyValueRow key={agent} label={agent.slice(0, 12)} value={count} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductionIntelligencePanel(): ReactElement {
  const [tab, setTab] = useState<Tab>("overview");
  const [health, setHealth] = useState<ProductionHealth | null>(null);
  const [activity, setActivity] = useState<ActivityMetrics | null>(null);
  const [timeline, setTimeline] = useState<TimelineAnalytics | null>(null);
  const [ai, setAi] = useState<AiUsageMetrics | null>(null);
  const [team, setTeam] = useState<TeamProductivity | null>(null);

  const w = window as unknown as { artworks: ArtworksApi };
  const api = w.artworks;

  const loadOverview = useCallback(async () => {
    const [h, a] = await Promise.all([
      api.intelligence.health() as Promise<ProductionHealth>,
      api.intelligence.activity() as Promise<ActivityMetrics>,
    ]);
    setHealth(h);
    setActivity(a);
  }, [api.intelligence]);

  const loadTimeline = useCallback(async () => {
    const t = await (api.intelligence.timeline() as Promise<TimelineAnalytics>);
    setTimeline(t);
  }, [api.intelligence]);

  const loadTeam = useCallback(async () => {
    const t = await (api.intelligence.team() as Promise<TeamProductivity>);
    setTeam(t);
  }, [api.intelligence]);

  const loadAi = useCallback(async () => {
    const a = await (api.intelligence["ai-usage"]() as Promise<AiUsageMetrics>);
    setAi(a);
  }, [api.intelligence]);

  useEffect(() => {
    if (tab === "overview") loadOverview();
    else if (tab === "timeline") loadTimeline();
    else if (tab === "team") loadTeam();
    else if (tab === "ai") loadAi();
  }, [tab, loadOverview, loadTimeline, loadTeam, loadAi]);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.title}>Production Intelligence</span>
        <button
          style={styles.refreshBtn}
          onClick={() => {
            if (tab === "overview") loadOverview();
            else if (tab === "timeline") loadTimeline();
            else if (tab === "team") loadTeam();
            else loadAi();
          }}
        >
          Refresh
        </button>
      </div>
      <div style={styles.tabs}>
        {(["overview", "timeline", "team", "ai"] as Tab[]).map((t) => (
          <button key={t} style={styles.tab(tab === t)} onClick={() => setTab(t)}>
            {t === "overview" ? "Overview" : t === "timeline" ? "Timeline" : t === "team" ? "Team" : "AI"}
          </button>
        ))}
      </div>
      <div style={styles.content}>
        {tab === "overview" && <OverviewTab health={health} activity={activity} />}
        {tab === "timeline" && <TimelineTab analytics={timeline} />}
        {tab === "team" && <TeamTab team={team} />}
        {tab === "ai" && <AiTab ai={ai} />}
      </div>
    </div>
  );
}

panelRegistry.register({
  id: "production-intelligence",
  title: "Production Intelligence",
  icon: "📊",
  component: ProductionIntelligencePanel,
  defaultSlot: "center",
  defaultVisible: false,
});
