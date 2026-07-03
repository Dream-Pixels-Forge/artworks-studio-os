/**
 * Marketplace repository.
 *
 * Manages marketplace listings — the catalog of plugins, templates, and
 * assets that users can browse, search, install, and rate.
 */
import type { StudioDatabase } from "../db.js";

/** Row shape from the marketplace_listings table. */
interface MarketplaceRow {
  uuid: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  category: string;
  type: string;
  version: string;
  icon: string | null;
  screenshots: string;
  manifest_id: string | null;
  download_url: string | null;
  downloads: number;
  rating: number;
  rating_count: number;
  installed: number;
  installed_version: string | null;
  listed: number;
  created_at: string;
  updated_at: string;
}

/** Public marketplace listing record. */
export interface MarketplaceListing {
  uuid: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  category: MarketplaceCategory;
  type: MarketplaceType;
  version: string;
  icon: string | null;
  screenshots: string[];
  manifestId: string | null;
  downloadUrl: string | null;
  downloads: number;
  rating: number;
  ratingCount: number;
  installed: boolean;
  installedVersion: string | null;
  listed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MarketplaceCategory =
  | "production" | "ai" | "integration" | "workflow"
  | "ui" | "utility" | "template" | "asset";

export type MarketplaceType = "plugin" | "template" | "asset";

/** Input for publishing a listing. */
export interface PublishListingInput {
  slug: string;
  name: string;
  description?: string;
  author?: string;
  category?: MarketplaceCategory;
  type?: MarketplaceType;
  version?: string;
  icon?: string;
  screenshots?: string[];
  manifestId?: string;
  downloadUrl?: string;
}

/** Filter for browsing listings. */
export interface ListingFilter {
  category?: MarketplaceCategory;
  type?: MarketplaceType;
  installed?: boolean;
  listed?: boolean;
  search?: string;
  sortBy?: "name" | "downloads" | "rating" | "created_at";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/** Input for rating a listing. */
export interface RateListingInput {
  rating: number; // 1-5
}

const INSERT_SQL = `
  INSERT INTO marketplace_listings
    (uuid, slug, name, description, author, category, type, version,
     icon, screenshots, manifest_id, download_url, listed)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const UPDATE_INSTALLED_SQL = `
  UPDATE marketplace_listings
  SET installed = ?, installed_version = ?, updated_at = datetime('now')
  WHERE uuid = ?
`;

const INCREMENT_DOWNLOADS_SQL = `
  UPDATE marketplace_listings
  SET downloads = downloads + 1, updated_at = datetime('now')
  WHERE uuid = ?
`;

const UPDATE_RATING_SQL = `
  UPDATE marketplace_listings
  SET rating = ?, rating_count = ?, updated_at = datetime('now')
  WHERE uuid = ?
`;

export class MarketplaceRepository {
  constructor(private readonly db: StudioDatabase) {}

  /** Publish a new listing to the marketplace. */
  publish(input: PublishListingInput): MarketplaceListing {
    const uuid = crypto.randomUUID();
    this.db.exec(INSERT_SQL, [
      uuid,
      input.slug,
      input.name,
      input.description ?? "",
      input.author ?? "",
      input.category ?? "utility",
      input.type ?? "plugin",
      input.version ?? "1.0.0",
      input.icon ?? null,
      JSON.stringify(input.screenshots ?? []),
      input.manifestId ?? null,
      input.downloadUrl ?? null,
      1,
    ]);
    return this.getByUuid(uuid)!;
  }

  /** Get a listing by UUID. */
  getByUuid(uuid: string): MarketplaceListing | undefined {
    const row = this.db.get<MarketplaceRow>(
      "SELECT * FROM marketplace_listings WHERE uuid = ?",
      [uuid],
    );
    return row ? rowToRecord(row) : undefined;
  }

  /** Get a listing by slug. */
  getBySlug(slug: string): MarketplaceListing | undefined {
    const row = this.db.get<MarketplaceRow>(
      "SELECT * FROM marketplace_listings WHERE slug = ?",
      [slug],
    );
    return row ? rowToRecord(row) : undefined;
  }

  /** List all listed marketplace items with optional filters. */
  list(filter: ListingFilter = {}): MarketplaceListing[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.listed !== undefined) {
      conditions.push("listed = ?");
      params.push(filter.listed ? 1 : 0);
    }
    if (filter.category) {
      conditions.push("category = ?");
      params.push(filter.category);
    }
    if (filter.type) {
      conditions.push("type = ?");
      params.push(filter.type);
    }
    if (filter.installed !== undefined) {
      conditions.push("installed = ?");
      params.push(filter.installed ? 1 : 0);
    }
    if (filter.search) {
      conditions.push("uuid IN (SELECT uuid FROM marketplace_fts WHERE marketplace_fts MATCH ?)");
      params.push(filter.search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sortColumn = filter.sortBy ?? "downloads";
    const sortDir = filter.sortOrder === "asc" ? "ASC" : "DESC";
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const sql = `SELECT * FROM marketplace_listings ${where} ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = this.db.all<MarketplaceRow>(sql, params);
    return rows.map(rowToRecord);
  }

