import { useState, useEffect, useCallback } from "react";
import { panelRegistry } from "@renderer/workspace/registry.js";

interface TimelineItem {
  uuid: string;
  name: string;
  status: string;
  timelineType: "task" | "milestone";
  priority: "low" | "medium" | "high" | "critical";
  progress: number;
  startDate?: string;
  endDate?: string;
  dependencies: string[];
}

interface TimelineStats {
  total: number;
  tasks: number;
  milestones: number;
  completed: number;
  inProgress: number;
  avgProgress: number;
  byPriority: Record<string, number>;
}

export function TimelinePanel() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"task" | "milestone">("task");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter = filterType ? { timelineType: filterType } : undefined;
      const [list, s] = await Promise.all([
        window.artworks.production.timeline.list(filter),
        window.artworks.production.timeline.stats(),
      ]);
      setItems(list as TimelineItem[]);
      setStats(s as TimelineStats);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newName.trim()) return;
    await window.artworks.production.timeline.create({ name: newName.trim(), timelineType: newType, priority: newPriority });
    setNewName("");
    setNewType("task");
    setNewPriority("medium");
    await load();
  };

  const update = async (uuid: string, updates: Record<string, unknown>) => {
    await window.artworks.production.timeline.update(uuid, updates);
    await load();
  };

  const remove = async (uuid: string) => {
    await window.artworks.production.timeline.delete(uuid);
    await load();
  };

  const priorityColor = (p: string) => {
    if (p === "critical") return "bg-red-500/20 text-red-400";
    if (p === "high") return "bg-orange-500/20 text-orange-400";
    if (p === "medium") return "bg-yellow-500/20 text-yellow-400";
    return "bg-green-500/20 text-green-400";
  };

  const statusIcon = (s: string) => {
    if (s === "final") return "\u2713";
    if (s === "active") return "\u25cf";
    return "\u25cb";
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Timeline</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {loading ? "..." : `${items.length} items`}
        </span>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-3 px-3 py-1.5 text-[10px] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          <span>Tasks: {stats.tasks}</span>
          <span>Milestones: {stats.milestones}</span>
          <span>Done: {stats.completed}</span>
          <span>Avg: {stats.avgProgress}%</span>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 px-3 py-1.5 border-b border-[var(--color-border)]">
        <select
          className="flex-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)]"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="task">Tasks</option>
          <option value="milestone">Milestones</option>
        </select>
      </div>

      {/* Add item */}
      <div className="flex gap-1.5 px-3 py-1.5 border-b border-[var(--color-border)]">
        <input
          className="flex-1 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-primary)]"
          placeholder="New timeline item..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <select
          className="w-16 text-[10px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-secondary)]"
          value={newType}
          onChange={(e) => setNewType(e.target.value as "task" | "milestone")}
        >
          <option value="task">Task</option>
          <option value="milestone">Milestone</option>
        </select>
        <select
          className="w-14 text-[10px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-secondary)]"
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high" | "critical")}
        >
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
          <option value="critical">Crit</option>
        </select>
        <button
          className="px-2 py-0.5 text-[10px] rounded bg-[var(--color-accent)] text-white hover:opacity-90"
          onClick={add}
        >
          +
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.uuid}
            className={`flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] group ${
              editingUuid === item.uuid ? "bg-[var(--color-bg-secondary)]" : ""
            }`}
          >
            <span className="text-[10px] w-3 text-center text-[var(--color-text-muted)]">{statusIcon(item.status)}</span>

            <div className="flex-1 min-w-0">
              {editingUuid === item.uuid ? (
                <input
                  className="w-full text-xs bg-[var(--color-bg-primary)] border border-[var(--color-accent)] rounded px-1 py-0.5 text-[var(--color-text-primary)]"
                  defaultValue={item.name}
                  onBlur={(e) => {
                    update(item.uuid, { name: e.target.value });
                    setEditingUuid(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingUuid(null);
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="text-xs text-[var(--color-text-primary)] cursor-pointer block truncate"
                  onClick={() => setEditingUuid(item.uuid)}
                  title="Click to edit"
                >
                  {item.name}
                </span>
              )}
              <div className="flex gap-2 mt-0.5">
                <span className={`text-[9px] px-1 rounded ${priorityColor(item.priority)}`}>{item.priority}</span>
                <span className="text-[9px] text-[var(--color-text-muted)]">{item.timelineType}</span>
                {item.startDate && <span className="text-[9px] text-[var(--color-text-muted)]">\u2192 {item.endDate ?? "..."}</span>}
                {item.dependencies.length > 0 && (
                  <span className="text-[9px] text-[var(--color-text-muted)]">depends: {item.dependencies.length}</span>
                )}
              </div>
              {/* Progress bar */}
              <div className="w-full h-1 bg-[var(--color-bg-tertiary)] rounded mt-1">
                <div
                  className="h-1 rounded bg-[var(--color-accent)] transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>

            {/* Progress input */}
            <input
              type="number"
              min={0}
              max={100}
              className="w-10 text-[10px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-secondary)] text-center"
              value={item.progress}
              onChange={(e) => update(item.uuid, { progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
            />

            {/* Status quick-toggle */}
            <button
              className="w-5 h-5 text-[10px] rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                const next = item.status === "active" ? "final" : "active";
                update(item.uuid, { status: next });
              }}
              title={item.status === "active" ? "Mark final" : "Mark active"}
            >
              {"\u2713"}
            </button>

            {/* Delete */}
            <button
              className="w-5 h-5 text-[10px] rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => remove(item.uuid)}
              title="Delete"
            >
              {"\u00d7"}
            </button>
          </div>
        ))}

        {items.length === 0 && !loading && (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--color-text-muted)]">
            No timeline items yet
          </div>
        )}
      </div>
    </div>
  );
}

panelRegistry.register({ id: "timeline", title: "Timeline", icon: "\u{1f4c5}", component: TimelinePanel, defaultSlot: "bottom", defaultVisible: false });
