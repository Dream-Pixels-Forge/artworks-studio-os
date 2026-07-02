/**
 * Timeline repository.
 *
 * Timeline items span `entities` + `timelines` (project_uuid, timeline_type,
 * start_date, end_date, assigned_to, priority, progress, dependencies).
 * Supports CRUD, date-range queries, dependency tracking, and progress analytics.
 */
import type { Entity } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import { entityRowToEntity, type EntityRow } from "../entity-mapper.js";

export type TimelineType = "task" | "milestone";
export type TimelinePriority = "low" | "medium" | "high" | "critical";

export interface TimelineItem extends Entity {
  readonly type: "timeline";
  projectUuid?: string;
  timelineType: TimelineType;
  startDate?: string;
  endDate?: string;
  assignedTo?: string;
  priority: TimelinePriority;
  progress: number;
  dependencies: string[];
}

export interface CreateTimelineInput {
  name: string;
  timelineType: TimelineType;
  projectUuid?: string;
  startDate?: string;
  endDate?: string;
  assignedTo?: string;
  priority?: TimelinePriority;
  progress?: number;
  dependencies?: string[];
}

interface TimelineRow {
  project_uuid: string | null;
  timeline_type: string;
  start_date: string | null;
  end_date: string | null;
  assigned_to: string | null;
  priority: string;
  progress: number;
  dependencies: string;
}

export class TimelineRepository {
  private readonly entities: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entities = new EntityRepository(db);
  }

  create(input: CreateTimelineInput): TimelineItem {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const item: TimelineItem = {
        uuid,
        id: this.entities.nextId("TL", "timeline"),
        name: input.name,
        type: "timeline",
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        tags: [],
        metadata: {},
        projectUuid: input.projectUuid,
        timelineType: input.timelineType,
        startDate: input.startDate,
        endDate: input.endDate,
        assignedTo: input.assignedTo,
        priority: input.priority ?? "medium",
        progress: input.progress ?? 0,
        dependencies: input.dependencies ?? [],
      };
      this.entities.insertEntity(item);
      this.db.exec(
        `INSERT INTO timelines (uuid, project_uuid, timeline_type, start_date, end_date, assigned_to, priority, progress, dependencies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid,
          input.projectUuid ?? null,
          input.timelineType,
          input.startDate ?? null,
          input.endDate ?? null,
          input.assignedTo ?? null,
          item.priority,
          item.progress,
          JSON.stringify(item.dependencies),
        ],
      );
      return item;
    });
  }

  findByUuid(uuid: string): TimelineItem | undefined {
    const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ? AND type = ?", [uuid, "timeline"]);
    if (!row) return undefined;
    const typeRow = this.db.get<TimelineRow>("SELECT * FROM timelines WHERE uuid = ?", [uuid]);
    if (!typeRow) return undefined;
    return this.toItem(row, typeRow);
  }

  list(filter?: { projectUuid?: string; timelineType?: TimelineType }): TimelineItem[] {
    let sql = "SELECT * FROM entities WHERE type = ?";
    const params: unknown[] = ["timeline"];

    if (filter?.projectUuid) {
      sql += " AND uuid IN (SELECT uuid FROM timelines WHERE project_uuid = ?)";
      params.push(filter.projectUuid);
    }

    sql += " ORDER BY updated_at DESC";

    const rows = this.db.all<EntityRow>(sql, params);
    return rows
      .map((row) => {
        const typeRow = this.db.get<TimelineRow>("SELECT * FROM timelines WHERE uuid = ?", [row.uuid]);
        if (!typeRow) return undefined;
        if (filter?.timelineType && typeRow.timeline_type !== filter.timelineType) return undefined;
        return this.toItem(row, typeRow);
      })
      .filter((i): i is TimelineItem => i !== undefined);
  }

  update(uuid: string, updates: Partial<Pick<TimelineItem, "name" | "startDate" | "endDate" | "assignedTo" | "priority" | "progress" | "dependencies" | "status">>): void {
    this.db.transaction(() => {
      const entity = this.entities.findByUuid(uuid);
      if (!entity) throw new Error(`Timeline item ${uuid} not found`);

      const fields: string[] = [];
      const params: unknown[] = [];

      if (updates.name !== undefined) { fields.push("name = ?"); params.push(updates.name); }
      if (updates.startDate !== undefined) { fields.push("start_date = ?"); params.push(updates.startDate); }
      if (updates.endDate !== undefined) { fields.push("end_date = ?"); params.push(updates.endDate); }
      if (updates.assignedTo !== undefined) { fields.push("assigned_to = ?"); params.push(updates.assignedTo); }
      if (updates.priority !== undefined) { fields.push("priority = ?"); params.push(updates.priority); }
      if (updates.progress !== undefined) { fields.push("progress = ?"); params.push(updates.progress); }
      if (updates.dependencies !== undefined) { fields.push("dependencies = ?"); params.push(JSON.stringify(updates.dependencies)); }

      if (fields.length > 0) {
        this.db.exec(`UPDATE timelines SET ${fields.join(", ")} WHERE uuid = ?`, [...params, uuid]);
      }

      this.entities.updateEntity({
        ...entity,
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        updatedAt: new Date().toISOString(),
      });
    });
  }

  delete(uuid: string): void {
    this.entities.deleteByUuid(uuid);
  }

  /** Get all items that depend on the given item. */
  dependents(uuid: string): TimelineItem[] {
    const all = this.list();
    return all.filter((item) => item.dependencies.includes(uuid));
  }

  /** Get summary stats for a project's timeline. */
  stats(projectUuid?: string): {
    total: number;
    tasks: number;
    milestones: number;
    completed: number;
    inProgress: number;
    avgProgress: number;
    byPriority: Record<TimelinePriority, number>;
  } {
    const items = this.list(projectUuid ? { projectUuid } : undefined);
    const tasks = items.filter((i) => i.timelineType === "task");
    const milestones = items.filter((i) => i.timelineType === "milestone");
    const completed = items.filter((i) => i.status === "final");
    const inProgress = items.filter((i) => i.status === "active");
    const avgProgress = items.length > 0 ? items.reduce((sum, i) => sum + i.progress, 0) / items.length : 0;
    const byPriority: Record<TimelinePriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const item of items) {
      byPriority[item.priority]++;
    }

    return {
      total: items.length,
      tasks: tasks.length,
      milestones: milestones.length,
      completed: completed.length,
      inProgress: inProgress.length,
      avgProgress: Math.round(avgProgress),
      byPriority,
    };
  }

  private toItem(row: EntityRow, typeRow: TimelineRow): TimelineItem {
    return {
      ...entityRowToEntity(row),
      type: "timeline",
      projectUuid: typeRow.project_uuid ?? undefined,
      timelineType: typeRow.timeline_type as TimelineType,
      startDate: typeRow.start_date ?? undefined,
      endDate: typeRow.end_date ?? undefined,
      assignedTo: typeRow.assigned_to ?? undefined,
      priority: typeRow.priority as TimelinePriority,
      progress: typeRow.progress,
      dependencies: (() => { try { return JSON.parse(typeRow.dependencies) as string[]; } catch { return []; } })(),
    } as TimelineItem;
  }
}
