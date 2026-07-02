/**
 * Production Intelligence repository.
 *
 * Cross-cutting analytics that synthesize data from all production tables
 * into actionable insights — health scores, activity metrics, timeline
 * analytics, AI usage patterns, and team productivity.
 */
import type { StudioDatabase } from "../db.js";

export interface ProductionHealth {
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

export interface ActivityMetrics {
  total: number;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
  byEntityType: Record<string, number>;
  timeline: Array<{ date: string; count: number }>;
}

export interface TimelineAnalytics {
  total: number;
  avgProgress: number;
  overdue: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  completionRate: number;
}

export interface EntityAnalytics {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  avgVersions: number;
  topEdited: Array<{ uuid: string; name: string; type: string; versions: number }>;
}

export interface AiUsageMetrics {
  totalTasks: number;
  completionRate: number;
  totalTokens: number;
  byModel: Record<string, number>;
  byAgent: Record<string, number>;
  failures: number;
}

export interface TeamProductivity {
  totalUsers: number;
  activeUsers: number;
  byDepartment: Record<string, number>;
  topContributors: Array<{ userUuid: string; actions: number }>;
  avgApprovalTimeHours: number;
}

export interface ProductionSummary {
  health: ProductionHealth;
  activity: ActivityMetrics;
  timeline: TimelineAnalytics;
  ai: AiUsageMetrics;
  team: TeamProductivity;
}

export class ProductionIntelligenceRepository {
  constructor(private readonly db: StudioDatabase) {}

  productionHealth(): ProductionHealth {
    const e = (sql: string) => this.db.get<{ c: number }>(sql)?.c ?? 0;
    return {
      entities: e("SELECT COUNT(*) AS c FROM entities"),
      projects: e("SELECT COUNT(*) AS c FROM entities WHERE type = 'project'"),
      assets: e("SELECT COUNT(*) AS c FROM entities WHERE type = 'asset'"),
      documents: e("SELECT COUNT(*) AS c FROM entities WHERE type = 'document'"),
      activeWorkflows: e("SELECT COUNT(*) AS c FROM workflows WHERE state = 'running'"),
      pendingApprovals: e("SELECT COUNT(*) AS c FROM approvals WHERE status = 'pending'"),
      openReviews: e("SELECT COUNT(*) AS c FROM reviews WHERE status != 'completed'"),
      agents: e("SELECT COUNT(*) AS c FROM ai_agents WHERE status != 'offline'"),
      activeTasks: e("SELECT COUNT(*) AS c FROM agent_tasks WHERE status IN ('pending', 'in_progress')"),
      timelines: e("SELECT COUNT(*) AS c FROM timelines"),
      overdueTimelines: e(
        "SELECT COUNT(*) AS c FROM timelines WHERE end_date < date('now') AND progress < 100"
      ),
    };
  }

  activityMetrics(since?: string): ActivityMetrics {
    const where = since ? `WHERE created_at >= '${since}'` : "";
    const total =
      this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM activity_log ${where}`)?.c ?? 0;

    const byActionRows = this.db.all<{ action: string; c: number }>(
      `SELECT action, COUNT(*) AS c FROM activity_log ${where} GROUP BY action ORDER BY c DESC`
    );
    const byAction: Record<string, number> = {};
    for (const r of byActionRows) byAction[r.action] = r.c;

    const byUserRows = this.db.all<{ user_uuid: string; c: number }>(
      `SELECT user_uuid, COUNT(*) AS c FROM activity_log ${where} GROUP BY user_uuid ORDER BY c DESC LIMIT 10`
    );
    const byUser: Record<string, number> = {};
    for (const r of byUserRows) byUser[r.user_uuid] = r.c;

    const byEntityRows = this.db.all<{ entity_type: string; c: number }>(
      `SELECT entity_type, COUNT(*) AS c FROM activity_log ${where} GROUP BY entity_type ORDER BY c DESC`
    );
    const byEntityType: Record<string, number> = {};
    for (const r of byEntityRows) byEntityType[r.entity_type] = r.c;

    const timelineRows = this.db.all<{ date: string; count: number }>(
      `SELECT date(created_at) AS date, COUNT(*) AS count FROM activity_log ${where} GROUP BY date(created_at) ORDER BY date DESC LIMIT 30`
    );

    return { total, byAction, byUser, byEntityType, timeline: timelineRows };
  }

  timelineAnalytics(projectUuid?: string): TimelineAnalytics {
    const where = projectUuid
      ? `WHERE t.project_uuid = '${projectUuid}'`
      : "";
    const total =
      this.db.get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM timelines t ${where}`
      )?.c ?? 0;

    const avgRow = this.db.get<{ a: number }>(
      `SELECT AVG(progress) AS a FROM timelines t ${where}`
    );
    const avgProgress = Math.round(avgRow?.a ?? 0);

