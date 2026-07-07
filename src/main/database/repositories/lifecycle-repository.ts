/**
 * Production Lifecycle repository.
 *
 * Manages the formal production lifecycle state machine:
 * draft → active → review → published → archived
 *
 * Enforces valid transitions and maintains a full audit trail.
 */
import type { StudioDatabase } from "../db.js";

export type LifecycleState = "draft" | "active" | "review" | "published" | "archived";

export interface ProductionLifecycle {
  uuid: string;
  entityUuid: string;
  state: LifecycleState;
  enteredAt: string;
  enteredBy: string | null;
  guardData: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleTransition {
  uuid: string;
  entityUuid: string;
  fromState: LifecycleState;
  toState: LifecycleState;
  triggeredBy: string | null;
  reason: string;
  guardData: string;
  createdAt: string;
}

/** Allowed transitions: from → [to, …] */
const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  draft: ["active"],
  active: ["review", "archived"],
  review: ["published", "active"],
  published: ["archived"],
  archived: [],
};

export class LifecycleRepository {
  constructor(private readonly db: StudioDatabase) {}

  /** Get current lifecycle state for an entity. */
  getByEntity(entityUuid: string): ProductionLifecycle | undefined {
    return this.db.get<ProductionLifecycle>(
      "SELECT * FROM production_lifecycle WHERE entity_uuid = ?",
      [entityUuid]
    );
  }

  /** List all lifecycle states, optionally filtered. */
  list(filter?: { state?: LifecycleState }): ProductionLifecycle[] {
    if (filter?.state) {
      return this.db.all<ProductionLifecycle>(
        "SELECT * FROM production_lifecycle WHERE state = ? ORDER BY updated_at DESC",
        [filter.state]
      );
    }
    return this.db.all<ProductionLifecycle>(
      "SELECT * FROM production_lifecycle ORDER BY updated_at DESC"
    );
  }

  /** Create a lifecycle entry for an entity (starts in draft). */
  create(entityUuid: string, enteredBy?: string): ProductionLifecycle {
    const uuid = this.db.get<{ uuid: string }>(
      "SELECT lower(hex(randomblob(16))) AS uuid FROM (SELECT 1)"
    )?.uuid ?? "";

    this.db.exec(
      `INSERT INTO production_lifecycle (uuid, entity_uuid, state, entered_by)
       VALUES (?, ?, 'draft', ?)`,
      [uuid, entityUuid, enteredBy ?? null]
    );

    return this.getByEntity(entityUuid)!;
  }

  /** Check if a transition is valid from the current state. */
  canTransition(from: LifecycleState, to: LifecycleState): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /** Get valid target states from a given state. */
  validTransitions(from: LifecycleState): LifecycleState[] {
    return ALLOWED_TRANSITIONS[from] ?? [];
  }

  /** Transition an entity to a new lifecycle state. */
  transition(
    entityUuid: string,
    toState: LifecycleState,
    triggeredBy?: string,
    reason?: string
  ): { lifecycle: ProductionLifecycle; transition: LifecycleTransition } {
    return this.db.transaction(() => {
      const current = this.getByEntity(entityUuid);
      if (!current) {
        throw new Error(`No lifecycle entry for entity ${entityUuid}`);
      }

      if (!this.canTransition(current.state, toState)) {
        throw new Error(
          `Invalid transition: ${current.state} → ${toState}`
        );
      }

      const now = new Date().toISOString();

      // Update current state
      this.db.exec(
        `UPDATE production_lifecycle
         SET state = ?, entered_by = ?, entered_at = ?, guard_data = '{}', updated_at = ?
         WHERE entity_uuid = ?`,
        [toState, triggeredBy ?? null, now, now, entityUuid]
      );

      // Record transition
      const tUuid = this.db.get<{ uuid: string }>(
        "SELECT lower(hex(randomblob(16))) AS uuid FROM (SELECT 1)"
      )?.uuid ?? "";

      this.db.exec(
        `INSERT INTO lifecycle_transitions
         (uuid, entity_uuid, from_state, to_state, triggered_by, reason, guard_data)
         VALUES (?, ?, ?, ?, ?, ?, '{}')`,
        [tUuid, entityUuid, current.state, toState, triggeredBy ?? null, reason ?? ""]
      );

      const lifecycle = this.getByEntity(entityUuid)!;
      const transition = this.db.get<LifecycleTransition>(
        "SELECT * FROM lifecycle_transitions WHERE uuid = ?",
        [tUuid]
      )!;

      return { lifecycle, transition };
    });
  }

  /** Get transition history for an entity. */
  history(entityUuid: string, limit = 50): LifecycleTransition[] {
    return this.db.all<LifecycleTransition>(
      "SELECT * FROM lifecycle_transitions WHERE entity_uuid = ? ORDER BY created_at DESC LIMIT ?",
      [entityUuid, limit]
    );
  }

  /** Get all transitions (recent first). */
  allTransitions(limit = 100): LifecycleTransition[] {
    return this.db.all<LifecycleTransition>(
      "SELECT * FROM lifecycle_transitions ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
  }

  /** Lifecycle stats. */
  stats(): {
    total: number;
    byState: Record<string, number>;
    transitionsToday: number;
    avgTimeInStateHours: number;
  } {
    const total =
      this.db.get<{ c: number }>("SELECT COUNT(*) AS c FROM production_lifecycle")?.c ?? 0;

    const byStateRows = this.db.all<{ state: string; c: number }>(
      "SELECT state, COUNT(*) AS c FROM production_lifecycle GROUP BY state ORDER BY c DESC"
    );
    const byState: Record<string, number> = {};
    for (const r of byStateRows) byState[r.state] = r.c;

    const transitionsToday =
      this.db.get<{ c: number }>(
        "SELECT COUNT(*) AS c FROM lifecycle_transitions WHERE date(created_at) = date('now')"
      )?.c ?? 0;

    const avgRow = this.db.get<{ a: number }>(
      "SELECT AVG(julianday(updated_at) - julianday(entered_at)) * 24 AS a FROM production_lifecycle"
    );
    const avgTimeInStateHours = Math.round((avgRow?.a ?? 0) * 10) / 10;

    return { total, byState, transitionsToday, avgTimeInStateHours };
  }

  /** Delete lifecycle entry for an entity. */
  delete(entityUuid: string): boolean {
    // Atomic: a failure between the two DELETEs would orphan the lifecycle
    // row (transitions gone, current-state row remains). db.ts requires
    // multi-table writes to go through transaction().
    return this.db.transaction(() => {
      this.db.exec(
        "DELETE FROM lifecycle_transitions WHERE entity_uuid = ?",
        [entityUuid],
      );
      this.db.exec(
        "DELETE FROM production_lifecycle WHERE entity_uuid = ?",
        [entityUuid],
      );
      return true;
    });
  }
}
