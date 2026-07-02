/**
 * Node Production panel.
 *
 * Visual production workflows using a React Flow canvas-based node editor.
 * Supports creating, editing, and managing production pipelines.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEventHandler } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { panelRegistry } from "../../workspace/registry.js";

// ─── Types ──────────────────────────────────────────────────────────────────

type WorkflowStatus = "draft" | "active" | "archived";

interface NodeWorkflowMeta {
  uuid: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface NodeWorkflow extends NodeWorkflowMeta {
  nodes: string;
  edges: string;
  viewport: string;
}

interface WorkflowStats {
  total: number;
  draft: number;
  active: number;
  archived: number;
}

// ─── Node Data Types ────────────────────────────────────────────────────────

type NodeCategory = "production" | "ai" | "prompt" | "review" | "publishing";

interface ProductionNodeData extends Record<string, unknown> {
  label: string;
  category: NodeCategory;
  description?: string;
  status?: string;
}

// ─── Node Type Colors ───────────────────────────────────────────────────────

const NODE_COLORS: Record<NodeCategory, { bg: string; border: string; header: string }> = {
  production: { bg: "#1a1f2e", border: "#7f5af0", header: "#7f5af0" },
  ai: { bg: "#1a2e1a", border: "#2cb67d", header: "#2cb67d" },
  prompt: { bg: "#2e2e1a", border: "#e2b714", header: "#e2b714" },
  review: { bg: "#2e1a1a", border: "#e53170", header: "#e53170" },
  publishing: { bg: "#1a1a2e", border: "#00b4d8", header: "#00b4d8" },
};

// ─── Custom Node Component ──────────────────────────────────────────────────

function ProductionNode({ data, selected }: NodeProps<Node<ProductionNodeData>>) {
  const nodeData = data as ProductionNodeData;
  const colors = NODE_COLORS[nodeData.category] ?? NODE_COLORS.production;

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${selected ? "#fff" : colors.border}`,
        borderRadius: 8,
        minWidth: 180,
        boxShadow: selected ? `0 0 12px ${colors.border}40` : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: colors.header,
          padding: "6px 12px",
          borderRadius: "6px 6px 0 0",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#000",
        }}
      >
        {nodeData.category}
      </div>

      {/* Content */}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{nodeData.label}</div>
        {nodeData.description && (
          <div style={{ fontSize: 11, color: "#888", lineHeight: 1.3 }}>{nodeData.description}</div>
        )}
        {nodeData.status && (
          <div style={{ fontSize: 10, color: colors.border, marginTop: 6 }}>{nodeData.status}</div>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: colors.border,
          border: "2px solid #000",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          background: colors.border,
          border: "2px solid #000",
        }}
      />
    </div>
  );
}

// ─── Node Palette Items ─────────────────────────────────────────────────────

interface PaletteItem {
  category: NodeCategory;
  label: string;
  description: string;
}

const NODE_PALETTE: PaletteItem[] = [
  // Production
  { category: "production", label: "Script", description: "Script or screenplay input" },
  { category: "production", label: "Storyboard", description: "Visual storyboard planning" },
  { category: "production", label: "Asset Pipeline", description: "Asset creation and management" },
  { category: "production", label: "Assembly", description: "Final assembly and output" },
  // AI
  { category: "ai", label: "Image Gen", description: "AI image generation (DALL-E, Midjourney)" },
  { category: "ai", label: "Video Gen", description: "AI video generation (Sora, Runway)" },
  { category: "ai", label: "Audio Gen", description: "AI audio/music generation" },
  { category: "ai", label: "Voice Synth", description: "AI voice synthesis and dialogue" },
  // Prompt
  { category: "prompt", label: "Prompt Template", description: "Reusable prompt template" },
  { category: "prompt", label: "Prompt Chain", description: "Multi-step prompt chain" },
  { category: "prompt", label: "Context", description: "Context or reference input" },
  // Review
  { category: "review", label: "Review Gate", description: "Human review checkpoint" },
  { category: "review", label: "Quality Check", description: "Automated quality validation" },
  { category: "review", label: "Feedback", description: "Feedback collection point" },
  // Publishing
  { category: "publishing", label: "Export", description: "Export to file or format" },
  { category: "publishing", label: "Publish", description: "Publish to platform or service" },
  { category: "publishing", label: "Archive", description: "Archive completed work" },
];

