/**
 * ProductionFs tests.
 *
 * Builds a throwaway studio home in the OS temp dir, mirrors the layout
 * the `aw` CLI creates (studio.json, projects/<name>/project.json, the
 * active-project pointer), and exercises the service against it.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductionFs } from "./production-fs.js";

const MANIFEST = {
  schema: "artworks/production",
  schema_version: 1,
  uuid: "test-uuid",
  id: "SIGNAL",
  name: "SIGNAL",
  type: "production",
  status: "draft",
  version: 1,
  created_at: "2026-01-01T00:00:00",
  updated_at: "2026-01-01T00:00:00",
  description: "A test film",
  tags: [],
  metadata: {},
};

let home: string;

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "artworks-explorer-"));
  // Initialize the studio marker.
  await writeFile(join(home, "studio.json"), "{}");
  await mkdir(join(home, "config"), { recursive: true });
  await mkdir(join(home, "projects"), { recursive: true });

  // Two productions.
  for (const name of ["SIGNAL", "ALPHA"]) {
    const root = join(home, "projects", name);
    await mkdir(root, { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "project.json"), JSON.stringify({ ...MANIFEST, name, id: name }));
  }
});

afterAll(async () => {
  await rm(home, { recursive: true, force: true });
});

describe("ProductionFs", () => {
  const service = () => new ProductionFs(home);

  it("lists productions sorted by name", async () => {
    const list = await service().listProductions();
    expect(list.map((p) => p.name)).toEqual(["ALPHA", "SIGNAL"]);
  });

  it("parses each production's manifest", async () => {
    const list = await service().listProductions();
    const signal = list.find((p) => p.name === "SIGNAL");
    expect(signal?.manifest?.type).toBe("production");
    expect(signal?.manifest?.description).toBe("A test film");
  });

  it("marks none active when the pointer is absent", async () => {
    const list = await service().listProductions();
    expect(list.every((p) => !p.isActive)).toBe(true);
  });

  it("openProduction sets the active pointer and marks the project active", async () => {
    await service().openProduction("SIGNAL");
    const active = await service().getActiveProduction();
    expect(active?.name).toBe("SIGNAL");
    expect(active?.isActive).toBe(true);
  });

  it("returns the production tree with all 9 capability dirs", async () => {
    const tree = await service().getProductionTree("SIGNAL");
    expect(tree.kind).toBe("production");
    expect(tree.children?.map((c) => c.name)).toEqual([
      "docs",
      "assets",
      "prompts",
      "storyboards",
      "keyframes",
      "renders",
      "audio",
      "exports",
      "automation",
    ]);
  });

  it("expands a directory's children", async () => {
    const tree = await service().getProductionTree("SIGNAL");
    const docs = tree.children?.find((c) => c.name === "docs");
    // Create a file under docs to expand.
    await writeFile(join(docs!.path, "note.md"), "# Note");
    const children = await service().expandNode(docs!.path);
    expect(children.some((c) => c.name === "note.md" && c.kind === "file")).toBe(true);
  });

  it("throws a structured error for a missing production", async () => {
    await expect(service().readManifest("NOPE")).rejects.toMatchObject({
      code: "PRODUCTION_NOT_FOUND",
    });
  });

  it("reports the studio as initialized", () => {
    expect(service().isStudioInitialized()).toBe(true);
  });
});
