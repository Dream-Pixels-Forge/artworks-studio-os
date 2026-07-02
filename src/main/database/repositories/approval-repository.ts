/**
 * Approval repository.
 *
 * Manages the asset/entity approval workflow.
 */
import type { StudioDatabase } from "../db.js";

export interface Approval {
  uuid: string;
  entityUuid: string;
  requesterUuid: string;
  approverUuid: string;
  status: "pending" | "approved" | "rejected";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalRow {
  uuid: string;
  entity_uuid: string;
  requester_uuid: string;
  approver_uuid: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateApprovalInput {
  entityUuid: string;
  requesterUuid: string;
  approverUuid: string;
  notes?: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export class ApprovalRepository {
  constructor(private readonly db: StudioDatabase) {}

  private toApproval(row: ApprovalRow): Approval {
    return {
      uuid: row.uuid,
      entityUuid: row.entity_uuid,
      requesterUuid: row.requester_uuid,
      approverUuid: row.approver_uuid,
      status: row.status as ApprovalStatus,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(input: CreateApprovalInput): Approval {
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    const approval: Approval = {
      uuid,
      entityUuid: input.entityUuid,
      requesterUuid: input.requesterUuid,
      approverUuid: input.approverUuid,
      status: "pending",
      notes: input.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };

    this.db.exec(
      `INSERT INTO approvals (uuid, entity_uuid, requester_uuid, approver_uuid, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, approval.entityUuid, approval.requesterUuid, approval.approverUuid, approval.status, approval.notes, now, now],
    );

    return approval;
  }

  findByUuid(uuid: string): Approval | undefined {
    const row = this.db.get<ApprovalRow>(
      "SELECT * FROM approvals WHERE uuid = ?",
      [uuid],
    );
    return row ? this.toApproval(row) : undefined;
  }

  list(filters?: { status?: ApprovalStatus; approverUuid?: string; requesterUuid?: string }): Approval[] {
    let sql = "SELECT * FROM approvals WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters?.approverUuid) {
      sql += " AND approver_uuid = ?";
      params.push(filters.approverUuid);
    }
    if (filters?.requesterUuid) {
      sql += " AND requester_uuid = ?";
      params.push(filters.requesterUuid);
    }

    sql += " ORDER BY created_at DESC";

    const rows = this.db.all<ApprovalRow>(sql, params);
    return rows.map((r) => this.toApproval(r));
  }

  listByEntity(entityUuid: string): Approval[] {
    const rows = this.db.all<ApprovalRow>(
      "SELECT * FROM approvals WHERE entity_uuid = ? ORDER BY created_at DESC",
      [entityUuid],
    );
    return rows.map((r) => this.toApproval(r));
  }

  updateStatus(uuid: string, status: ApprovalStatus, notes?: string): void {
    const existing = this.findByUuid(uuid);
    if (!existing) throw new Error(`Approval ${uuid} not found`);

    const now = new Date().toISOString();
    const fields: string[] = ["status = ?", "updated_at = ?"];
    const params: unknown[] = [status, now];

    if (notes !== undefined) {
      fields.push("notes = ?");
      params.push(notes);
    }

    params.push(uuid);

    this.db.exec(
      `UPDATE approvals SET ${fields.join(", ")} WHERE uuid = ?`,
      params,
    );
  }

  delete(uuid: string): void {
    this.db.exec("DELETE FROM approvals WHERE uuid = ?", [uuid]);
  }

  count(filters?: { status?: ApprovalStatus }): number {
    let sql = "SELECT COUNT(*) as count FROM approvals";
    const params: unknown[] = [];

    if (filters?.status) {
      sql += " WHERE status = ?";
      params.push(filters.status);
    }

    const row = this.db.get<{ count: number }>(sql, params);
    return row?.count ?? 0;
  }

  stats(): { total: number; pending: number; approved: number; rejected: number } {
    const rows = this.db.all<{ status: string; count: number }>(
      "SELECT status, COUNT(*) as count FROM approvals GROUP BY status",
    );

    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    for (const row of rows) {
      stats.total += row.count;
      if (row.status === "pending") stats.pending = row.count;
      else if (row.status === "approved") stats.approved = row.count;
      else if (row.status === "rejected") stats.rejected = row.count;
    }
    return stats;
  }
}
