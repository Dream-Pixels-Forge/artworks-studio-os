/**
 * MarketplaceRepository tests.
 *
 * Exercises the marketplace catalog layer against an in-memory migrated
 * database: publish, lookups, list with filters, FTS search, popularity,
 * ratings, install tracking, and aggregate queries.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../db.js";
import { MIGRATIONS } from "../migrations.js";
import { MarketplaceRepository } from "./marketplace-repository.js";
import type { PublishListingInput } from "./marketplace-repository.js";

let db: StudioDatabase;
let repo: MarketplaceRepository;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
  repo = new MarketplaceRepository(db);
});

afterAll(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function publish(overrides: Partial<PublishListingInput> = {}) {
  const slug = overrides.slug ?? `test-${crypto.randomUUID().slice(0, 8)}`;
  const { slug: _ignored, ...rest } = overrides;
  return repo.publish({
    slug,
    name: rest.name ?? `Test Listing ${slug}`,
    description: rest.description ?? `Description for ${slug}`,
    author: rest.author ?? "test-author",
    category: rest.category ?? "utility",
    type: rest.type ?? "plugin",
    version: rest.version ?? "1.0.0",
    icon: rest.icon,
    screenshots: rest.screenshots,
    manifestId: rest.manifestId,
    downloadUrl: rest.downloadUrl,
  });
}

let sampleSetCounter = 0;

function publishSampleSet() {
  const tag = `s${++sampleSetCounter}`;
  const a = publish({
    slug: `alpha-plugin-${tag}`,
    name: `Alpha Plugin ${tag}`,
    description: "A production-grade plugin for the alpha workflow",
    category: "production",
    type: "plugin",
    author: "alice",
  });
  const b = publish({
    slug: `beta-template-${tag}`,
    name: `Beta Template ${tag}`,
    description: "A creative AI template for video generation",
    category: "ai",
    type: "template",
    author: "bob",
  });
  const c = publish({
    slug: `gamma-asset-${tag}`,
    name: `Gamma Asset ${tag}`,
    description: "A high-quality 3D asset pack",
    category: "asset",
    type: "asset",
    author: "carol",
  });
  const d = publish({
    slug: `delta-plugin-${tag}`,
    name: `Delta Plugin ${tag}`,
    description: "A workflow automation plugin",
    category: "workflow",
    type: "plugin",
    author: "dave",
  });
  return { a, b, c, d };
}

// ---------------------------------------------------------------------------
// publish creates listing
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — publish creates listing", () => {
  it("returns a full MarketplaceListing with generated uuid and slug", () => {
    const listing = repo.publish({
      slug: "my-plugin",
      name: "My Plugin",
      description: "Does things",
      category: "ui",
      type: "plugin",
      version: "2.0.0",
    });

    expect(listing.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(listing.slug).toBe("my-plugin");
    expect(listing.name).toBe("My Plugin");
    expect(listing.description).toBe("Does things");
    expect(listing.category).toBe("ui");
    expect(listing.type).toBe("plugin");
    expect(listing.version).toBe("2.0.0");
    expect(listing.downloads).toBe(0);
    expect(listing.rating).toBe(0);
    expect(listing.ratingCount).toBe(0);
    expect(listing.installed).toBe(false);
    expect(listing.listed).toBe(true);
    expect(listing.screenshots).toEqual([]);
    expect(listing.createdAt).toBeTruthy();
    expect(listing.updatedAt).toBeTruthy();
  });

  it("applies defaults for optional fields", () => {
    const listing = repo.publish({ slug: "defaults", name: "Defaults" });

    expect(listing.author).toBe("");
    expect(listing.category).toBe("utility");
    expect(listing.type).toBe("plugin");
    expect(listing.version).toBe("1.0.0");
    expect(listing.icon).toBeNull();
    expect(listing.manifestId).toBeNull();
    expect(listing.downloadUrl).toBeNull();
  });

  it("stores screenshots as a parsed array", () => {
    const listing = repo.publish({
      slug: "screens",
      name: "Screens",
      screenshots: ["https://img.example.com/1.png", "https://img.example.com/2.png"],
    });

    expect(listing.screenshots).toEqual([
      "https://img.example.com/1.png",
      "https://img.example.com/2.png",
    ]);
  });
});

// ---------------------------------------------------------------------------
// getByUuid / getBySlug
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — getByUuid / getBySlug", () => {
  it("retrieves a listing by uuid", () => {
    const created = publish({ slug: "uuid-lookup", name: "UUID Lookup" });
    const found = repo.getByUuid(created.uuid);

    expect(found).toBeDefined();
    expect(found!.uuid).toBe(created.uuid);
    expect(found!.name).toBe("UUID Lookup");
  });

  it("retrieves a listing by slug", () => {
    const _created = publish({ slug: "slug-lookup", name: "Slug Lookup" });
    const found = repo.getBySlug("slug-lookup");

    expect(found).toBeDefined();
    expect(found!.slug).toBe("slug-lookup");
    expect(found!.name).toBe("Slug Lookup");
  });

  it("returns undefined for non-existent uuid", () => {
    expect(repo.getByUuid("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("returns undefined for non-existent slug", () => {
    expect(repo.getBySlug("no-such-slug")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// list default
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — list default", () => {
  it("returns all listed items", () => {
    const { a, b, c } = publishSampleSet();
    const items = repo.list();

    expect(items.length).toBeGreaterThanOrEqual(3);
    const slugs = items.map((i) => i.slug);
    expect(slugs).toContain(a.slug);
    expect(slugs).toContain(b.slug);
    expect(slugs).toContain(c.slug);
  });
});

// ---------------------------------------------------------------------------
// list with category filter
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — list with category filter", () => {
  it("returns only items matching the category", () => {
    publishSampleSet();
    const aiItems = repo.list({ category: "ai" });

    for (const item of aiItems) {
      expect(item.category).toBe("ai");
    }
    expect(aiItems.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// list with type filter
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — list with type filter", () => {
  it("returns only items matching the type", () => {
    publishSampleSet();
    const templates = repo.list({ type: "template" });

    for (const item of templates) {
      expect(item.type).toBe("template");
    }
    expect(templates.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// search via FTS
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — search via FTS", () => {
  it("finds items with matching term in name/description", () => {
    publishSampleSet();
    const results = repo.search("plugin");

    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const item of results) {
      const haystack = `${item.name} ${item.description}`.toLowerCase();
      expect(haystack).toContain("plugin");
    }
  });

  it("returns empty array for unmatched query", () => {
    // Use a safe token (no hyphens — FTS5 treats '-' as NOT operator)
    const results = repo.search("zzznonexistentterm");
    expect(results).toEqual([]);
  });

  it("handles queries with special characters gracefully", () => {
    publish({ slug: "special-test", name: "Special (test) plugin!" });
    // FTS special characters should not crash
    const results = repo.search("(test)");
    expect(Array.isArray(results)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// popular
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — popular", () => {
  it("returns items sorted by downloads descending", () => {
    const { a, b } = publishSampleSet();
    repo.recordDownload(a.uuid);
    repo.recordDownload(a.uuid);
    repo.recordDownload(a.uuid);
    repo.recordDownload(b.uuid);

    const popular = repo.popular();
    // The first item should have the highest download count
    for (let i = 1; i < popular.length; i++) {
      expect(popular[i - 1]!.downloads).toBeGreaterThanOrEqual(popular[i]!.downloads);
    }
  });
});

// ---------------------------------------------------------------------------
// topRated
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — topRated", () => {
  it("returns items sorted by rating descending", () => {
    const { a, b } = publishSampleSet();
    repo.rate(a.uuid, { rating: 5 });
    repo.rate(b.uuid, { rating: 3 });

    const top = repo.topRated();
    // First items should have highest rating
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1]!.rating).toBeGreaterThanOrEqual(top[i]!.rating);
    }
  });
});

// ---------------------------------------------------------------------------
// featured — weighted score
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — featured", () => {
  it("ranks items using the weighted score formula (downloads*0.6 + rating*rating_count*0.4)", () => {
    const { a, b } = publishSampleSet();

    // a: 10 downloads, no ratings → score = 10 * 0.6 = 6
    for (let i = 0; i < 10; i++) repo.recordDownload(a.uuid);

    // b: 0 downloads, rating 5 from 4 votes → score = 5 * 4 * 0.4 = 8
    for (let i = 0; i < 4; i++) repo.rate(b.uuid, { rating: 5 });

    // Request enough to include our items (DB has accumulated rows from earlier tests)
    const featured = repo.featured(100);
    const slugs = featured.map((f) => f.slug);

    // b (score 8) should rank above a (score 6)
    const bIdx = slugs.indexOf(b.slug);
    const aIdx = slugs.indexOf(a.slug);
    expect(bIdx).not.toBe(-1);
    expect(aIdx).not.toBe(-1);
    expect(bIdx).toBeLessThan(aIdx);
  });

  it("respects the limit parameter", () => {
    publishSampleSet();
    const featured = repo.featured(2);
    expect(featured.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// markInstalled / markUninstalled
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — markInstalled / markUninstalled", () => {
  it("marks a listing as installed with version", () => {
    const listing = publish({ slug: "install-me", name: "Install Me" });
    expect(listing.installed).toBe(false);

    repo.markInstalled(listing.uuid, "2.5.0");
    const updated = repo.getByUuid(listing.uuid)!;
    expect(updated.installed).toBe(true);
    expect(updated.installedVersion).toBe("2.5.0");
  });

  it("marks a listing as uninstalled", () => {
    const listing = publish({ slug: "uninstall-me", name: "Uninstall Me" });
    repo.markInstalled(listing.uuid, "1.0.0");
    expect(repo.getByUuid(listing.uuid)!.installed).toBe(true);

    repo.markUninstalled(listing.uuid);
    const updated = repo.getByUuid(listing.uuid)!;
    expect(updated.installed).toBe(false);
    expect(updated.installedVersion).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recordDownload
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — recordDownload", () => {
  it("increments the download counter", () => {
    const listing = publish({ slug: "dl-test", name: "DL Test" });
    expect(listing.downloads).toBe(0);

    repo.recordDownload(listing.uuid);
    repo.recordDownload(listing.uuid);
    repo.recordDownload(listing.uuid);

    const updated = repo.getByUuid(listing.uuid)!;
    expect(updated.downloads).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// rate
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — rate", () => {
  it("calculates the average rating correctly across multiple ratings", () => {
    const listing = publish({ slug: "rate-test", name: "Rate Test" });

    repo.rate(listing.uuid, { rating: 4 });
    let updated = repo.getByUuid(listing.uuid)!;
    expect(updated.rating).toBe(4);
    expect(updated.ratingCount).toBe(1);

    repo.rate(listing.uuid, { rating: 2 });
    updated = repo.getByUuid(listing.uuid)!;
    // Average of 4 and 2 = 3
    expect(updated.rating).toBeCloseTo(3, 5);
    expect(updated.ratingCount).toBe(2);

    repo.rate(listing.uuid, { rating: 5 });
    updated = repo.getByUuid(listing.uuid)!;
    // Average of 4, 2, 5 = 11/3 ≈ 3.6667
    expect(updated.rating).toBeCloseTo(11 / 3, 4);
    expect(updated.ratingCount).toBe(3);
  });

  it("clamps ratings outside the 1–5 range", () => {
    const listing = publish({ slug: "clamp-test", name: "Clamp Test" });

    repo.rate(listing.uuid, { rating: 0 }); // should clamp to 1
    let updated = repo.getByUuid(listing.uuid)!;
    expect(updated.rating).toBe(1);

    repo.rate(listing.uuid, { rating: 10 }); // should clamp to 5
    updated = repo.getByUuid(listing.uuid)!;
    // Average of 1 and 5 = 3
    expect(updated.rating).toBeCloseTo(3, 5);
  });

  it("rounds non-integer ratings before clamping", () => {
    const listing = publish({ slug: "round-test", name: "Round Test" });

    repo.rate(listing.uuid, { rating: 3.7 }); // rounds to 4
    const updated = repo.getByUuid(listing.uuid)!;
    expect(updated.rating).toBe(4);
    expect(updated.ratingCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — delete", () => {
  it("removes a listing so it can no longer be retrieved", () => {
    const listing = publish({ slug: "delete-me", name: "Delete Me" });
    expect(repo.getByUuid(listing.uuid)).toBeDefined();

    repo.delete(listing.uuid);
    expect(repo.getByUuid(listing.uuid)).toBeUndefined();
    expect(repo.getBySlug("delete-me")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// count / installedCount
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — count / installedCount", () => {
  it("count returns the number of listed items", () => {
    const before = repo.count();
    publish({ slug: "count-a", name: "Count A" });
    publish({ slug: "count-b", name: "Count B" });
    expect(repo.count()).toBe(before + 2);
  });

  it("installedCount returns the number of installed items", () => {
    const before = repo.installedCount();
    const listing = publish({ slug: "inst-count", name: "Inst Count" });
    repo.markInstalled(listing.uuid, "1.0.0");
    expect(repo.installedCount()).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------
// categoryBreakdown
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — categoryBreakdown", () => {
  it("returns categories with correct counts, ordered by count descending", () => {
    publishSampleSet();
    // Plus any earlier test listings — just check our three are represented
    const breakdown = repo.categoryBreakdown();

    const categories = breakdown.map((r) => r.category);
    expect(categories).toContain("production");
    expect(categories).toContain("ai");
    expect(categories).toContain("asset");

    // Counts should be positive
    for (const { count } of breakdown) {
      expect(count).toBeGreaterThan(0);
    }

    // Ordered descending
    for (let i = 1; i < breakdown.length; i++) {
      expect(breakdown[i - 1]!.count).toBeGreaterThanOrEqual(breakdown[i]!.count);
    }
  });
});

// ---------------------------------------------------------------------------
// list with pagination
// ---------------------------------------------------------------------------

describe("MarketplaceRepository — list with pagination", () => {
  it("limit + offset correctly paginate results", () => {
    // Publish a few uniquely-named items for this test
    for (let i = 0; i < 5; i++) {
      publish({ slug: `page-${i}`, name: `Page ${i}` });
    }

    const page1 = repo.list({ sortBy: "created_at", sortOrder: "desc", limit: 2, offset: 0 });
    const page2 = repo.list({ sortBy: "created_at", sortOrder: "desc", limit: 2, offset: 2 });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);

    // Pages should not overlap
    const uuids1 = page1.map((i) => i.uuid);
    const uuids2 = page2.map((i) => i.uuid);
    for (const id of uuids1) {
      expect(uuids2).not.toContain(id);
    }
  });

  it("offset beyond total returns empty array", () => {
    const results = repo.list({ limit: 10, offset: 99999 });
    expect(results).toEqual([]);
  });
});
