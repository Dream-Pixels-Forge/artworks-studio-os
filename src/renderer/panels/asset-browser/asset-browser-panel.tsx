/**
 * Asset Browser panel.
 *
 * Lists assets from the database with a type filter. Supports
 * creating and deleting assets. Uses the production IPC bridge.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Asset {
  uuid: string;
  id: string;
  name: string;
  status: string;
  assetType: "image" | "video" | "audio" | "document";
  path: string;
  mimeType: string;
}

type AssetFilter = "all" | Asset["assetType"];
const FILTERS: AssetFilter[] = ["all", "image", "video", "audio", "document"];

export function AssetBrowserPanel() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<AssetFilter>("all");

  useEffect(() => {
    refresh();
  }, [filter]);

  async function refresh() {
    const list = await window.artworks.production.asset.list(
      filter === "all" ? undefined : { type: filter },
    );
    setAssets(list as Asset[]);
  }

  async function remove(uuid: string) {
    await window.artworks.production.asset.delete(uuid);
    await refresh();
  }

  return (
    <div className="asset-browser">
      <h2 className="asset-browser__title">Assets</h2>
      <div className="asset-browser__filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`asset-browser__filter${filter === f ? " asset-browser__filter--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="asset-browser__grid">
        {assets.length === 0 && (
          <p className="asset-browser__empty">No assets found.</p>
        )}
        {assets.map((a) => (
          <div key={a.uuid} className="asset-browser__card">
            <div className="asset-browser__card-type">{a.assetType}</div>
            <span className="asset-browser__card-name">{a.name}</span>
            <span className="asset-browser__card-path">{a.path}</span>
            <button
              className="asset-browser__card-delete"
              onClick={() => remove(a.uuid)}
              title="Delete"
            >
              {"\u00d7"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

panelRegistry.register({
  id: "asset-browser",
  title: "Assets",
  icon: "\u{1f4c1}", // 📁
  component: AssetBrowserPanel,
  defaultSlot: "right",
  defaultVisible: false,
});