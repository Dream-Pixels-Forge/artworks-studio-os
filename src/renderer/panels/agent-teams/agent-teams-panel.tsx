/**
 * Agent Teams panel.
 *
 * Dashboard for AI production teams: agents, tasks, and messages.
 */
import { useCallback, useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Agent {
  uuid: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  avatar: string;
  status: "idle" | "busy" | "paused" | "offline";
  createdAt: string;
}

interface AgentTask {
  uuid: string;
  agentId: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: string;
  input: string;
  output: string;
  dueDate: string;
  createdAt: string;
}

interface AgentMessage {
  uuid: string;
  agentId: string;
  taskId?: string;
  role: string;
  content: string;
  tokensUsed: number;
  model: string;
  createdAt: string;
}

interface AgentStats {
  agents: { total: number; idle: number; busy: number; paused: number; offline: number };
  tasks: { total: number; pending: number; inProgress: number; completed: number; failed: number };
  messages: { total: number; tokens: number };
}

type Tab = "overview" | "agents" | "tasks" | "messages";

const STATUS_COLORS: Record<string, string> = {
  idle: "#2cb67d",
  busy: "#e2b714",
  paused: "#7f5af0",
  offline: "#666",
  pending: "#e2b714",
  in_progress: "#7f5af0",
  completed: "#2cb67d",
  failed: "#e53170",
};

const AGENT_ROLES = [
  { value: "creative_director", label: "Creative Director" },
  { value: "character_designer", label: "Character Designer" },
  { value: "environment_artist", label: "Environment Artist" },
  { value: "storyboard_artist", label: "Storyboard Artist" },
  { value: "video_director", label: "Video Director" },
  { value: "video_editor", label: "Video Editor" },
  { value: "audio_director", label: "Audio Director" },
  { value: "sound_designer", label: "Sound Designer" },
  { value: "composer", label: "Composer" },
  { value: "writer", label: "Writer" },
  { value: "dialogue_editor", label: "Dialogue Editor" },
  { value: "composer_ai", label: "Composer AI" },
  { value: "narrative_designer", label: "Narrative Designer" },
  { value: "producer", label: "Producer" },
  { value: "researcher", label: "Researcher" },
  { value: "custom", label: "Custom" },
];

export function AgentTeamsPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentRole, setNewAgentRole] = useState("custom");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");
  const [newAgentModel, setNewAgentModel] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskAgent, setNewTaskAgent] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [selectedAgent] = useState<string | null>(null);
  const [selectedTask] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const [agentStats, taskStats, msgStats] = await Promise.all([
      window.artworks.production.agent.stats(),
      window.artworks.production.agentTask.stats(),
      window.artworks.production.agentMessage.list({ limit: 0 }),
    ]);
    setStats({
      agents: agentStats as AgentStats["agents"],
      tasks: taskStats as AgentStats["tasks"],
      messages: (msgStats as AgentMessage[]).length
        ? { total: (msgStats as AgentMessage[]).length, tokens: (msgStats as AgentMessage[]).reduce((s, m) => s + m.tokensUsed, 0) }
        : { total: 0, tokens: 0 },
    });
  }, []);

  const loadAgents = useCallback(async () => {
    const list = await window.artworks.production.agent.list();
    setAgents(list as Agent[]);
  }, []);

  const loadTasks = useCallback(async () => {
    const list = await window.artworks.production.agentTask.list();
    setTasks(list as AgentTask[]);
  }, []);

  const loadMessages = useCallback(async () => {
    const filters: Record<string, unknown> = { limit: 50 };
    if (selectedAgent) filters.agentId = selectedAgent;
    if (selectedTask) filters.taskId = selectedTask;
    const list = await window.artworks.production.agentMessage.list(filters);
    setMessages(list as AgentMessage[]);
  }, [selectedAgent, selectedTask]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadAgents(), loadTasks(), loadMessages()])
      .finally(() => setLoading(false));
  }, [loadStats, loadAgents, loadTasks, loadMessages]);

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    await window.artworks.production.agent.create({
      name: newAgentName.trim(),
      role: newAgentRole,
      systemPrompt: newAgentPrompt.trim() || undefined,
      model: newAgentModel.trim() || undefined,
    });
    setNewAgentName("");
    setNewAgentRole("custom");
    setNewAgentPrompt("");
    setNewAgentModel("");
    setShowCreateAgent(false);
    await Promise.all([loadAgents(), loadStats()]);
  };

  const handleDeleteAgent = async (uuid: string) => {
    await window.artworks.production.agent.delete(uuid);
    await Promise.all([loadAgents(), loadStats()]);
  };

  const handleAgentStatus = async (uuid: string, status: Agent["status"]) => {
    await window.artworks.production.agent.updateStatus(uuid, status);
    await Promise.all([loadAgents(), loadStats()]);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskAgent) return;
    await window.artworks.production.agentTask.create({
      agentId: newTaskAgent,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || undefined,
      priority: newTaskPriority,
    });
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskAgent("");
    setNewTaskPriority("medium");
    setShowCreateTask(false);
    await Promise.all([loadTasks(), loadStats()]);
  };

  const handleTaskAction = async (uuid: string, action: "start" | "complete" | "fail" | "cancel") => {
    if (action === "start") await window.artworks.production.agentTask.start(uuid);
    else if (action === "complete") await window.artworks.production.agentTask.complete(uuid, {});
    else if (action === "fail") await window.artworks.production.agentTask.fail(uuid, "Failed");
    else if (action === "cancel") await window.artworks.production.agentTask.cancel(uuid);
    await Promise.all([loadTasks(), loadStats()]);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "agents", label: "Agents" },
    { key: "tasks", label: "Tasks" },
    { key: "messages", label: "Messages" },
  ];

  return (
    <div className="studio">
      <h2 className="studio__title">AI Production Teams</h2>

      <div className="studio__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`studio__tab ${tab === t.key ? "studio__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="studio__loading">Loading…</div>}

      {!loading && tab === "overview" && stats && (
        <div className="studio__overview">
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.agents.total}</span>
            <span className="studio__stat-label">Total Agents</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.agents.idle}</span>
            <span className="studio__stat-label">Idle Agents</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.agents.busy}</span>
            <span className="studio__stat-label">Busy Agents</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.tasks.pending}</span>
            <span className="studio__stat-label">Pending Tasks</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.tasks.inProgress}</span>
            <span className="studio__stat-label">In Progress</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.messages.total}</span>
            <span className="studio__stat-label">Messages</span>
          </div>
          <div className="studio__stat-card">
            <span className="studio__stat-value">{stats.messages.tokens.toLocaleString()}</span>
            <span className="studio__stat-label">Tokens Used</span>
          </div>
        </div>
      )}

      {!loading && tab === "agents" && (
        <div className="studio__section">
          <div className="studio__section-header">
            <h3 className="studio__section-title">Agents ({agents.length})</h3>
            <button
              className="studio__btn studio__btn--primary"
              onClick={() => setShowCreateAgent(true)}
            >
              + Add
            </button>
          </div>

          {showCreateAgent && (
            <div className="studio__form">
              <input
                className="studio__input"
                placeholder="Agent name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
              />
              <select
                className="studio__input"
                value={newAgentRole}
                onChange={(e) => setNewAgentRole(e.target.value)}
              >
                {AGENT_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <input
                className="studio__input"
                placeholder="System prompt (optional)"
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
              />
              <input
                className="studio__input"
                placeholder="Model (optional)"
                value={newAgentModel}
                onChange={(e) => setNewAgentModel(e.target.value)}
              />
              <div className="studio__form-actions">
                <button className="studio__btn" onClick={() => setShowCreateAgent(false)}>
                  Cancel
                </button>
                <button className="studio__btn studio__btn--primary" onClick={handleCreateAgent}>
                  Create
                </button>
              </div>
            </div>
          )}

          {agents.length === 0 ? (
            <div className="studio__empty">No agents yet.</div>
          ) : (
            <div className="studio__list">
              {agents.map((agent) => (
                <div key={agent.uuid} className="studio__item">
                  <div className="studio__item-info">
                    <span className="studio__item-name">{agent.name}</span>
                    <span className="studio__item-desc">
                      {AGENT_ROLES.find((r) => r.value === agent.role)?.label ?? agent.role}
                      {agent.model && ` · ${agent.model}`}
                    </span>
                  </div>
                  <span
                    className="studio__badge"
                    style={{ backgroundColor: STATUS_COLORS[agent.status] ?? "#666" }}
                  >
                    {agent.status}
                  </span>
                  <div className="studio__item-actions">
                    {agent.status !== "busy" && (
                      <button
                        className="studio__btn"
                        onClick={() => handleAgentStatus(agent.uuid, "busy")}
                        title="Set busy"
                      >
                        ▶
                      </button>
                    )}
                    {agent.status !== "idle" && (
                      <button
                        className="studio__btn"
                        onClick={() => handleAgentStatus(agent.uuid, "idle")}
                        title="Set idle"
                      >
                        ⏸
                      </button>
                    )}
                    <button
                      className="studio__btn studio__btn--danger"
                      onClick={() => handleDeleteAgent(agent.uuid)}
                      title="Delete agent"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === "tasks" && (
        <div className="studio__section">
          <div className="studio__section-header">
            <h3 className="studio__section-title">Tasks ({tasks.length})</h3>
            <button
              className="studio__btn studio__btn--primary"
              onClick={() => setShowCreateTask(true)}
            >
              + Add
            </button>
          </div>

          {showCreateTask && (
            <div className="studio__form">
              <input
                className="studio__input"
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <input
                className="studio__input"
                placeholder="Description (optional)"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
              />
              <select
                className="studio__input"
                value={newTaskAgent}
                onChange={(e) => setNewTaskAgent(e.target.value)}
              >
                <option value="">Select agent…</option>
                {agents.map((a) => (
                  <option key={a.uuid} value={a.uuid}>{a.name} ({a.role})</option>
                ))}
              </select>
              <select
                className="studio__input"
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <div className="studio__form-actions">
                <button className="studio__btn" onClick={() => setShowCreateTask(false)}>
                  Cancel
                </button>
                <button className="studio__btn studio__btn--primary" onClick={handleCreateTask}>
                  Create
                </button>
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="studio__empty">No tasks yet.</div>
          ) : (
            <div className="studio__list">
              {tasks.map((task) => (
                <div key={task.uuid} className="studio__item">
                  <div className="studio__item-info">
                    <span className="studio__item-name">{task.title}</span>
                    <span className="studio__item-desc">
                      {agents.find((a) => a.uuid === task.agentId)?.name ?? task.agentId}
                      {task.priority !== "medium" && ` · ${task.priority}`}
                    </span>
                  </div>
                  <span
                    className="studio__badge"
                    style={{ backgroundColor: STATUS_COLORS[task.status] ?? "#666" }}
                  >
                    {task.status}
                  </span>
                  <div className="studio__item-actions">
                    {task.status === "pending" && (
                      <button
                        className="studio__btn"
                        onClick={() => handleTaskAction(task.uuid, "start")}
                      >
                        Start
                      </button>
                    )}
                    {task.status === "in_progress" && (
                      <>
                        <button
                          className="studio__btn studio__btn--success"
                          onClick={() => handleTaskAction(task.uuid, "complete")}
                        >
                          Complete
                        </button>
                        <button
                          className="studio__btn studio__btn--danger"
                          onClick={() => handleTaskAction(task.uuid, "fail")}
                        >
                          Fail
                        </button>
                      </>
                    )}
                    {(task.status === "pending" || task.status === "in_progress") && (
                      <button
                        className="studio__btn"
                        onClick={() => handleTaskAction(task.uuid, "cancel")}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === "messages" && (
        <div className="studio__section">
          <h3 className="studio__section-title">Messages ({messages.length})</h3>
          {messages.length === 0 ? (
            <div className="studio__empty">No messages yet.</div>
          ) : (
            <div className="studio__list">
              {messages.map((msg) => (
                <div key={msg.uuid} className="studio__item">
                  <div className="studio__item-info">
                    <span className="studio__item-name">
                      {agents.find((a) => a.uuid === msg.agentId)?.name ?? msg.agentId}
                    </span>
                    <span className="studio__item-desc">
                      {msg.role} · {msg.tokensUsed} tokens
                      {msg.model && ` · ${msg.model}`}
                    </span>
                  </div>
                  <span className="studio__item-desc" style={{ flex: 1, marginLeft: "0.5rem" }}>
                    {msg.content.length > 100 ? `${msg.content.slice(0, 100)}…` : msg.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

panelRegistry.register({
  id: "agent-teams",
  title: "AI Teams",
  icon: "\u{1f916}", // 🤖
  component: AgentTeamsPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
