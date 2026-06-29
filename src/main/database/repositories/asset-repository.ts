/**
 * Asset repository.
 *
 * Assets span `entities` (generic fields) + `assets` (asset_type, path,
 * mime_type, size_bytes). Transactional writes keep them consistent.
 */
import type { Asset } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import { entityRowToEntity, type EntityRow } from "../entity-mapper.js";

interface AssetRow {
  asset_type: string;
  path: string;
  mime_type: string;
  size_bytes: number | null;
}

export interface CreateAssetInput {
  name: string;
  assetType: Asset["assetType"];
  path: string;
  mimeType: string;
  sizeBytes?: number;
}

export class AssetRepository {
  private readonly entities: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entities = new EntityRepository(db);
  }

  create(input: CreateAssetInput): Asset {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const asset: Asset = {
        uuid,
        id: this.entities.nextId("IMG", "asset"),
        name: input.name,
        type: "asset",
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        tags: [],
        metadata: {},
        assetType: input.assetType,
        path: input.path,
        mimeType: input.mimeType,
      };
      this.entities.insertEntity(asset);
      this.db.exec(
        "INSERT INTO assets (uuid, asset_type, path, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)",
        [uuid, input.assetType, input.path, input.mimeType, input.sizeBytes ?? null],
      );
      return asset;
    });
  }

  findByUuid(uuid: string): Asset | undefined {
    const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ? AND type = ?", [
      uuid,
      "asset",
    ]);
    if (!row) return undefined;
    const typeRow = this.db.get<AssetRow>("SELECT * FROM assets WHERE uuid = ?", [uuid]);
    if (!typeRow) return undefined;
    return {
      ...entityRowToEntity(row),
      assetType: typeRow.asset_type as Asset["assetType"],
      path: typeRow.path,
      mimeType: typeRow.mime_type,
    } as Asset;
  }

  list(filter?: { type?: Asset["assetType"] }): Asset[] {
    const rows = this.db.all<EntityRow>(
      "SELECT * FROM entities WHERE type = ? ORDER BY updated_at DESC",
      ["asset"],
    );
    return rows
      .map((row) => {
        const typeRow = this.db.get<AssetRow>("SELECT * FROM assets WHERE uuid = ?", [row.uuid]);
        if (!typeRow) return undefined;
        return {
          ...entityRowToEntity(row),
          assetType: typeRow.asset_type as Asset["assetType"],
          path: typeRow.path,
          mimeType: typeRow.mime_type,
        } as Asset;
      })
      .filter((a): a is Asset => a !== undefined)
      .filter((a) => (filter?.type ? a.assetType === filter.type : true));
  }

  delete(uuid: string): void {
    this.entities.deleteByUuid(uuid);
  }
}
