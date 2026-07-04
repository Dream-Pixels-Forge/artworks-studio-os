import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { panelRegistry } from "../../workspace/registry.js";

/* ── Types ── */
interface Entity {
  uuid: string;
  name: string;
  type: string;
  status: string;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
}

/* ── Node styling by entity type ── */
const NODE_COLORS: Record<string, string> = {
  production: "#3b82f6",
  character: "#8b5cf6",
  scene: "#10b981",
  shot: "#f59e0b",
  asset: "#ef4444",
  document: "#06b6d4",
  conversation: "#ec4899",
  prompt: "#f97316",
  workflow: "#6366f1",
};

const NODE_BG: Record<string, string> = {
  production: "rgba(59,130,246,0.1)",
  character: "rgba(139,92,246,0.1)",
  scene: "rgba(16,185,129,0.1)",
  shot: "rgba(245,158,11,0.1)",
  asset: "rgba(239,68,68,0.1)",
  document: "rgba(6,182,212,0.1)",
  conversation: "rgba(236,72,153,0.1)",
  prompt: "rgba(249,115,22,0.1)",
  workflow: "rgba(99,102,241,0.1)",
};

/* ── Custom node ── */
function ProductionNode({ data }: { data: Record<string, unknown> }): ReactElement {
  const name = String(data.name ?? "");
  const type = String(data.type ?? "");
  const status = String(data.status ?? "");
  const color = NODE_COLORS[type] ?? "#6b7280";
  const bg = NODE_BG[type] ?? "rgba(107,114,128,0.1)";

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: "6px",
        border: `2px solid ${color}`,
        background: bg,
        minWidth: "100px",
        maxWidth: "180px",
        textAlign: "center",
        fontSize: "12px",
      }}
    >
      <div style={{ fontWeight: 600, color, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name || "Unnamed"}
      </div>
      <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
        {type} · {status}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { production: ProductionNode };

/* ── Layout helper: simple force-directed approximation ── */
function layoutNodes(entities: Entity[]): Node[] {
  const byType = new Map<string, Entity[]>();
  for (const e of entities) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e);
  }

  const nodes: Node[] = [];
  const types = [...byType.keys()].sort();
  const radius = Math.max(150, types.length * 60);

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const items = byType.get(type)!;
    const angle = (i / types.length) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const itemAngle = angle + ((j - (items.length - 1) / 2) * 0.4);
      const dist = 40 + j * 30;
      nodes.push({
        id: item.uuid,
        type: "production",
        position: {
          x: cx + Math.cos(itemAngle) * dist,
          y: cy + Math.sin(itemAngle) * dist,
        },
        data: { name: item.name, type: item.type, status: item.status },
      });
    }
  }

  return nodes;
}

function buildEdges(relationships: Relationship[]): Edge[] {
  return relationships.map((r, i) => ({
    id: `e-${r.source}-${r.target}-${i}`,
    source: r.source,
    target: r.target,
    label: r.type,
    labelStyle: { fontSize: "10px", fill: "var(--text-secondary)" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280", width: 12, height: 12 },
    style: { stroke: "#6b7280", strokeWidth: 1.5 },
    animated: false,
  }));
}

/* ── Sidebar styles ── */
const sidebarStyle: CSSProperties = {
  width: "260px",
  borderLeft: "1px solid var(--border)",
  padding: "12px",
  overflow: "auto",
  flexShrink: 0,
};

const entityListItemStyle: CSSProperties = {
  padding: "6px 8px",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "12px",
  marginBottom: "2px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const badgeStyle = (color: string): CSSProperties => ({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
});

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--text)",
  fontSize: "12px",
  boxSizing: "border-box" as const,
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  width: "100%",
};

