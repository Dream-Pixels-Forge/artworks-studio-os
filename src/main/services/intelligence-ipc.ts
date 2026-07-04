/**
 * Production Intelligence IPC handlers.
 *
 * Cross-cutting analytics that synthesize data from all production tables
 * into actionable insights.
 */
import { ipcMain } from "electron";
import type { StudioDatabase } from "@main/database/db.js";
import { ProductionIntelligenceRepository } from "@main/database/repositories/production-intelligence-repository.js";

export function registerIntelligenceIpc(db: StudioDatabase): void {
  const repo = new ProductionIntelligenceRepository(db);

  ipcMain.handle("intelligence:health", () => {
    return repo.productionHealth();
  });

  ipcMain.handle("intelligence:activity", (_event, since?: string) => {
    return repo.activityMetrics(since);
  });

  ipcMain.handle("intelligence:timeline", (_event, projectUuid?: string) => {
    return repo.timelineAnalytics(projectUuid);
  });

  ipcMain.handle("intelligence:entities", () => {
    return repo.entityAnalytics();
  });

  ipcMain.handle("intelligence:ai-usage", () => {
    return repo.aiUsageMetrics();
  });

  ipcMain.handle("intelligence:team", () => {
    return repo.teamProductivity();
  });

  ipcMain.handle("intelligence:summary", () => {
    return repo.productionSummary();
  });
}
