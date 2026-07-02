/**
 * Review repository.
 *
 * Manages the structured review pipeline for entities.
 */
import type { StudioDatabase } from "../db.js";

export interface Review {
  uuid: string;
  entityUuid: string;
  reviewerUuid: string;
  status: "pending" | "in_progress" | "completed";
  rating?: number;
  feedback: string;
  createdAt: string;
  updatedAt: string;
}

interface ReviewRow {
  uuid: string;
  entity_uuid: string;
  reviewer_uuid: string;
  status: string;
  rating: number | null;
  feedback: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewInput {
  entityUuid: string;
  reviewerUuid: string;
}

export type ReviewStatus = "pending" | "in_progress" | "completed";

export class ReviewRepository {
  constructor(private readonly db: StudioDatabase) {}

  private toReview(row: ReviewRow): Review {
    return {
      uuid: row.uuid,
      entityUuid: row.entity_uuid,
      reviewerUuid: row.reviewer_uuid,
      status: row.status as ReviewStatus,
      rating: row.rating ?? undefined,
      feedback: row.feedback,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(input: CreateReviewInput): Review {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const review: Review = {
      uuid,
      entityUuid: input.entityUuid,
      reviewerUuid: input.reviewerUuid,
      status: "pending",
      feedback: "",
      createdAt: now,
      updatedAt: now,
    };

    this.db.exec(
      `INSERT INTO reviews (uuid, entity_uuid, reviewer_uuid, status, feedback, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, review.entityUuid, review.reviewerUuid, review.status, review.feedback, now, now],
    );

    return review;
  }

  findByUuid(uuid: string): Review | undefined {
    const row = this.db.get<ReviewRow>(
      "SELECT * FROM reviews WHERE uuid = ?",
      [uuid],
    );
    return row ? this.toReview(row) : undefined;
  }

  list(filters?: { status?: ReviewStatus; reviewerUuid?: string }): Review[] {
    let sql = "SELECT * FROM reviews WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters?.reviewerUuid) {
      sql += " AND reviewer_uuid = ?";
      params.push(filters.reviewerUuid);
    }

    sql += " ORDER BY created_at DESC";

    const rows = this.db.all<ReviewRow>(sql, params);
    return rows.map((r) => this.toReview(r));
  }

  listByEntity(entityUuid: string): Review[] {
    const rows = this.db.all<ReviewRow>(
      "SELECT * FROM reviews WHERE entity_uuid = ? ORDER BY created_at DESC",
      [entityUuid],
    );
    return rows.map((r) => this.toReview(r));
  }

  update(uuid: string, updates: Partial<Pick<Review, "status" | "rating" | "feedback">>): void {
    const existing = this.findByUuid(uuid);
    if (!existing) throw new Error(`Review ${uuid} not found`);

    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push("status = ?");
      params.push(updates.status);
    }
    if (updates.rating !== undefined) {
      fields.push("rating = ?");
      params.push(updates.rating);
    }
    if (updates.feedback !== undefined) {
      fields.push("feedback = ?");
      params.push(updates.feedback);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(uuid);

    this.db.exec(
      `UPDATE reviews SET ${fields.join(", ")} WHERE uuid = ?`,
      params,
    );
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM reviews WHERE uuid = ?", [uuid]);
  }

  count(filters?: { status?: ReviewStatus }): number {
    let sql = "SELECT COUNT(*) as count FROM reviews";
    const params: unknown[] = [];

    if (filters?.status) {
      sql += " WHERE status = ?";
      params.push(filters.status);
    }

    const row = this.db.get<{ count: number }>(sql, params);
    return row?.count ?? 0;
  }

  stats(): { total: number; pending: number; inProgress: number; completed: number; avgRating: number } {
    const rows = this.db.all<{ status: string; count: number }>(
      "SELECT status, COUNT(*) as count FROM reviews GROUP BY status",
    );

    const stats = { total: 0, pending: 0, inProgress: 0, completed: 0, avgRating: 0 };
    for (const row of rows) {
      stats.total += row.count;
      if (row.status === "pending") stats.pending = row.count;
      else if (row.status === "in_progress") stats.inProgress = row.count;
      else if (row.status === "completed") stats.completed = row.count;
    }

    const avgRow = this.db.get<{ avg_rating: number | null }>(
      "SELECT AVG(rating) as avg_rating FROM reviews WHERE rating IS NOT NULL",
    );
    stats.avgRating = avgRow?.avg_rating ?? 0;

    return stats;
  }
}
