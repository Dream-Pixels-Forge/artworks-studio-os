/**
 * ProductionIntelligenceRepository tests.
 *
 * Regression coverage for the audit finding: teamProductivity() / productionSummary()
 * threw "no such function: juliayday" on every call because of a typo'd SQLite
 * function name (should be `julianday`). Three IPC channels were broken end-to-end
 * (intelligence:team, intelligence:summary, lifecycle:stats). This test calls each
 * affected method and asserts it returns without throwing and with finite numbers.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { StudioDatabase } from "../db.js";
import { MIGRATIONS } from "../migrations.js";
import { ProductionIntelligenceRepository } from "./production-intelligence-repository.js";

let db: StudioDatabase;
let repo: ProductionIntelligenceRepository;

beforeAll(async () => {
  db = await StudioDatabase.openInMemory(MIGRATIONS);
  repo = new ProductionIntelligenceRepository(db);
});

afterAll(() => {
  db.close();
});

describe("ProductionIntelligenceRepository", () => {
  // Regression: teamProductivity() threw "no such function: juliayday" before
  // the typo fix. The avgApprovalTimeHours query was the cause.
  it("teamProductivity() does not throw and returns finite numbers", () => {
    expect(() => repo.teamProductivity()).not.toThrow();
    const result = repo.teamProductivity();
    expect(typeof result.totalUsers).toBe("number");
    expect(typeof result.activeUsers).toBe("number");
    expect(typeof result.avgApprovalTimeHours).toBe("number");
    expect(Number.isFinite(result.avgApprovalTimeHours)).toBe(true);
  });

  it("productionSummary() does not throw (composed of all metric methods)", () => {
    expect(() => repo.productionSummary()).not.toThrow();
    const summary = repo.productionSummary();
    expect(summary).toHaveProperty("health");
    expect(summary).toHaveProperty("team");
    expect(summary).toHaveProperty("ai");
  });

  it("productionHealth() returns numeric counts without throwing", () => {
    expect(() => repo.productionHealth()).not.toThrow();
    const health = repo.productionHealth();
    expect(typeof health.entities).toBe("number");
    expect(typeof health.projects).toBe("number");
    expect(typeof health.overdueTimelines).toBe("number");
  });
});