/* ── Main panel ── */
export default function KnowledgeGraphPanel(): ReactElement {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [edgeFilter, setEdgeFilter] = useState("");

  // New connection form
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newType, setNewType] = useState("references");

  // Load full graph
  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const graph = await window.artworks.production.graph.all();
      setEntities(graph.entities);
      setRelationships(graph.relationships);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Filtered entities
  const filteredEntities = useMemo(() => {
    if (!search) return entities;
    const q = search.toLowerCase();
    return entities.filter(
      (e) => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q),
    );
  }, [entities, search]);

  // Filtered relationships
  const filteredRelationships = useMemo(() => {
    if (!edgeFilter) return relationships;
    return relationships.filter((r) => r.type === edgeFilter);
  }, [relationships, edgeFilter]);

  // Unique edge types
  const edgeTypes = useMemo(() => [...new Set(relationships.map((r) => r.type))].sort(), [relationships]);

  // React Flow nodes & edges. Pass the type parameter so the hooks don't
  // infer `never[]` from the empty initial array.
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(layoutNodes(filteredEntities));
    setEdges(buildEdges(filteredRelationships));
  }, [filteredEntities, filteredRelationships, setNodes, setEdges]);

  // Entity detail
  const selected = useMemo(
    () => entities.find((e) => e.uuid === selectedEntity) ?? null,
    [entities, selectedEntity],
  );

  const selectedRelationships = useMemo(
    () => relationships.filter((r) => r.source === selectedEntity || r.target === selectedEntity),
    [relationships, selectedEntity],
  );

  // Connect
  const handleConnect = useCallback(async () => {
    if (!newSource || !newTarget || !newType) return;
    try {
      await window.artworks.production.graph.connect(newSource, newTarget, newType);
      setNewSource("");
      setNewTarget("");
      setNewType("references");
      await loadGraph();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [newSource, newTarget, newType, loadGraph]);

  // Disconnect
  const handleDisconnect = useCallback(async (source: string, target: string, type: string) => {
    try {
      await window.artworks.production.graph.disconnect(source, target, type);
      await loadGraph();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }, [loadGraph]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: "13px" }}>
        Loading graph...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Main canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        {error && (
          <div style={{ position: "absolute", top: 8, left: 8, right: 8, padding: "6px 10px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "4px", color: "#dc2626", fontSize: "12px", zIndex: 10 }}>
            {error}
            <span style={{ float: "right", cursor: "pointer" }} onClick={() => setError(null)}>×</span>
          </div>
        )}

        {/* Search bar overlay */}
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, display: "flex", gap: "6px" }}>
          <input
            style={{ ...inputStyle, width: "200px" }}
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select style={{ ...selectStyle, width: "120px" }} value={edgeFilter} onChange={(e) => setEdgeFilter(e.target.value)}>
            <option value="">All edges</option>
            {edgeTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {filteredEntities.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: "13px" }}>
            {entities.length === 0 ? "No entities with relationships yet." : "No entities match your search."}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            onNodeClick={(_, node) => setSelectedEntity(node.id)}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(n) => NODE_COLORS[String(n.data?.type)] ?? "#6b7280"}
              maskColor="rgba(0,0,0,0.3)"
            />
          </ReactFlow>
        )}

        {/* Stats overlay */}
        <div style={{ position: "absolute", bottom: 8, left: 8, fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-primary)", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
          {entities.length} entities · {relationships.length} relationships
        </div>
      </div>

      {/* Sidebar */}
      <div style={sidebarStyle}>
        {selected ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "14px" }}>{selected.name}</h3>
              <span style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "8px", background: NODE_COLORS[selected.type] ?? "#6b7280", color: "#fff" }}>
                {selected.type}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
              Status: {selected.status}
            </div>

            <h4 style={{ margin: "0 0 6px", fontSize: "12px" }}>Connections ({selectedRelationships.length})</h4>
            {selectedRelationships.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>No connections</div>
            ) : (
              selectedRelationships.map((r, i) => {
                const other = r.source === selectedEntity ? r.target : r.source;
                const otherEntity = entities.find((e) => e.uuid === other);
                const direction = r.source === selectedEntity ? "→" : "←";
                return (
                  <div key={`${r.type}-${other}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: "12px", borderBottom: "1px solid var(--border)" }}>
                    <span>
                      {direction} <strong>{r.type}</strong> {otherEntity?.name ?? other.slice(0, 8)}
                    </span>
                    <span
                      style={{ cursor: "pointer", color: "#dc2626", fontSize: "14px" }}
                      onClick={() => handleDisconnect(r.source, r.target, r.type)}
                      title="Remove connection"
                    >
                      ×
                    </span>
                  </div>
                );
              })
            )}

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />
          </>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>
            Click a node to view details
          </div>
        )}

        {/* New connection */}
        <h4 style={{ margin: "0 0 6px", fontSize: "12px" }}>New Connection</h4>
        <select style={{ ...selectStyle, marginBottom: "4px" }} value={newSource} onChange={(e) => setNewSource(e.target.value)}>
          <option value="">Source entity...</option>
          {entities.map((e) => (
            <option key={e.uuid} value={e.uuid}>{e.name} ({e.type})</option>
          ))}
        </select>
        <select style={{ ...selectStyle, marginBottom: "4px" }} value={newTarget} onChange={(e) => setNewTarget(e.target.value)}>
          <option value="">Target entity...</option>
          {entities.map((e) => (
            <option key={e.uuid} value={e.uuid}>{e.name} ({e.type})</option>
          ))}
        </select>
        <input
          style={{ ...inputStyle, marginBottom: "4px" }}
          placeholder="Relationship type"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        />
        <button
          style={{
            width: "100%",
            padding: "6px",
            background: newSource && newTarget && newType ? "var(--accent)" : "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            color: newSource && newTarget && newType ? "#fff" : "var(--text-secondary)",
            cursor: newSource && newTarget && newType ? "pointer" : "default",
            fontSize: "12px",
          }}
          onClick={handleConnect}
          disabled={!newSource || !newTarget || !newType}
        >
          Connect
        </button>

        {/* All entities list */}
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />
        <h4 style={{ margin: "0 0 6px", fontSize: "12px" }}>All Entities ({filteredEntities.length})</h4>
        <div style={{ maxHeight: "300px", overflow: "auto" }}>
          {filteredEntities.map((e) => (
            <div
              key={e.uuid}
              style={{
                ...entityListItemStyle,
                background: selectedEntity === e.uuid ? "var(--bg-tertiary)" : "transparent",
              }}
              onClick={() => setSelectedEntity(e.uuid)}
            >
              <span style={badgeStyle(NODE_COLORS[e.type] ?? "#6b7280")} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

panelRegistry.register({
  id: "knowledge-graph",
  title: "Knowledge Graph",
  icon: "\u{1f578}",
  component: KnowledgeGraphPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
