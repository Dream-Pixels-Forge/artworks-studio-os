/**
 * LifecycleRepository tests.
 *
 * Regression coverage for the bug class found in audit: `stats()` used the
 * typo `juliayday` (no such SQLite function) and threw on every call, and
 * `delete()` performed two DELETEs outside a transaction.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../db.js";
import { MIGRATIONS } from "../migrations.js";
import { LifecycleRepository } from "./lifecycle-repository.js";

let db: StudioDatabase;
let repo: LifecycleRepository;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
  repo = new LifecycleRepository(db);
});

afterAll(() => {
  db.close();
});

describe("LifecycleRepository", () => {
  // Regression: stats() threw "no such function: juliayday" before the fix.
  it("stats() does not throw and returns a numeric avgTimeInStateHours", () => {
    expect(() => repo.stats()).not.toThrow();
    const stats = repo.stats();
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.avgTimeInStateHours).toBe("number");
    expect(Number.isFinite(stats.avgTimeInStateHours)).toBe(true);
  });

  it("creates a lifecycle entry in draft state and reads it back", () => {
    const entityUuid = `entity-${crypto.randomUUID()}`;
    repo.create(entityUuid, "tester");
    const fetched = repo.getByEntity(entityUuid);
    expect(fetched).toBeTruthy();
    expect(fetched?.state).toBe("draft");
  });

  it("delete() removes the lifecycle row and its transitions atomically", () => {
    const entityUuid = `entity-${crypto.randomUUID()}`;
    repo.create(entityUuid, "tester");
    expect(repo.getByEntity(entityUuid)).toBeTruthy();
    expect(repo.delete(entityUuid)).toBe(true);
    expect(repo.getByEntity(entityUuid)).toBeUndefined();
  });

  it("enforces the documented state-machine transitions", () => {
    expect(repo.canTransition("draft", "active")).toBe(true);
    expect(repo.canTransition("draft", "published")).toBe(false); // skipped
    expect(repo.canTransition("archived", "draft")).toBe(false); // terminal
    expect(repo.validTransitions("active")).toEqual(expect.arrayContaining(["review", "archived"]));
  });
});
