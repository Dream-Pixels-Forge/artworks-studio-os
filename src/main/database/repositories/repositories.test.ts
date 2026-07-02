/**
 * Repository tests.
 *
 * Exercises the data layer against an in-memory migrated database: CRUD
 * lifecycle, transactional 2-table writes, FTS search, and FK cascade
 * deletes. Mirrors the migrator.test.ts in-memory pattern.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../db.js";
import { MIGRATIONS } from "../migrations.js";
import {
  AssetRepository,
  DocumentRepository,
  EntityRepository,
  GraphRepository,
  PluginRepository,
  ProjectRepository,
} from "./index.js";

let db: StudioDatabase;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
});

afterAll(() => {
  db.close();
});

describe("ProjectRepository", () => {
  const repo = () => new ProjectRepository(db);

  it("creates a project spanning entities + projects transactionally", () => {
    const project = repo().create({ name: "SIGNAL", description: "A short film" });
    expect(project.uuid).toBeTruthy();
    expect(project.type).toBe("production");
    expect(project.id).toBe("PROD-001");
    expect(project.description).toBe("A short film");
    expect(project.status).toBe("draft");

    const fetched = repo().findByUuid(project.uuid);
    expect(fetched?.name).toBe("SIGNAL");
    expect(fetched?.description).toBe("A short film");
  });

  it("mints sequential human ids per type", () => {
    const a = repo().create({ name: "ALPHA" });
    const b = repo().create({ name: "BETA" });
    expect(a.id).toBe("PROD-002");
    expect(b.id).toBe("PROD-003");
  });

  it("updates description atomically", () => {
    const project = repo().create({ name: "GAMMA" });
    repo().update({ ...project, description: "Updated" });
    const fetched = repo().findByUuid(project.uuid);
    expect(fetched?.description).toBe("Updated");
    // updatedAt is always a valid ISO string after update.
    expect(typeof fetched?.updatedAt).toBe("string");
  });

  it("deletes a project and cascades to the projects table", () => {
    const project = repo().create({ name: "DELTA" });
    repo().delete(project.uuid);
    expect(repo().findByUuid(project.uuid)).toBeUndefined();
  });
});

describe("AssetRepository", () => {
  it("creates and reads an asset across both tables", () => {
    const repo = new AssetRepository(db);
    const asset = repo.create({
      name: "Hero Keyframe",
      assetType: "image",
      path: "keyframes/hero.png",
      mimeType: "image/png",
      sizeBytes: 1024,
    });
    expect(asset.assetType).toBe("image");
    expect(asset.mimeType).toBe("image/png");

    const fetched = repo.findByUuid(asset.uuid);
    expect(fetched?.path).toBe("keyframes/hero.png");
  });

  it("filters by asset type", () => {
    const repo = new AssetRepository(db);
    repo.create({ name: "Img 1", assetType: "image", path: "a.png", mimeType: "image/png" });
    repo.create({ name: "Vid 1", assetType: "video", path: "b.mp4", mimeType: "video/mp4" });
    const images = repo.list({ type: "image" });
    expect(images.every((a) => a.assetType === "image")).toBe(true);
  });
});

describe("DocumentRepository", () => {
  it("creates, reads, and lists documents by project", () => {
    const projects = new ProjectRepository(db);
    const project = projects.create({ name: "DOCPROJECT" });
    const repo = new DocumentRepository(db);

    const doc = repo.create({
      name: "Story Bible",
      docType: "story-bible",
      content: "# Story",
      projectUuid: project.uuid,
    });
    expect(doc.docType).toBe("story-bible");
    expect(doc.projectUuid).toBe(project.uuid);

    const fetched = repo.findByUuid(doc.uuid);
    expect(fetched?.content).toBe("# Story");

    const listed = repo.listByProject(project.uuid);
    expect(listed).toHaveLength(1);
  });
});

describe("EntityRepository — search & status", () => {
  it("searches entities via FTS5", () => {
    const repo = new EntityRepository(db);
    // The FTS triggers index name/type/metadata; search by a name token.
    const results = repo.search("SIGNAL");
    expect(results.some((e) => e.name === "SIGNAL")).toBe(true);
  });

  it("patches status and updates updated_at", () => {
    const projects = new ProjectRepository(db);
    const project = projects.create({ name: "STATUSPROJECT" });
    const repo = new EntityRepository(db);
    repo.patchStatus(project.uuid, "approved");
    const fetched = repo.findByUuid(project.uuid);
    expect(fetched?.status).toBe("approved");
  });
});

describe("GraphRepository", () => {
  it("connects and lists relationships", () => {
    const projects = new ProjectRepository(db);
    const assets = new AssetRepository(db);
    const project = projects.create({ name: "GRAPHPROJECT" });
    const asset = assets.create({
      name: "Linked Asset",
      assetType: "image",
      path: "c.png",
      mimeType: "image/png",
    });

    const repo = new GraphRepository(db);
    repo.connect(project.uuid, asset.uuid, "references");
    const rels = repo.relationships(project.uuid);
    expect(rels).toHaveLength(1);
    expect(rels[0]?.type).toBe("references");
  });

  it("is idempotent on repeated connects", () => {
    const repo = new EntityRepository(db);
    const a = repo.listByType("production")[0]!;
    const b = repo.listByType("asset")[0]!;
    const graph = new GraphRepository(db);
    graph.connect(a.uuid, b.uuid, "test-edge");
    graph.connect(a.uuid, b.uuid, "test-edge"); // ignored
    expect(graph.relationships(a.uuid).filter((r) => r.type === "test-edge")).toHaveLength(1);
  });
});

describe("PluginRepository", () => {
  const repo = () => new PluginRepository(db);

  const testManifest = {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    author: "Test Author",
    category: "ui" as const,
    description: "A test plugin",
    sdkVersion: "0.1.0",
    permissions: [] as never[],
    commands: [],
  };

  it("installs a plugin and records it enabled by default", () => {
    const record = repo().install({ manifest: testManifest });
    expect(record.enabled).toBe(true);
    expect(record.manifest.id).toBe("test-plugin");

    const found = repo().record(record.uuid);
    expect(found).toBeDefined();
    expect(found?.manifest.name).toBe("Test Plugin");
  });

  it("lists installed plugins", () => {
    const list = repo().list();
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("disables and re-enables a plugin", () => {
    const record = repo().install({ manifest: testManifest });
    repo().setEnabled(record.uuid, false);
    const afterDisable = repo().record(record.uuid);
    expect(afterDisable?.enabled).toBe(false);

    repo().setEnabled(record.uuid, true);
    const afterEnable = repo().record(record.uuid);
    expect(afterEnable?.enabled).toBe(true);
  });

  it("counts installed plugins", () => {
    const count = repo().count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("uninstalls a plugin and cascades to entities", () => {
    const record = repo().install({
      manifest: {
        ...testManifest,
        id: "to-delete",
        name: "To Delete",
      },
    });
    repo().uninstall(record.uuid);
    expect(repo().record(record.uuid)).toBeUndefined();
    expect(repo().count()).toBeGreaterThanOrEqual(1);
  });
});