  /** Get featured/popular listings (top by downloads + rating). */
  featured(limit = 10): MarketplaceListing[] {
    const rows = this.db.all<MarketplaceRow>(
      `SELECT * FROM marketplace_listings
       WHERE listed = 1
       ORDER BY (downloads * 0.6 + rating * rating_count * 0.4) DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map(rowToRecord);
  }

  /** Get recently added listings. */
  recent(limit = 10): MarketplaceListing[] {
    const rows = this.db.all<MarketplaceRow>(
      `SELECT * FROM marketplace_listings
       WHERE listed = 1
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map(rowToRecord);
  }

  /** Mark a listing as installed. */
  markInstalled(uuid: string, version: string): void {
    this.db.exec(UPDATE_INSTALLED_SQL, [1, version, uuid]);
  }

  /** Mark a listing as uninstalled. */
  markUninstalled(uuid: string): void {
    this.db.exec(UPDATE_INSTALLED_SQL, [0, null, uuid]);
  }

  /** Record a download (increment counter). */
  recordDownload(uuid: string): void {
    this.db.exec(INCREMENT_DOWNLOADS_SQL, [uuid]);
  }

  /** Rate a listing (recalculates average). */
  rate(uuid: string, input: RateListingInput): void {
    const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
    const current = this.db.get<MarketplaceRow>(
      "SELECT rating, rating_count FROM marketplace_listings WHERE uuid = ?",
      [uuid],
    );
    if (!current) return;
    const newCount = current.rating_count + 1;
    const newRating = (current.rating * current.rating_count + rating) / newCount;
    this.db.exec(UPDATE_RATING_SQL, [newRating, newCount, uuid]);
  }

  /** Delete a listing. */
  delete(uuid: string): void {
    this.db.exec("DELETE FROM marketplace_listings WHERE uuid = ?", [uuid]);
  }

  /** Total count of listed items. */
  count(): number {
    const row = this.db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM marketplace_listings WHERE listed = 1",
    );
    return row?.count ?? 0;
  }

  /** Count of installed items. */
  installedCount(): number {
    const row = this.db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM marketplace_listings WHERE installed = 1",
    );
    return row?.count ?? 0;
  }

  /** Category breakdown. */
  categoryBreakdown(): Array<{ category: string; count: number }> {
    return this.db.all<{ category: string; count: number }>(
      `SELECT category, COUNT(*) AS count
       FROM marketplace_listings
       WHERE listed = 1
       GROUP BY category
       ORDER BY count DESC`,
    );
  }

  /** Search listings by query string (delegates to FTS). */
  search(query: string, limit = 50): MarketplaceListing[] {
    return this.list({ search: query, limit });
  }

  /** Get popular listings sorted by download count. */
  popular(limit = 20): MarketplaceListing[] {
    return this.list({ sortBy: "downloads", sortOrder: "desc", limit });
  }

  /** Get top-rated listings sorted by rating. */
  topRated(limit = 20): MarketplaceListing[] {
    return this.list({ sortBy: "rating", sortOrder: "desc", limit });
  }
}

function rowToRecord(row: MarketplaceRow): MarketplaceListing {
  let screenshots: string[];
  try {
    screenshots = JSON.parse(row.screenshots) as string[];
  } catch {
    screenshots = [];
  }
  return {
    uuid: row.uuid,
    slug: row.slug,
    name: row.name,
    description: row.description,
    author: row.author,
    category: row.category as MarketplaceCategory,
    type: row.type as MarketplaceType,
    version: row.version,
    icon: row.icon,
    screenshots,
    manifestId: row.manifest_id,
    downloadUrl: row.download_url,
    downloads: row.downloads,
    rating: row.rating,
    ratingCount: row.rating_count,
    installed: row.installed === 1,
    installedVersion: row.installed_version,
    listed: row.listed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