    const overdue =
      this.db.get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM timelines t ${where} ${where ? "AND" : "WHERE"} t.end_date < date('now') AND t.progress < 100`
      )?.c ?? 0;

    const byPriorityRows = this.db.all<{ priority: string; c: number }>(
      `SELECT priority, COUNT(*) AS c FROM timelines t ${where} GROUP BY priority`
    );
    const byPriority: Record<string, number> = {};
    for (const r of byPriorityRows) byPriority[r.priority] = r.c;

    const byStatusRows = this.db.all<{ status: string; c: number }>(
      `SELECT e.status, COUNT(*) AS c FROM timelines t JOIN entities e ON t.uuid = e.uuid ${where} GROUP BY e.status`
    );
    const byStatus: Record<string, number> = {};
    for (const r of byStatusRows) byStatus[r.status] = r.c;

    const completed =
      this.db.get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM timelines t JOIN entities e ON t.uuid = e.uuid ${where} ${where ? "AND" : "WHERE"} e.status = 'final'`
      )?.c ?? 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, avgProgress, overdue, byPriority, byStatus, completionRate };
  }

  entityAnalytics(): EntityAnalytics {
    const total =
      this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM entities")?.c ?? 0;

    const byTypeRows = this.db.all<{ type: string; c: number }>(
      "SELECT type, COUNT(*) AS c FROM entities GROUP BY type ORDER BY c DESC"
    );
    const byType: Record<string, number> = {};
    for (const r of byTypeRows) byType[r.type] = r.c;

    const byStatusRows = this.db.all<{ status: string; c: number }>(
      "SELECT status, COUNT(*) AS c FROM entities GROUP BY status ORDER BY c DESC"
    );
    const byStatus: Record<string, number> = {};
    for (const r of byStatusRows) byStatus[r.status] = r.c;

    const avgRow = this.db.get<{ a: number }>(
      "SELECT AVG(version) AS a FROM entities"
    );
    const avgVersions = Math.round((avgRow?.a ?? 1) * 10) / 10;

    const topEdited = this.db.all<{ uuid: string; name: string; type: string; versions: number }>(
      "SELECT uuid, name, type, version AS versions FROM entities ORDER BY version DESC LIMIT 10"
    );

    return { total, byType, byStatus, avgVersions, topEdited };
  }

  aiUsageMetrics(): AiUsageMetrics {
    const totalTasks =
      this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM agent_tasks")?.c ?? 0;

    const completedTasks =
      this.db.get<{ c: number }>(
        "SELECT COUNT(*) AS c FROM agent_tasks WHERE status = 'completed'"
      )?.c ?? 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const tokenRow = this.db.get<{ t: number }>(
      "SELECT COALESCE(SUM(tokens_used), 0) AS t FROM agent_messages"
    );
    const totalTokens = tokenRow?.t ?? 0;

    const byModelRows = this.db.all<{ model: string; c: number }>(
      "SELECT model, COUNT(*) AS c FROM agent_messages GROUP BY model ORDER BY c DESC"
    );
    const byModel: Record<string, number> = {};
    for (const r of byModelRows) byModel[r.model] = r.c;

    const byAgentRows = this.db.all<{ agent_id: string; c: number }>(
      "SELECT agent_id, COUNT(*) AS c FROM agent_tasks GROUP BY agent_id ORDER BY c DESC"
    );
    const byAgent: Record<string, number> = {};
    for (const r of byAgentRows) byAgent[r.agent_id] = r.c;

    const failures =
      this.db.get<{ c: number }>(
        "SELECT COUNT(*) AS c FROM agent_tasks WHERE status = 'failed'"
      )?.c ?? 0;

    return { totalTasks, completionRate, totalTokens, byModel, byAgent, failures };
  }

  teamProductivity(): TeamProductivity {
    const totalUsers =
      this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM users")?.c ?? 0;
    const activeUsers =
      this.db.get<{ c: number }>(
        "SELECT COUNT(*) AS c FROM users WHERE is_active = 1"
      )?.c ?? 0;

    const byDeptRows = this.db.all<{ name: string; c: number }>(
      `SELECT d.name, COUNT(*) AS c FROM department_members dm
       JOIN departments d ON dm.department_uuid = d.uuid
       GROUP BY d.name ORDER BY c DESC`
    );
    const byDepartment: Record<string, number> = {};
    for (const r of byDeptRows) byDepartment[r.name] = r.c;

    const topContributors = this.db.all<{ user_uuid: string; actions: number }>(
      "SELECT user_uuid, COUNT(*) AS actions FROM activity_log GROUP BY user_uuid ORDER BY actions DESC LIMIT 10"
    ).map((r) => ({ userUuid: r.user_uuid, actions: r.actions }));

    const avgApprovalRow = this.db.get<{ a: number }>(
      `SELECT AVG(juliayday(updated_at) - juliayday(created_at)) * 24 AS a
       FROM approvals WHERE status IN ('approved', 'rejected')`
    );
    const avgApprovalTimeHours = Math.round((avgApprovalRow?.a ?? 0) * 10) / 10;

    return { totalUsers, activeUsers, byDepartment, topContributors, avgApprovalTimeHours };
  }

  productionSummary(): ProductionSummary {
    return {
      health: this.productionHealth(),
      activity: this.activityMetrics(),
      timeline: this.timelineAnalytics(),
      ai: this.aiUsageMetrics(),
      team: this.teamProductivity(),
    };
  }
}
