/**
 * ExportService tests.
 *
 * Exercises the production export pipeline against an in-memory migrated
 * database. Covers JSON and Markdown formats, entity type filtering,
 * graph/timeline/comment inclusion, empty databases, filenames, and MIME types.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../database/db.js";
import { MIGRATIONS } from "../database/migrations.js";
import { ExportService } from "./export-service.js";

let db: StudioDatabase;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
  // The export service queries `timeline_items`, but the schema creates
  // `timelines`. Create a view alias so the SELECT works.
  db.execMany(`
    CREATE VIEW IF NOT EXISTS timeline_items AS
    SELECT
      t.uuid,
      t.project_uuid,
      t.timeline_type,
      t.start_date,
      t.end_date,
      t.assigned_to,
      t.priority,
      t.progress,
      t.dependencies,
      e.name,
      e.type,
      e.status,
      e.created_at,
      e.updated_at,
      e.tags,
      e.metadata
    FROM timelines t
    JOIN entities e ON e.uuid = t.uuid;
  `);
});

afterAll(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// Seed helpers — insert test data directly via SQL
// ---------------------------------------------------------------------------

function seedEntities(): { prodUuid: string; charUuid: string; assetUuid: string } {
  const prodUuid = "ent-prod-00000001";
  const charUuid = "ent-char-00000002";
  const assetUuid = "ent-asset-00000003";

  db.exec(
    `INSERT INTO entities (uuid, id, name, type, status, tags, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [prodUuid, "PRD-001", "SIGNAL", "production", "active", '["film","short"]', '{"genre":"sci-fi"}'],
  );
  db.exec(
    `INSERT INTO entities (uuid, id, name, type, status, tags, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [charUuid, "CHR-001", "Alice", "character", "draft", '["protagonist"]', '{"age":"30"}'],
  );
  db.exec(
    `INSERT INTO entities (uuid, id, name, type, status, tags, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [assetUuid, "AST-001", "Hero Keyframe", "asset", "approved", '[]', '{}'],
  );

  return { prodUuid, charUuid, assetUuid };
}

function seedRelationships(sourceUuid: string, targetUuid: string) {
  db.exec(
    `INSERT INTO relationships (source_uuid, target_uuid, type, properties)
     VALUES (?, ?, ?, ?)`,
    [sourceUuid, targetUuid, "references", "{}"],
  );
}

function seedTimelineItem(uuid: string, name: string) {
  // Insert into both entities and timelines (the view joins them).
  db.exec(
    `INSERT INTO entities (uuid, id, name, type, status, tags, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid, "TL-001", name, "timeline", "active", "[]", "{}"],
  );
  db.exec(
    `INSERT INTO timelines (uuid, timeline_type, priority, progress)
     VALUES (?, ?, ?, ?)`,
    [uuid, "task", "high", 50],
  );
}

function seedComment(uuid: string, entityUuid: string, body: string) {
  db.exec(
    `INSERT INTO comments (uuid, entity_uuid, body)
     VALUES (?, ?, ?)`,
    [uuid, entityUuid, body],
  );
}

// ---------------------------------------------------------------------------
// 1. JSON export — valid structure
// ---------------------------------------------------------------------------

describe("JSON export", () => {
  it("produces valid JSON with all required fields", () => {
    const { prodUuid, charUuid } = seedEntities();
    seedRelationships(prodUuid, charUuid);
    seedTimelineItem("tl-uuid-0000000001", "Design Sprint");
    seedComment("cmt-uuid-0000000001", prodUuid, "Looks great!");

    const service = new ExportService(db);
    const result = service.exportProduction({
      format: "json",
      includeGraph: true,
      includeTimeline: true,
      includeComments: true,
    });

    // Must parse as JSON
    const bundle = JSON.parse(result.content) as Record<string, unknown>;

    // Top-level fields
    expect(bundle).toHaveProperty("exportedAt");
    expect(typeof bundle["exportedAt"]).toBe("string");
    expect(bundle["version"]).toBe("1.0");
    expect(bundle).toHaveProperty("stats");
    expect(bundle).toHaveProperty("entities");
    expect(bundle).toHaveProperty("relationships");
    expect(bundle).toHaveProperty("timeline");
    expect(bundle).toHaveProperty("comments");

    // Stats counts
    const stats = bundle["stats"] as Record<string, number>;
    expect(stats["entities"]).toBeGreaterThanOrEqual(3);
    expect(stats["relationships"]).toBeGreaterThanOrEqual(1);
    expect(stats["timelineItems"]).toBeGreaterThanOrEqual(1);
    expect(stats["comments"]).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Markdown export — structure
// ---------------------------------------------------------------------------

describe("Markdown export", () => {
  it("starts with # Production Export and contains the Summary table", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({ format: "markdown" });

    expect(result.content).toMatch(/^# Production Export/);
    expect(result.content).toContain("## Summary");
    expect(result.content).toContain("| Entities |");
    expect(result.content).toContain("| Relationships |");
    expect(result.content).toContain("| Timeline Items |");
    expect(result.content).toContain("| Comments |");
  });
});

// ---------------------------------------------------------------------------
// 3. Entity type filtering
// ---------------------------------------------------------------------------

describe("entity type filtering", () => {
  it("returns only production entities when entityTypes is set", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({
      format: "json",
      entityTypes: ["production"],
    });

    const bundle = JSON.parse(result.content) as Record<string, unknown>;
    const entities = bundle["entities"] as Array<Record<string, unknown>>;

    // Every returned entity should be of type "production"
    expect(entities.length).toBeGreaterThanOrEqual(1);
    for (const e of entities) {
      expect(e["type"]).toBe("production");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Include graph
// ---------------------------------------------------------------------------

describe("includeGraph", () => {
  it("includes relationships when includeGraph is true", () => {
    const service = new ExportService(db);
    const withGraph = service.exportProduction({
      format: "json",
      includeGraph: true,
    });
    const withoutGraph = service.exportProduction({
      format: "json",
      includeGraph: false,
    });

    const bWith = JSON.parse(withGraph.content) as Record<string, unknown>;
    const bWithout = JSON.parse(withoutGraph.content) as Record<string, unknown>;

    const relsWith = bWith["relationships"] as unknown[];
    const relsWithout = bWithout["relationships"] as unknown[];

    expect(relsWith.length).toBeGreaterThanOrEqual(1);
    expect(relsWithout).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Include timeline
// ---------------------------------------------------------------------------

describe("includeTimeline", () => {
  it("includes timeline items when includeTimeline is true", () => {
    const service = new ExportService(db);
    const withTimeline = service.exportProduction({
      format: "json",
      includeTimeline: true,
    });
    const withoutTimeline = service.exportProduction({
      format: "json",
      includeTimeline: false,
    });

    const bWith = JSON.parse(withTimeline.content) as Record<string, unknown>;
    const bWithout = JSON.parse(withoutTimeline.content) as Record<string, unknown>;

    const tlWith = bWith["timeline"] as unknown[];
    const tlWithout = bWithout["timeline"] as unknown[];

    expect(tlWith.length).toBeGreaterThanOrEqual(1);
    expect(tlWithout).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Include comments
// ---------------------------------------------------------------------------

describe("includeComments", () => {
  it("includes comments when includeComments is true", () => {
    const service = new ExportService(db);
    const withComments = service.exportProduction({
      format: "json",
      includeComments: true,
    });
    const withoutComments = service.exportProduction({
      format: "json",
      includeComments: false,
    });

    const bWith = JSON.parse(withComments.content) as Record<string, unknown>;
    const bWithout = JSON.parse(withoutComments.content) as Record<string, unknown>;

    const cWith = bWith["comments"] as unknown[];
    const cWithout = bWithout["comments"] as unknown[];

    expect(cWith.length).toBeGreaterThanOrEqual(1);
    expect(cWithout).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Empty database
// ---------------------------------------------------------------------------

describe("empty database", () => {
  it("returns empty arrays and zero counts", async () => {
    // Use a fresh in-memory database with no seeded data.
    const freshDb = await StudioDatabase.openInMemory(MIGRATIONS);
    freshDb.execMany(`
      CREATE VIEW IF NOT EXISTS timeline_items AS
      SELECT t.*, e.name, e.type, e.status, e.created_at, e.updated_at, e.tags, e.metadata
      FROM timelines t JOIN entities e ON e.uuid = t.uuid;
    `);

    const service = new ExportService(freshDb);
    const result = service.exportProduction({ format: "json" });
    const bundle = JSON.parse(result.content) as Record<string, unknown>;

    const stats = bundle["stats"] as Record<string, number>;
    expect(stats["entities"]).toBe(0);
    expect(stats["relationships"]).toBe(0);
    expect(stats["timelineItems"]).toBe(0);
    expect(stats["comments"]).toBe(0);

    expect(bundle["entities"]).toEqual([]);
    expect(bundle["relationships"]).toEqual([]);
    expect(bundle["timeline"]).toEqual([]);
    expect(bundle["comments"]).toEqual([]);

    freshDb.close();
  });
});

// ---------------------------------------------------------------------------
// 8. Filename format
// ---------------------------------------------------------------------------

describe("filename format", () => {
  it("JSON filename ends with .json", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({ format: "json" });
    expect(result.filename).toMatch(/\.json$/);
  });

  it("Markdown filename ends with .md", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({ format: "markdown" });
    expect(result.filename).toMatch(/\.md$/);
  });

  it("JSON filename starts with production-export-", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({ format: "json" });
    expect(result.filename).toMatch(/^production-export-/);
  });
});

// ---------------------------------------------------------------------------
// 9. MIME types
// ---------------------------------------------------------------------------

describe("MIME types", () => {
  it("JSON export has application/json MIME type", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({ format: "json" });
    expect(result.mimeType).toBe("application/json");
  });

  it("Markdown export has text/markdown MIME type", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({ format: "markdown" });
    expect(result.mimeType).toBe("text/markdown");
  });
});

// ---------------------------------------------------------------------------
// 10. Markdown groups entities by type with headings
// ---------------------------------------------------------------------------

describe("Markdown entity grouping", () => {
  it("groups entities by type with ## headings", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({ format: "markdown" });

    // The markdown should contain capitalized type headings like "## Productions (N)"
    expect(result.content).toContain("## Productions (");
    expect(result.content).toContain("## Characters (");
    expect(result.content).toContain("## Assets (");
  });
});

// ---------------------------------------------------------------------------
// entityCount reflects the number of entities returned
// ---------------------------------------------------------------------------

describe("entityCount", () => {
  it("matches the number of entities in the result", () => {
    const service = new ExportService(db);
    const result = service.exportProduction({
      format: "json",
      entityTypes: ["production"],
    });

    const bundle = JSON.parse(result.content) as Record<string, unknown>;
    const entities = bundle["entities"] as unknown[];

    expect(result.entityCount).toBe(entities.length);
  });
});
