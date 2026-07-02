/**
 * Version History panel.
 *
 * Shows the recorded snapshots for an entity, newest first. Lets the
 * user view any past version. Uses the version IPC bridge.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface VersionSnapshot {
  id: number;
  entityUuid: string;
  version: number;
  snapshot: {
    uuid: string;
    id: string;
    name: string;
    type: string;
    status: string;
    version: number;
    tags: string[];
    metadata: Record<string, unknown>;
  };
  changedBy?: string;
  changedAt: string;
}

export function VersionHistoryPanel() {
  const [entityUuid, setEntityUuid] = useState("");
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [selected, setSelected] = useState<VersionSnapshot | null>(null);

  useEffect(() => {
    if (!entityUuid) {
      setVersions([]);
      return;
    }
    void load();
  }, [entityUuid]);

  async function load() {
    const list = await window.artworks.production.version.list(entityUuid);
    setVersions(list as VersionSnapshot[]);
  }

  return (
    <div className="version-panel">
      <h2 className="version-panel__title">Version History</h2>
      <div className="version-panel__search">
        <input
          className="version-panel__input"
          placeholder="Entity UUID..."
          value={entityUuid}
          onChange={(e) => setEntityUuid(e.target.value)}
        />
      </div>
      <div className="version-panel__body">
        <ul className="version-panel__list">
          {versions.length === 0 && (
            <li className="version-panel__empty">No versions recorded.</li>
          )}
          {versions.map((v) => (
            <li
              key={v.id}
              className={`version-panel__item${selected?.id === v.id ? " version-panel__item--active" : ""}`}
              onClick={() => setSelected(v)}
            >
              <span className="version-panel__item-version">v{v.version}</span>
              <span className="version-panel__item-name">{v.snapshot.name}</span>
              <span className="version-panel__item-time">{v.changedAt}</span>
            </li>
          ))}
        </ul>
        {selected && (
          <div className="version-panel__detail">
            <h3 className="version-panel__detail-title">Version {selected.version}</h3>
            <dl className="version-panel__detail-grid">
              <dt>Name</dt><dd>{selected.snapshot.name}</dd>
              <dt>ID</dt><dd>{selected.snapshot.id}</dd>
              <dt>Type</dt><dd>{selected.snapshot.type}</dd>
              <dt>Status</dt><dd>{selected.snapshot.status}</dd>
              <dt>Tags</dt><dd>{selected.snapshot.tags.join(", ") || "—"}</dd>
              <dt>Changed by</dt><dd>{selected.changedBy || "—"}</dd>
              <dt>Changed at</dt><dd>{selected.changedAt}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

panelRegistry.register({
  id: "version-history",
  title: "Version History",
  icon: "\u{1f551}", // −
  component: VersionHistoryPanel,
  defaultSlot: "bottom",
  defaultVisible: false,
});