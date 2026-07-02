/**
 * Knowledge Graph panel.
 *
 * Shows relationships between entities. Select an entity from the list
 * to see its outgoing edges (source → type → target). Connect new
 * relationships between two entities.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Entity {
  uuid: string;
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
}

export function KnowledgeGraphPanel() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [relations, setRelations] = useState<Relationship[]>([]);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [relType, setRelType] = useState("references");

  useEffect(() => {
    loadEntities();
  }, []);

  useEffect(() => {
    if (!selected) {
      setRelations([]);
      return;
    }
    loadRelations(selected);
  }, [selected]);

  async function loadEntities() {
    const types = ["production", "character", "scene", "shot", "asset", "document", "conversation", "prompt", "workflow"];
    const all: Entity[] = [];
    for (const t of types) {
      const list = await window.artworks.production.entity.listByType(t);
      if (Array.isArray(list)) all.push(...(list as Entity[]));
    }
    setEntities(all);
  }

  async function loadRelations(uuid: string) {
    const rels = await window.artworks.production.graph.relationships(uuid);
    setRelations(rels as Relationship[]);
  }

  async function connect() {
    if (!source || !target || !relType) return;
    await window.artworks.production.graph.connect(source, target, relType);
    if (selected === source) loadRelations(source);
  }

  async function disconnect(rel: Relationship) {
    await window.artworks.production.graph.disconnect(rel.source, rel.target, rel.type);
    if (selected) loadRelations(selected);
  }

  return (
    <div className="graph-panel">
      <h2 className="graph-panel__title">Knowledge Graph</h2>
      <div className="graph-panel__body">
        <div className="graph-panel__entities">
          <h3 className="graph-panel__subtitle">Entities ({entities.length})</h3>
          <ul className="graph-panel__entity-list">
            {entities.length === 0 && (
              <li className="graph-panel__empty">No entities.</li>
            )}
            {entities.map((e) => (
              <li
                key={e.uuid}
                className={`graph-panel__entity${selected === e.uuid ? " graph-panel__entity--active" : ""}`}
                onClick={() => setSelected(e.uuid)}
              >
                <span className="graph-panel__entity-name">{e.name}</span>
                <span className="graph-panel__entity-type">{e.type}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="graph-panel__relations">
          <h3 className="graph-panel__subtitle">
            Outgoing Links {selected ? `(${relations.length})` : ""}
          </h3>
          {selected ? (
            <ul className="graph-panel__relation-list">
              {relations.length === 0 && (
                <li className="graph-panel__empty">No outgoing relationships.</li>
              )}
              {relations.map((r, i) => (
                <li key={i} className="graph-panel__relation">
                  <span className="graph-panel__relation-type">{r.type}</span>
                  <span className="graph-panel__relation-arrow">{"\u2192"}</span>
                  <span className="graph-panel__relation-target">{r.target.slice(0, 8)}...</span>
                  <button
                    className="graph-panel__relation-delete"
                    onClick={() => disconnect(r)}
                    title="Remove link"
                  >
                    {"\u00d7"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="graph-panel__empty">Select an entity to see its links.</p>
          )}
          <div className="graph-panel__connect-form">
            <h4 className="graph-panel__form-title">Add Link</h4>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Source...</option>
              {entities.map((e) => (
                <option key={e.uuid} value={e.uuid}>{e.name}</option>
              ))}
            </select>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Target...</option>
              {entities.map((e) => (
                <option key={e.uuid} value={e.uuid}>{e.name}</option>
              ))}
            </select>
            <input
              placeholder="Relationship type"
              value={relType}
              onChange={(e) => setRelType(e.target.value)}
            />
            <button onClick={connect} disabled={!source || !target || !relType}>
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

panelRegistry.register({
  id: "knowledge-graph",
  title: "Knowledge Graph",
  icon: "\u{1f578}", // 🕸
  component: KnowledgeGraphPanel,
  defaultSlot: "center",
  defaultVisible: false,
});