// ─── Helper: Generate unique ID ─────────────────────────────────────────────

let nodeIdCounter = 0;
function generateNodeId(): string {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export function NodeProductionPanel() {
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<NodeWorkflowMeta[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<NodeWorkflow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReturnType<typeof import("@xyflow/react").useReactFlow> | null>(null);

  // Parse nodes and edges from workflow
  const initialNodes: Node<ProductionNodeData>[] = useMemo(() => {
    if (!selectedWorkflow) return [];
    try {
      return JSON.parse(selectedWorkflow.nodes);
    } catch {
      return [];
    }
  }, [selectedWorkflow]);

  const initialEdges: Edge[] = useMemo(() => {
    if (!selectedWorkflow) return [];
    try {
      return JSON.parse(selectedWorkflow.edges);
    } catch {
      return [];
    }
  }, [selectedWorkflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when workflow changes
  useEffect(() => {
    if (selectedWorkflow) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [selectedWorkflow, initialNodes, initialEdges, setNodes, setEdges]);

  // ─── Load workflows ───────────────────────────────────────────────────────

  const loadWorkflows = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        window.artworks.production.nodeWorkflow.list() as Promise<NodeWorkflowMeta[]>,
        window.artworks.production.nodeWorkflow.stats() as Promise<WorkflowStats>,
      ]);
      setWorkflows(list);
      setStats(s);
    } catch (err) {
      console.error("Failed to load node workflows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  // ─── Create workflow ──────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!newWorkflowName.trim()) return;
    try {
      const defaultNodes: Node<ProductionNodeData>[] = [
        {
          id: "start",
          type: "production",
          data: { label: "Start", category: "production", description: "Workflow entry point" },
          position: { x: 50, y: 200 },
        },
      ];
      const wf = await window.artworks.production.nodeWorkflow.create({
        name: newWorkflowName.trim(),
        description: newWorkflowDesc.trim(),
        nodes: JSON.stringify(defaultNodes),
        edges: JSON.stringify([]),
      }) as NodeWorkflow;
      setWorkflows((prev) => [
        { uuid: wf.uuid, name: wf.name, description: wf.description, status: wf.status, nodeCount: 1, createdAt: wf.createdAt, updatedAt: wf.updatedAt },
        ...prev,
      ]);
      setStats((s) => s ? { ...s, total: s.total + 1, draft: s.draft + 1 } : s);
      setShowCreateModal(false);
      setNewWorkflowName("");
      setNewWorkflowDesc("");
      // Auto-select the new workflow
      setSelectedWorkflow({ ...wf, nodes: JSON.stringify(defaultNodes), edges: JSON.stringify([]), viewport: JSON.stringify({ x: 0, y: 0, zoom: 1 }) });
    } catch (err) {
      console.error("Failed to create workflow:", err);
    }
  }, [newWorkflowName, newWorkflowDesc]);

  // ─── Select workflow ──────────────────────────────────────────────────────

  const handleSelect = useCallback(async (uuid: string) => {
    try {
      const wf = await window.artworks.production.nodeWorkflow.get(uuid) as NodeWorkflow;
      setSelectedWorkflow(wf);
    } catch (err) {
      console.error("Failed to load workflow:", err);
    }
  }, []);

  // ─── Save workflow ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!selectedWorkflow) return;
    setIsSaving(true);
    try {
      const viewport = reactFlowInstance?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
      await window.artworks.production.nodeWorkflow.updateGraph(
        selectedWorkflow.uuid,
        JSON.stringify(nodes),
        JSON.stringify(edges),
        JSON.stringify(viewport),
      );
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save workflow:", err);
    } finally {
      setIsSaving(false);
    }
  }, [selectedWorkflow, nodes, edges, reactFlowInstance]);

  // ─── Auto-save (debounced) ────────────────────────────────────────────────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void handleSave();
    }, 2000);
  }, [handleSave]);

  useEffect(() => {
    if (selectedWorkflow && (nodes.length > 0 || edges.length > 0)) {
      scheduleAutoSave();
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [nodes, edges, selectedWorkflow, scheduleAutoSave]);

  // ─── Status change ────────────────────────────────────────────────────────

  const handleStatusChange = useCallback(async (uuid: string, status: string) => {
    try {
      await window.artworks.production.nodeWorkflow.update(uuid, { status });
      setWorkflows((prev) =>
        prev.map((w) => (w.uuid === uuid ? { ...w, status: status as WorkflowStatus } : w)),
      );
      setStats((s) => {
        if (!s) return s;
        const counts = { ...s };
        const old = workflows.find((w) => w.uuid === uuid);
        if (old) counts[old.status as keyof typeof counts] = Math.max(0, counts[old.status as keyof typeof counts] - 1);
        counts[status as keyof typeof counts] = (counts[status as keyof typeof counts] ?? 0) + 1;
        return counts;
      });
      if (selectedWorkflow?.uuid === uuid) {
        setSelectedWorkflow((prev) => prev ? { ...prev, status: status as WorkflowStatus } : prev);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }, [workflows, selectedWorkflow]);

  // ─── Delete workflow ──────────────────────────────────────────────────────

  const handleDelete = useCallback(async (uuid: string) => {
    if (!window.confirm("Delete this workflow?")) return;
    try {
      await window.artworks.production.nodeWorkflow.delete(uuid);
      setWorkflows((prev) => prev.filter((w) => w.uuid !== uuid));
      setStats((s) => s ? { ...s, total: s.total - 1 } : s);
      if (selectedWorkflow?.uuid === uuid) setSelectedWorkflow(null);
    } catch (err) {
      console.error("Failed to delete workflow:", err);
    }
  }, [selectedWorkflow]);

  // ─── React Flow handlers ──────────────────────────────────────────────────

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges],
  );

  const onInit: Parameters<typeof ReactFlow>[0]["onInit"] = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  // ─── Drag and drop from palette ───────────────────────────────────────────

  const onDragOver: DragEventHandler<HTMLDivElement> = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop: DragEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();

      const dataStr = event.dataTransfer.getData("application/reactflow");
      if (!dataStr || !reactFlowInstance) return;

      const item: PaletteItem = JSON.parse(dataStr);
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<ProductionNodeData> = {
        id: generateNodeId(),
        type: "production",
        data: {
          label: item.label,
          category: item.category,
          description: item.description,
        },
        position,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes],
  );

  // ─── Node types ───────────────────────────────────────────────────────────

  const nodeTypes = useMemo(() => ({ production: ProductionNode }), []);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)" }}>
        Loading node workflows...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>Node Production</span>
        {selectedWorkflow && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>
            {selectedWorkflow.name}
            {lastSaved && ` · Saved ${lastSaved.toLocaleTimeString()}`}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {selectedWorkflow && (
            <>
              <select
                value={selectedWorkflow.status}
                onChange={(e) => handleStatusChange(selectedWorkflow.uuid, e.target.value)}
                style={{ padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)" }}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: "6px 14px",
                  background: "var(--accent)",
                  color: "var(--text-primary)",
                  border: "none",
                  borderRadius: 4,
                  cursor: isSaving ? "wait" : "pointer",
                  fontSize: 12,
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => handleDelete(selectedWorkflow.uuid)}
                style={{
                  padding: "6px 14px",
                  background: "var(--danger, #e53170)",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Delete
              </button>
            </>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "6px 14px",
              background: "var(--accent)",
              color: "var(--text-primary)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ padding: "6px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, fontSize: 11, color: "var(--text-secondary)" }}>
          <span>Total: {stats.total}</span>
          <span style={{ color: NODE_COLORS.production.border }}>Draft: {stats.draft}</span>
          <span style={{ color: NODE_COLORS.ai.border }}>Active: {stats.active}</span>
          <span style={{ color: "#666" }}>Archived: {stats.archived}</span>
        </div>
      )}

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Workflow list sidebar */}
        <div style={{ width: 220, borderRight: "1px solid var(--border)", overflow: "auto", padding: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-secondary)", padding: "4px 8px", marginBottom: 4 }}>
            Workflows
          </div>
          {workflows.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-secondary)", textAlign: "center", fontSize: 12 }}>
              No workflows yet.
            </div>
          ) : (
            workflows.map((wf) => (
              <div
                key={wf.uuid}
                onClick={() => handleSelect(wf.uuid)}
                style={{
                  padding: "8px 10px",
                  marginBottom: 2,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: selectedWorkflow?.uuid === wf.uuid ? "var(--surface-hover)" : "transparent",
                  borderLeft: `3px solid ${NODE_COLORS[wf.status === "draft" ? "production" : wf.status === "active" ? "ai" : "publishing"]?.border ?? "#666"}`,
                  transition: "background 0.1s",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 12 }}>{wf.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                  {wf.status} · {wf.nodeCount} nodes
                </div>
              </div>
            ))
          )}
        </div>

        {/* Node palette (when workflow selected) */}
        {selectedWorkflow && (
          <div style={{ width: 200, borderRight: "1px solid var(--border)", overflow: "auto", padding: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-secondary)", padding: "4px 8px", marginBottom: 8 }}>
              Node Palette
            </div>
            {(["production", "ai", "prompt", "review", "publishing"] as NodeCategory[]).map((cat) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: NODE_COLORS[cat].header,
                    padding: "2px 8px",
                    marginBottom: 4,
                  }}
                >
                  {cat}
                </div>
                {NODE_PALETTE.filter((item) => item.category === cat).map((item) => (
                  <div
                    key={item.label}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", JSON.stringify(item));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    style={{
                      padding: "6px 8px",
                      marginBottom: 2,
                      borderRadius: 4,
                      cursor: "grab",
                      fontSize: 11,
                      background: "var(--surface)",
                      border: `1px solid ${NODE_COLORS[cat].border}30`,
                      transition: "border-color 0.1s, background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.borderColor = NODE_COLORS[cat].border;
                      (e.target as HTMLElement).style.background = "var(--surface-hover)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = `${NODE_COLORS[cat].border}30`;
                      (e.target as HTMLElement).style.background = "var(--surface)";
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Canvas / Empty state */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }} ref={reactFlowWrapper}>
          {selectedWorkflow ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange as OnNodesChange}
              onEdgesChange={onEdgesChange as OnEdgesChange}
              onConnect={onConnect}
              onInit={onInit}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[16, 16]}
              style={{ background: "#0d1117" }}
              defaultEdgeOptions={{ animated: true, style: { stroke: "#444", strokeWidth: 2 } }}
            >
              <Background color="#1e2530" gap={16} size={1} />
              <Controls
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                }}
              />
              <MiniMap
                nodeColor={(node) => {
                  const data = node.data as ProductionNodeData;
                  return NODE_COLORS[data?.category ?? "production"]?.border ?? "#666";
                }}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                }}
                maskColor="rgba(0,0,0,0.5)"
              />
            </ReactFlow>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Node-Based Production</div>
                <div style={{ fontSize: 13 }}>
                  Select a workflow or create a new one to get started
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 8,
              padding: 24,
              width: 400,
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>Create Workflow</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" }}>
                Name
              </label>
              <input
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="My Production Pipeline"
                autoFocus
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "var(--surface-hover)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "var(--text-secondary)" }}>
                Description
              </label>
              <textarea
                value={newWorkflowDesc}
                onChange={(e) => setNewWorkflowDesc(e.target.value)}
                placeholder="Describe your production workflow..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 14,
                  resize: "vertical",
                  boxSizing: "border-box",
                  background: "var(--surface-hover)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "6px 16px",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newWorkflowName.trim()}
                style={{
                  padding: "6px 16px",
                  background: newWorkflowName.trim() ? "var(--accent)" : "var(--surface-hover)",
                  color: "var(--text-primary)",
                  border: "none",
                  borderRadius: 4,
                  cursor: newWorkflowName.trim() ? "pointer" : "not-allowed",
                  fontSize: 13,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

panelRegistry.register({
  id: "node-production",
  title: "Node Production",
  icon: "\u{1f310}", // 🌐
  component: NodeProductionPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
