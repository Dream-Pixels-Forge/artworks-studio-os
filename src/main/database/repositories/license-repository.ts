/**
 * License repository — manages studio licenses and feature flags.
 *
 * Licenses control access to premium features (enterprise, pro features).
 * Each license has a key, type, feature flags, and user/project limits.
 * Provides CRUD, validation, and feature-flag queries.
 */
import type { StudioDatabase } from "../db.js";

export interface License {
  uuid: string;
  key: string;
  type: string;
  holder_name: string;
  holder_email: string;
  features: string;           // JSON array
  max_users: number;
  max_projects: number;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface LicenseWithFeatures extends License {
  parsedFeatures: string[];
}

export class LicenseRepository {
  constructor(private readonly db: StudioDatabase) {}

  create(input: {
    key: string;
    type?: string;
    holder_name?: string;
    holder_email?: string;
    features?: string[];
    max_users?: number;
    max_projects?: number;
    expires_at?: string | null;
  }): LicenseWithFeatures {
    const uuid = crypto.randomUUID();
    this.db.exec(
      `INSERT INTO licenses (uuid, key, type, holder_name, holder_email, features, max_users, max_projects, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        input.key,
        input.type ?? "pro",
        input.holder_name ?? "",
        input.holder_email ?? "",
        JSON.stringify(input.features ?? []),
        input.max_users ?? 1,
        input.max_projects ?? -1,
        input.expires_at ?? null,
      ],
    );
    return this.getByUuid(uuid)!;
  }

  getByUuid(uuid: string): LicenseWithFeatures | undefined {
    const row = this.db.get<License>("SELECT * FROM licenses WHERE uuid = ?", [uuid]);
    return row ? this.parseFeatures(row) : undefined;
  }

  getByKey(key: string): LicenseWithFeatures | undefined {
    const row = this.db.get<License>("SELECT * FROM licenses WHERE key = ?", [key]);
    return row ? this.parseFeatures(row) : undefined;
  }

  list(): LicenseWithFeatures[] {
    const rows = this.db.all<License>("SELECT * FROM licenses ORDER BY created_at DESC");
    return rows.map((r) => this.parseFeatures(r));
  }

  getActive(): LicenseWithFeatures | undefined {
    const row = this.db.get<License>(
      "SELECT * FROM licenses WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1",
    );
    return row ? this.parseFeatures(row) : undefined;
  }

  update(uuid: string, input: Partial<Pick<License, "type" | "holder_name" | "holder_email" | "features" | "max_users" | "max_projects" | "expires_at" | "is_active">>): LicenseWithFeatures | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (input.type !== undefined) { fields.push("type = ?"); values.push(input.type); }
    if (input.holder_name !== undefined) { fields.push("holder_name = ?"); values.push(input.holder_name); }
    if (input.holder_email !== undefined) { fields.push("holder_email = ?"); values.push(input.holder_email); }
    if (input.features !== undefined) { fields.push("features = ?"); values.push(input.features); }
    if (input.max_users !== undefined) { fields.push("max_users = ?"); values.push(input.max_users); }
    if (input.max_projects !== undefined) { fields.push("max_projects = ?"); values.push(input.max_projects); }
    if (input.expires_at !== undefined) { fields.push("expires_at = ?"); values.push(input.expires_at); }
    if (input.is_active !== undefined) { fields.push("is_active = ?"); values.push(input.is_active); }
    if (fields.length === 0) return this.getByUuid(uuid);
    fields.push("updated_at = datetime('now')");
    values.push(uuid);
    this.db.exec(`UPDATE licenses SET ${fields.join(", ")} WHERE uuid = ?`, values);
    return this.getByUuid(uuid);
  }

  delete(uuid: string): boolean {
    const exists = this.db.get("SELECT 1 FROM licenses WHERE uuid = ?", [uuid]);
    if (!exists) return false;
    this.db.exec("DELETE FROM licenses WHERE uuid = ?", [uuid]);
    return true;
  }

  // ── Validation ─────────────────────────────────────────────

  isActive(license: LicenseWithFeatures): boolean {
    if (!license.is_active) return false;
    if (license.expires_at) {
      const expires = new Date(license.expires_at);
      if (expires < new Date()) return false;
    }
    return true;
  }

  hasFeature(license: LicenseWithFeatures, feature: string): boolean {
    return this.isActive(license) && license.parsedFeatures.includes(feature);
  }

  canAddUsers(license: LicenseWithFeatures, currentCount: number): boolean {
    if (!this.isActive(license)) return false;
    if (license.max_users === -1) return true;
    return currentCount < license.max_users;
  }

  canAddProjects(license: LicenseWithFeatures, currentCount: number): boolean {
    if (!this.isActive(license)) return false;
    if (license.max_projects === -1) return true;
    return currentCount < license.max_projects;
  }

  // ── Stats ──────────────────────────────────────────────────

  stats(): { total: number; active: number; byType: Record<string, number>; expiringSoon: number } {
    const total = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM licenses") ?? { c: 0 }).c;
    const active = (this.db.get<{ c: number }>("SELECT COUNT(*) as c FROM licenses WHERE is_active = 1") ?? { c: 0 }).c;
    const rows = this.db.all<{ type: string; c: number }>(
      "SELECT type, COUNT(*) as c FROM licenses GROUP BY type",
    );
    const byType: Record<string, number> = {};
    for (const row of rows) byType[row.type] = row.c;
    const expiringSoon = (this.db.get<{ c: number }>(
      "SELECT COUNT(*) as c FROM licenses WHERE is_active = 1 AND expires_at IS NOT NULL AND expires_at <= datetime('now', '+30 days')",
    ) ?? { c: 0 }).c;
    return { total, active, byType, expiringSoon };
  }

  // ── Helpers ────────────────────────────────────────────────

  private parseFeatures(license: License): LicenseWithFeatures {
    let parsedFeatures: string[];
    try {
      parsedFeatures = JSON.parse(license.features) as string[];
    } catch {
      parsedFeatures = [];
    }
    return { ...license, parsedFeatures };
  }
}
