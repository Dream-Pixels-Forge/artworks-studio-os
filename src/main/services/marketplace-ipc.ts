/**
 * Marketplace IPC handlers.
 *
 * Wires the MarketplaceRepository to the renderer via IPC channels
 * prefixed with `marketplace:`.
 */
import { ipcMain } from "electron";
import { createLogger } from "@main/core/logger.js";
import type { StudioDatabase } from "@main/database/db.js";
import { MarketplaceRepository, type PublishListingInput, type ListingFilter, type RateListingInput } from "@main/database/repositories/marketplace-repository.js";

const log = createLogger("marketplace-ipc");

export function registerMarketplaceIpc(db: StudioDatabase): void {
  const repo = new MarketplaceRepository(db);

  ipcMain.handle("marketplace:list", (_e, filter?: ListingFilter) => {
    log.debug("list", filter);
    return repo.list(filter);
  });

  ipcMain.handle("marketplace:featured", (_e, limit?: number) => {
    log.debug("featured", { limit });
    return repo.featured(limit);
  });

  ipcMain.handle("marketplace:recent", (_e, limit?: number) => {
    log.debug("recent", { limit });
    return repo.recent(limit);
  });

  ipcMain.handle("marketplace:getByUuid", (_e, uuid: string) => {
    log.debug("getByUuid", { uuid });
    return repo.getByUuid(uuid);
  });

  ipcMain.handle("marketplace:getBySlug", (_e, slug: string) => {
    log.debug("getBySlug", { slug });
    return repo.getBySlug(slug);
  });

  ipcMain.handle("marketplace:publish", (_e, input: PublishListingInput) => {
    log.debug("publish", { slug: input.slug });
    return repo.publish(input);
  });

  ipcMain.handle("marketplace:install", (_e, uuid: string, version: string) => {
    log.debug("install", { uuid, version });
    repo.markInstalled(uuid, version);
    repo.recordDownload(uuid);
    return { success: true };
  });

  ipcMain.handle("marketplace:uninstall", (_e, uuid: string) => {
    log.debug("uninstall", { uuid });
    repo.markUninstalled(uuid);
    return { success: true };
  });

  ipcMain.handle("marketplace:rate", (_e, uuid: string, input: RateListingInput) => {
    log.debug("rate", { uuid, rating: input.rating });
    repo.rate(uuid, input);
    return { success: true };
  });

  ipcMain.handle("marketplace:delete", (_e, uuid: string) => {
    log.debug("delete", { uuid });
    repo.delete(uuid);
    return { success: true };
  });

  ipcMain.handle("marketplace:stats", () => {
    return {
      total: repo.count(),
      installed: repo.installedCount(),
      categories: repo.categoryBreakdown(),
    };
  });

  log.info("marketplace IPC registered");
}
