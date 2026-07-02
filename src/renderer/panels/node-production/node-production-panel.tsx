/**
 * Node Production panel.
 *
 * Visual production workflows using a React Flow canvas-based node editor.
 * Supports creating, editing, and managing production pipelines.
 */
import { useCallback, useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface NodeWorkflowMeta {
  uuid: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
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

const STATUS_COLORS: Record<string, string> = {
  draft: "#e2b714",
  active: "#2cb67d",
  archived: "#666",
};

export function NodeProductionPanel() {
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<NodeWorkflowMeta[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<NodeWorkflow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [editingNodes, setEditingNodes] = useState<string>("[]");
  const [editingEdges, setEditingEdges] = useState<string>("[]");

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

  const handleCreate = useCallback(async () => {
    if (!newWorkflowName.trim()) return;
    try {
      const wf = await window.artworks.production.nodeWorkflow.create({
        name: newWorkflowName.trim(),
        description: newWorkflowDesc.trim(),
      }) as NodeWorkflow;
      setWorkflows((prev) => [
        { uuid: wf.uuid, name: wf.name, description: wf.description, status: wf.status, nodeCount: 0, createdAt: wf.createdAt, updatedAt: wf.updatedAt },
        ...prev,
      ]);
      setStats((s) => s ? { ...s, total: s.total + 1, draft: s.draft + 1 } : s);
      setShowCreateModal(false);
      setNewWorkflowName("");
      setNewWorkflowDesc("");
    } catch (err) {
      console.error("Failed to create workflow:", err);
    }
  }, [newWorkflowName, newWorkflowDesc]);

  const handleSelect = useCallback(async (uuid: string) => {
    try {
      const wf = await window.artworks.production.nodeWorkflow.get(uuid) as NodeWorkflow;
      setSelectedWorkflow(wf);
      setEditingNodes(wf.nodes);
      setEditingEdges(wf.edges);
    } catch (err) {
      console.error("Failed to load workflow:", err);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedWorkflow) return;
    try {
      await window.artworks.production.nodeWorkflow.updateGraph(
        selectedWorkflow.uuid,
        editingNodes,
        editingEdges,
      );
    } catch (err) {
      console.error("Failed to save workflow:", err);
    }
  }, [selectedWorkflow, editingNodes, editingEdges]);

  const handleStatusChange = useCallback(async (uuid: string, status: string) => {
    try {
      await window.artworks.production.nodeWorkflow.update(uuid, { status });
      setWorkflows((prev) =>
        prev.map((w) => (w.uuid === uuid ? { ...w, status: status as NodeWorkflowMeta["status"] } : w)),
      );
      setStats((s) => {
        if (!s) return s;
        const counts = { ...s };
        const old = workflows.find((w) => w.uuid === uuid);
        if (old) counts[old.status as keyof typeof counts] = Math.max(0, counts[old.status as keyof typeof counts] - 1);
        counts[status as keyof typeof counts] = (counts[status as keyof typeof counts] ?? 0) + 1;
        return counts;
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }, [workflows]);

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
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "4px 12px",
              background: "var(--accent)",
              color: "var(--text-primary)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            + New Workflow
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)" }}>
          <span>Total: {stats.total}</span>
          <span style={{ color: STATUS_COLORS.draft }}>Draft: {stats.draft}</span>
          <span style={{ color: STATUS_COLORS.active }}>Active: {stats.active}</span>
          <span style={{ color: STATUS_COLORS.archived }}>Archived: {stats.archived}</span>
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Workflow List */}
        <div style={{ width: 280, borderRight: "1px solid var(--border)", overflow: "auto", padding: 8 }}>
          {workflows.length === 0 ? (
            <div style={{ padding: 16, color: "var(--text-secondary)", textAlign: "center" }}>
              No workflows yet. Create one to get started.
            </div>
          ) : (
            workflows.map((wf) => (
              <div
                key={wf.uuid}
                onClick={() => handleSelect(wf.uuid)}
                style={{
                  padding: "8px 12px",
                  marginBottom: 4,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: selectedWorkflow?.uuid === wf.uuid ? "var(--surface-hover)" : "transparent",
                  borderLeft: `3px solid ${STATUS_COLORS[wf.status] ?? "transparent"}`,
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13 }}>{wf.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {wf.nodeCount} nodes · {wf.status}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Editor / Empty State */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selectedWorkflow ? (
            <>
              {/* Toolbar */}
              <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{selectedWorkflow.name}</span>
                <select
                  value={selectedWorkflow.status}
                  onChange={(e) => handleStatusChange(selectedWorkflow.uuid, e.target.value)}
                  style={{ padding: "2px 8px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)" }}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
                <button
                  onClick={handleSave}
                  style={{
                    padding: "4px 12px",
                    background: "var(--accent)",
                    color: "var(--text-primary)",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => handleDelete(selectedWorkflow.uuid)}
                  style={{
                    padding: "4px 12px",
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
              </div>

              {/* Canvas Placeholder */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>React Flow Canvas</div>
                  <div style={{ fontSize: 13 }}>
                    Drag and drop nodes to build your production pipeline
                  </div>
                  <div style={{ fontSize: 12, marginTop: 8, color: "var(--text-tertiary, #888)" }}>
                    Nodes: {JSON.parse(editingNodes).length} · Edges: {JSON.parse(editingEdges).length}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Node-Based Production</div>
                <div style={{ fontSize: 13 }}>
                  Create visual production workflows with drag-and-drop nodes
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
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 14,
                  boxSizing: "border-box",
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
