/**
 * GraphRepository tests.
 *
 * Exercises the knowledge-graph edge layer against an in-memory migrated
 * database: connect/disconnect, BFS shortest path, subgraph extraction,
 * idempotency, and entity-relationship queries.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../db.js";
import { MIGRATIONS } from "../migrations.js";
import {
  GraphRepository,
  EntityRepository,
  ProjectRepository,
} from "./index.js";

let db: StudioDatabase;
let graph: GraphRepository;
let entities: EntityRepository;
let _projects: ProjectRepository;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
  graph = new GraphRepository(db);
  entities = new EntityRepository(db);
  _projects = new ProjectRepository(db);
});

afterAll(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// Helpers — create lightweight entities directly in the DB
// ---------------------------------------------------------------------------

function makeEntity(name: string, type = "character"): string {
  const uuid = crypto.randomUUID();
  const now = new Date().toISOString();
  const id = `${type.toUpperCase()}-${String(entities.countByType(type) + 1).padStart(3, "0")}`;
  db.exec(
    `INSERT INTO entities (uuid, id, name, type, status, version, created_at, updated_at, owner, tags, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid, id, name, type, "draft", 1, now, now, null, JSON.stringify([]), JSON.stringify({})],
  );
  return uuid;
}

// ---------------------------------------------------------------------------
// connect + relationships
// ---------------------------------------------------------------------------

describe("GraphRepository — connect + relationships", () => {
  it("creates edges and lists them from the source", () => {
    const a = makeEntity("NodeA");
    const b = makeEntity("NodeB");

    graph.connect(a, b, "references");
    const rels = graph.relationships(a);

    expect(rels).toHaveLength(1);
    expect(rels[0]).toEqual({ source: a, target: b, type: "references" });
  });

  it("stores multiple outgoing edges from the same source", () => {
    const a = makeEntity("MultiA");
    const b = makeEntity("MultiB");
    const c = makeEntity("MultiC");

    graph.connect(a, b, "links");
    graph.connect(a, c, "references");

    const rels = graph.relationships(a);
    expect(rels).toHaveLength(2);
    const types = rels.map((r) => r.type).sort();
    expect(types).toEqual(["links", "references"]);
  });
});

// ---------------------------------------------------------------------------
// connect idempotent
// ---------------------------------------------------------------------------

describe("GraphRepository — connect idempotent", () => {
  it("does not duplicate an edge when connecting the same triple twice", () => {
    const a = makeEntity("IdemA");
    const b = makeEntity("IdemB");

    graph.connect(a, b, "derives");
    graph.connect(a, b, "derives"); // no-op

    const rels = graph.relationships(a).filter((r) => r.type === "derives");
    expect(rels).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

describe("GraphRepository — disconnect", () => {
  it("removes an edge and it no longer appears", () => {
    const a = makeEntity("DelA");
    const b = makeEntity("DelB");

    graph.connect(a, b, "temp");
    expect(graph.relationships(a)).toHaveLength(1);

    graph.disconnect(a, b, "temp");
    expect(graph.relationships(a)).toHaveLength(0);
  });

  it("only removes the specified edge, not other edges", () => {
    const a = makeEntity("SelA");
    const b = makeEntity("SelB");
    const c = makeEntity("SelC");

    graph.connect(a, b, "keep");
    graph.connect(a, c, "remove");

    graph.disconnect(a, c, "remove");

    const rels = graph.relationships(a);
    expect(rels).toHaveLength(1);
    expect(rels[0]?.type).toBe("keep");
    expect(rels[0]?.target).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// allRelationships
// ---------------------------------------------------------------------------

describe("GraphRepository — allRelationships", () => {
  it("returns all edges across the entire graph", () => {
    const a = makeEntity("AllA");
    const b = makeEntity("AllB");
    const c = makeEntity("AllC");

    graph.connect(a, b, "e1");
    graph.connect(b, c, "e2");

    const all = graph.allRelationships();
    const types = all.map((r) => r.type);
    expect(types).toContain("e1");
    expect(types).toContain("e2");
  });
});

// ---------------------------------------------------------------------------
// allGraphEntities
// ---------------------------------------------------------------------------

describe("GraphRepository — allGraphEntities", () => {
  it("returns only entities that appear in at least one relationship", () => {
    const isolated = makeEntity("Isolated");
    const a = makeEntity("LinkedA");
    const b = makeEntity("LinkedB");

    graph.connect(a, b, "bridge");

    const graphEntities = graph.allGraphEntities();
    const uuids = graphEntities.map((e) => e.uuid);

    expect(uuids).toContain(a);
    expect(uuids).toContain(b);
    expect(uuids).not.toContain(isolated);
  });
});

// ---------------------------------------------------------------------------
// neighbors
// ---------------------------------------------------------------------------

describe("GraphRepository — neighbors", () => {
  it("returns both outgoing and incoming relationships", () => {
    const a = makeEntity("NbA");
    const b = makeEntity("NbB");
    const c = makeEntity("NbC");

    // a → b (outgoing for a)
    graph.connect(a, b, "outgoing");
    // c → a (incoming for a)
    graph.connect(c, a, "incoming");

    const rels = graph.neighbors(a);
    expect(rels).toHaveLength(2);

    const types = rels.map((r) => r.type).sort();
    expect(types).toEqual(["incoming", "outgoing"]);
  });

  it("returns empty array for entity with no relationships", () => {
    const orphan = makeEntity("Orphan");
    expect(graph.neighbors(orphan)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// shortestPath — same node
// ---------------------------------------------------------------------------

describe("GraphRepository — shortestPath", () => {
  it("returns [A] when from and to are the same node", () => {
    const a = makeEntity("SameA");
    expect(graph.shortestPath(a, a)).toEqual([a]);
  });

  // --- direct edge ---
  it("returns [A, B] for a direct edge A→B", () => {
    const a = makeEntity("DirA");
    const b = makeEntity("DirB");

    graph.connect(a, b, "direct");

    expect(graph.shortestPath(a, b)).toEqual([a, b]);
  });

  // --- multi-hop ---
  it("returns [A, B, C] for A→B→C", () => {
    const a = makeEntity("HopA");
    const b = makeEntity("HopB");
    const c = makeEntity("HopC");

    graph.connect(a, b, "step1");
    graph.connect(b, c, "step2");

    expect(graph.shortestPath(a, c)).toEqual([a, b, c]);
  });

  // --- no path ---
  it("returns null when no path exists", () => {
    const a = makeEntity("NoPathA");
    const b = makeEntity("NoPathB");

    // No edges between them.
    expect(graph.shortestPath(a, b)).toBeNull();
  });

  // --- reverse traversal ---
  it("finds a path via reverse edges (C→A when only A→C exists)", () => {
    const a = makeEntity("RevA");
    const c = makeEntity("RevC");

    // Only A→C edge exists; BFS should still find C→A.
    graph.connect(a, c, "forward");

    const path = graph.shortestPath(c, a);
    expect(path).not.toBeNull();
    expect(path).toEqual([c, a]);
  });

  // --- longer multi-hop ---
  it("finds the shortest path through a diamond graph", () => {
    const a = makeEntity("DiaA");
    const b = makeEntity("DiaB");
    const c = makeEntity("DiaC");
    const d = makeEntity("DiaD");

    // A→B, A→C, B→D, C→D
    graph.connect(a, b, "ab");
    graph.connect(a, c, "ac");
    graph.connect(b, d, "bd");
    graph.connect(c, d, "cd");

    const path = graph.shortestPath(a, d);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(a);
    expect(path![path!.length - 1]).toBe(d);
    expect(path!.length).toBe(3); // either A→B→D or A→C→D
  });
});

// ---------------------------------------------------------------------------
// subgraph
// ---------------------------------------------------------------------------

describe("GraphRepository — subgraph", () => {
  it("returns only the center entity with 0 hops", () => {
    const center = makeEntity("Center");
    const other = makeEntity("Other");

    graph.connect(center, other, "link");

    const sg = graph.subgraph(center, 0);
    expect(sg.entities).toHaveLength(1);
    expect(sg.entities[0]?.uuid).toBe(center);
    expect(sg.relationships).toHaveLength(0);
  });

  it("returns center + direct neighbors with 1 hop (default 2)", () => {
    const a = makeEntity("SgA");
    const b = makeEntity("SgB");
    const c = makeEntity("SgC");

    graph.connect(a, b, "ab");
    graph.connect(b, c, "bc");

    const sg = graph.subgraph(a, 1);
    const uuids = sg.entities.map((e) => e.uuid);

    expect(uuids).toContain(a);
    expect(uuids).toContain(b);
    expect(uuids).not.toContain(c); // 2 hops away

    // Only relationships where both endpoints are inside the subgraph.
    expect(sg.relationships).toHaveLength(1);
    expect(sg.relationships[0]?.type).toBe("ab");
  });

  it("returns entities within 2 hops (default maxHops)", () => {
    const a = makeEntity("Sg2A");
    const b = makeEntity("Sg2B");
    const c = makeEntity("Sg2C");

    graph.connect(a, b, "ab2");
    graph.connect(b, c, "bc2");

    const sg = graph.subgraph(a); // default maxHops = 2
    const uuids = sg.entities.map((e) => e.uuid);

    expect(uuids).toContain(a);
    expect(uuids).toContain(b);
    expect(uuids).toContain(c);

    expect(sg.relationships).toHaveLength(2);
  });

  it("filters relationships so both endpoints are in the subgraph", () => {
    const a = makeEntity("FiltA");
    const b = makeEntity("FiltB");
    const c = makeEntity("FiltC");
    const d = makeEntity("FiltD");

    // a→b, b→c, c→d
    graph.connect(a, b, "ab3");
    graph.connect(b, c, "bc3");
    graph.connect(c, d, "cd3");

    // Subgraph around a with 2 hops includes a, b, c — but not d.
    const sg = graph.subgraph(a, 2);
    const uuids = sg.entities.map((e) => e.uuid);

    expect(uuids).toContain(a);
    expect(uuids).toContain(b);
    expect(uuids).toContain(c);
    expect(uuids).not.toContain(d);

    // ab3 (a→b) and bc3 (b→c) are both inside; cd3 (c→d) should be excluded.
    const relTypes = sg.relationships.map((r) => r.type).sort();
    expect(relTypes).toEqual(["ab3", "bc3"]);
  });

  it("includes incoming relationships in the subgraph", () => {
    const a = makeEntity("IncA");
    const b = makeEntity("IncB");
    const c = makeEntity("IncC");

    // c→b, b→a
    graph.connect(c, b, "cb");
    graph.connect(b, a, "ba");

    const sg = graph.subgraph(a, 2);
    const uuids = sg.entities.map((e) => e.uuid);

    expect(uuids).toContain(a);
    expect(uuids).toContain(b);
    expect(uuids).toContain(c);

    const relTypes = sg.relationships.map((r) => r.type).sort();
    expect(relTypes).toEqual(["ba", "cb"]);
  });

  it("returns empty results for an isolated entity with no relationships", () => {
    const lone = makeEntity("LoneSub");

    const sg = graph.subgraph(lone, 1);
    expect(sg.entities).toHaveLength(1);
    expect(sg.entities[0]?.uuid).toBe(lone);
    expect(sg.relationships).toHaveLength(0);
  });
});
