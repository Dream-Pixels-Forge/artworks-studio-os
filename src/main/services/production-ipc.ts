/**
 * Production IPC handlers.
 *
 * Wires the live SQLite repositories to the renderer via typed IPC
 * channels. All channel names are prefixed with `production:` to keep
 * them grouped and avoid collisions with other modules.
 */
import { ipcMain } from "electron";
import { createLogger } from "@main/core/logger.js";
import type { StudioDatabase } from "@main/database/db.js";
import {
  ProjectRepository,
  AssetRepository,
  DocumentRepository,
  EntityRepository,
  GraphRepository,
  VersionHistoryRepository,
  ConversationRepository,
  PromptRepository,
  WorkflowRepository,
  TimelineRepository,
  UserRepository,
  ActivityRepository,
  CommentRepository,
  DepartmentRepository,
  ApprovalRepository,
  ReviewRepository,
  AgentRepository,
  AgentTaskRepository,
  AgentMessageRepository,
  NodeWorkflowRepository,
  type CreateProjectInput,
  type CreateAssetInput,
  type CreateDocumentInput,
  type Relationship,
  type VersionSnapshot,
  type Conversation,
  type ConversationMessage,
  type PromptEntity,
  type Workflow,
  type WorkflowDefinition,
  type WorkflowState,
  type CreateTimelineInput,
  type TimelineType,
  type CreateUserInput,
  type LogActivityInput,
  type ActivityFilter,
  type CreateCommentInput,
  type CreateDepartmentInput,
  type ApprovalStatus,
  type CreateApprovalInput,
  type CreateReviewInput,
  type ReviewStatus,
  type CreateAgentInput,
  type CreateTaskInput,
  type CreateMessageInput,
  type CreateNodeWorkflowInput,
} from "@main/database/repositories/index.js";
import type {
  ProjectDto,
  AssetDto,
  DocumentDto,
  SearchResultDto,
  CreateProjectDto,
  CreateAssetDto,
  CreateDocumentDto,
  DashboardStatsDto,
} from "@shared/production/production-dto.js";
import type { EntityStatus } from "@shared/models/index.js";

const log = createLogger("ipc");
const VALID_WORKFLOW_STATES: WorkflowState[] = ["idle", "running", "paused", "completed", "failed"];

let projectRepo: ProjectRepository;
let assetRepo: AssetRepository;
let docRepo: DocumentRepository;
let entityRepo: EntityRepository;
let graphRepo: GraphRepository;
let versionRepo: VersionHistoryRepository;
let convRepo: ConversationRepository;
let promptRepo: PromptRepository;
let wfRepo: WorkflowRepository;
let tlRepo: TimelineRepository;
let userRepo: UserRepository;
let activityRepo: ActivityRepository;
let commentRepo: CommentRepository;
let departmentRepo: DepartmentRepository;
let approvalRepo: ApprovalRepository;
let reviewRepo: ReviewRepository;
let agentRepo: AgentRepository;
let agentTaskRepo: AgentTaskRepository;
let agentMsgRepo: AgentMessageRepository;
let nodeWorkflowRepo: NodeWorkflowRepository;

/** Register all production IPC handlers. Call once on app startup. */
export function registerProductionIpc(db: StudioDatabase): void {
  projectRepo = new ProjectRepository(db);
  assetRepo = new AssetRepository(db);
  docRepo = new DocumentRepository(db);
  entityRepo = new EntityRepository(db);
  graphRepo = new GraphRepository(db);
  versionRepo = new VersionHistoryRepository(db);
  convRepo = new ConversationRepository(db);
  promptRepo = new PromptRepository(db);
  wfRepo = new WorkflowRepository(db);
  tlRepo = new TimelineRepository(db);
  userRepo = new UserRepository(db);
  activityRepo = new ActivityRepository(db);
  commentRepo = new CommentRepository(db);
  departmentRepo = new DepartmentRepository(db);
  approvalRepo = new ApprovalRepository(db);
  reviewRepo = new ReviewRepository(db);
  agentRepo = new AgentRepository(db);
  agentTaskRepo = new AgentTaskRepository(db);
  agentMsgRepo = new AgentMessageRepository(db);
  nodeWorkflowRepo = new NodeWorkflowRepository(db);

  // --- Projects ---
  ipcMain.handle("production:project:list", () => projectRepo.list() as ProjectDto[]);
  ipcMain.handle("production:project:create", (_e, dto: CreateProjectDto) => {
    if (!dto.name?.trim()) throw new Error("Project name is required");
    return projectRepo.create(dto as CreateProjectInput) as ProjectDto;
  });
  ipcMain.handle("production:project:get", (_e, uuid: string) =>
    projectRepo.findByUuid(uuid) as ProjectDto | undefined,
  );
  ipcMain.handle("production:project:update", (_e, project: ProjectDto) =>
    projectRepo.update(project),
  );
  ipcMain.handle("production:project:delete", (_e, uuid: string) =>
    projectRepo.delete(uuid),
  );

  // --- Assets ---
  ipcMain.handle("production:asset:list", (_e, filter?: { type?: AssetDto["assetType"] }) =>
    assetRepo.list(filter) as AssetDto[],
  );
  ipcMain.handle("production:asset:create", (_e, dto: CreateAssetDto) => {
    if (dto.path && /\.\./.test(dto.path)) throw new Error("Invalid asset path");
    return assetRepo.create(dto as CreateAssetInput) as AssetDto;
  });
  ipcMain.handle("production:asset:get", (_e, uuid: string) =>
    assetRepo.findByUuid(uuid) as AssetDto | undefined,
  );
  ipcMain.handle("production:asset:delete", (_e, uuid: string) =>
    assetRepo.delete(uuid),
  );

  // --- Documents ---
  ipcMain.handle("production:document:list", (_e, projectUuid?: string) =>
    projectUuid ? docRepo.listByProject(projectUuid) as DocumentDto[] : docRepo.listAll() as DocumentDto[],
  );
  ipcMain.handle("production:document:create", (_e, dto: CreateDocumentDto) =>
    docRepo.create(dto as CreateDocumentInput) as DocumentDto,
  );
  ipcMain.handle("production:document:get", (_e, uuid: string) =>
    docRepo.findByUuid(uuid) as DocumentDto | undefined,
  );
  ipcMain.handle("production:document:update", (_e, doc: DocumentDto) =>
    docRepo.update(doc),
  );
  ipcMain.handle("production:document:delete", (_e, uuid: string) =>
    docRepo.delete(uuid),
  );

  // --- Search ---
  ipcMain.handle("production:search", (_e, query: string) =>
    entityRepo.search(query).map((e): SearchResultDto => ({
      uuid: e.uuid,
      id: e.id,
      name: e.name,
      type: e.type,
      status: e.status,
    })),
  );

  // --- Dashboard stats ---
  ipcMain.handle("production:dashboard:stats", () => {
    const assets = assetRepo.list();
    const stats: DashboardStatsDto = {
      projectCount: projectRepo.list().length,
      assetCount: assets.length,
      documentCount: entityRepo.listByType("document").length,
      entityCount: entityRepo.countAll(),
      assetsByType: assets.reduce<Record<string, number>>((acc, a) => {
        acc[a.assetType] = (acc[a.assetType] ?? 0) + 1;
        return acc;
      }, {}),
    };
    return stats;
  });

  // --- Knowledge Graph (Phase 3) ---
  ipcMain.handle("production:graph:connect", (_e, source: string, target: string, type: string) =>
    graphRepo.connect(source, target, type),
  );
  ipcMain.handle("production:graph:relationships", (_e, from: string) =>
    graphRepo.relationships(from) as Relationship[],
  );
  ipcMain.handle("production:graph:disconnect", (_e, source: string, target: string, type: string) =>
    graphRepo.disconnect(source, target, type),
  );

  // --- Version History (Phase 3) ---
  ipcMain.handle("production:version:list", (_e, entityUuid: string) =>
    versionRepo.list(entityUuid) as VersionSnapshot[],
  );
  ipcMain.handle("production:version:get", (_e, entityUuid: string, version: number) =>
    versionRepo.getVersion(entityUuid, version) as VersionSnapshot | undefined,
  );

  // --- Metadata (Phase 3) ---
  ipcMain.handle("production:entity:tag", (_e, uuid: string, tag: string) => {
    const entity = entityRepo.findByUuid(uuid);
    if (!entity) throw new Error("Entity not found.");
    if (!entity.tags.includes(tag)) {
      entity.tags.push(tag);
      entityRepo.updateEntity(entity);
    }
    return entity;
  });

  ipcMain.handle("production:entity:untag", (_e, uuid: string, tag: string) => {
    const entity = entityRepo.findByUuid(uuid);
    if (!entity) throw new Error("Entity not found.");
    entity.tags = entity.tags.filter((t) => t !== tag);
    entityRepo.updateEntity(entity);
    return entity;
  });

  ipcMain.handle("production:entity:patchStatus", (_e, uuid: string, status: EntityStatus) =>
    entityRepo.patchStatus(uuid, status),
  );

  ipcMain.handle("production:entity:get", (_e, uuid: string) =>
    entityRepo.findByUuid(uuid),
  );

  ipcMain.handle("production:entity:listByType", (_e, type: string) =>
    entityRepo.listByType(type),
  );

  // --- Conversations (Phase 4: AI Workspace) ---
  ipcMain.handle("production:conversation:list", () => convRepo.list() as Conversation[]);
  ipcMain.handle("production:conversation:create", async (_e, input: {
    name: string; projectUuid?: string; provider?: string; model?: string; messages?: ConversationMessage[];
  }) => {
    try { return convRepo.create(input) as Conversation; } catch (err) { log.error("conversation:create failed", err); throw err; }
  });
  ipcMain.handle("production:conversation:get", (_e, uuid: string) =>
    convRepo.findByUuid(uuid) as Conversation | undefined);
  ipcMain.handle("production:conversation:addMessage", (_e, uuid: string, msg: ConversationMessage) =>
    convRepo.addMessage(uuid, msg));
  ipcMain.handle("production:conversation:delete", (_e, uuid: string) =>
    convRepo.delete(uuid));

  // --- Prompts (Phase 6: Prompt Intelligence) ---
  ipcMain.handle("production:prompt:list", () => promptRepo.list() as PromptEntity[]);
  ipcMain.handle("production:prompt:create", async (_e, input: {
    name: string; projectUuid?: string; provider?: string; model?: string; template: string;
  }) => {
    try { return promptRepo.create(input) as PromptEntity; } catch (err) { log.error("prompt:create failed", err); throw err; }
  });
  ipcMain.handle("production:prompt:get", (_e, uuid: string) =>
    promptRepo.findByUuid(uuid) as PromptEntity | undefined);
  ipcMain.handle("production:prompt:update", (_e, prompt: PromptEntity) =>
    promptRepo.update(prompt));
  ipcMain.handle("production:prompt:render", (_e, template: string, vars: Record<string, string>) =>
    promptRepo.render(template, vars));
  ipcMain.handle("production:prompt:delete", (_e, uuid: string) =>
    promptRepo.delete(uuid));

  // --- Workflows (Phase 8: Production Automation) ---
  ipcMain.handle("production:workflow:list", () => wfRepo.list() as Workflow[]);
  ipcMain.handle("production:workflow:create", async (_e, input: {
    name: string; projectUuid?: string; definition?: WorkflowDefinition;
  }) => {
    try { return wfRepo.create(input) as Workflow; } catch (err) { log.error("workflow:create failed", err); throw err; }
  });
  ipcMain.handle("production:workflow:get", (_e, uuid: string) =>
    wfRepo.findByUuid(uuid) as Workflow | undefined);
  ipcMain.handle("production:workflow:updateState", (_e, uuid: string, state: WorkflowState) => {
    if (!VALID_WORKFLOW_STATES.includes(state)) throw new Error(`Invalid workflow state: ${state}`);
    return wfRepo.updateState(uuid, state);
  });
  ipcMain.handle("production:workflow:updateDefinition", (_e, uuid: string, def: WorkflowDefinition) =>
    wfRepo.updateDefinition(uuid, def));
  ipcMain.handle("production:workflow:delete", (_e, uuid: string) =>
    wfRepo.delete(uuid));

  // --- Timeline (Phase 10: Production Timeline) ---
  ipcMain.handle("production:timeline:list", (_e, filter?: { projectUuid?: string; timelineType?: TimelineType }) =>
    tlRepo.list(filter));
  ipcMain.handle("production:timeline:create", (_e, input: CreateTimelineInput) => {
    if (!input.name?.trim()) throw new Error("Timeline item name is required");
    return tlRepo.create(input);
  });
  ipcMain.handle("production:timeline:get", (_e, uuid: string) =>
    tlRepo.findByUuid(uuid));
  ipcMain.handle("production:timeline:update", (_e, uuid: string, updates: Record<string, unknown>) =>
    tlRepo.update(uuid, updates as Parameters<typeof tlRepo.update>[1]));
  ipcMain.handle("production:timeline:delete", (_e, uuid: string) =>
    tlRepo.delete(uuid));
  ipcMain.handle("production:timeline:dependents", (_e, uuid: string) =>
    tlRepo.dependents(uuid));
  ipcMain.handle("production:timeline:stats", (_e, projectUuid?: string) =>
    tlRepo.stats(projectUuid));

  // --- Users (Collaboration) ---
  ipcMain.handle("production:user:list", () => userRepo.list());
  ipcMain.handle("production:user:listActive", () => userRepo.listActive());
  ipcMain.handle("production:user:create", (_e, input: CreateUserInput) => {
    if (!input.displayName?.trim()) throw new Error("User display name is required");
    return userRepo.create(input);
  });
  ipcMain.handle("production:user:get", (_e, uuid: string) =>
    userRepo.findByUuid(uuid));
  ipcMain.handle("production:user:update", (_e, uuid: string, updates: Record<string, unknown>) =>
    userRepo.update(uuid, updates as Parameters<typeof userRepo.update>[1]));
  ipcMain.handle("production:user:delete", (_e, uuid: string) =>
    userRepo.delete(uuid));
  ipcMain.handle("production:user:stats", () => userRepo.stats());

  // --- Activity Log (Collaboration) ---
  ipcMain.handle("production:activity:list", (_e, filter?: ActivityFilter, limit?: number) =>
    activityRepo.list(filter, limit));
  ipcMain.handle("production:activity:log", (_e, input: LogActivityInput) => {
    if (!input.action?.trim()) throw new Error("Activity action is required");
    if (!input.entityType?.trim()) throw new Error("Activity entity type is required");
    return activityRepo.log(input);
  });
  ipcMain.handle("production:activity:count", (_e, filter?: ActivityFilter) =>
    activityRepo.count(filter));

  // --- Comments (Collaboration) ---
  ipcMain.handle("production:comment:listByEntity", (_e, entityUuid: string) =>
    commentRepo.listByEntity(entityUuid));
  ipcMain.handle("production:comment:listRecent", (_e, limit?: number) =>
    commentRepo.listRecent(limit));
  ipcMain.handle("production:comment:create", (_e, input: CreateCommentInput) => {
    if (!input.entityUuid?.trim()) throw new Error("Comment entity UUID is required");
    if (!input.body?.trim()) throw new Error("Comment body is required");
    return commentRepo.create(input);
  });
  ipcMain.handle("production:comment:get", (_e, uuid: string) =>
    commentRepo.findByUuid(uuid));
  ipcMain.handle("production:comment:update", (_e, uuid: string, updates: Record<string, unknown>) =>
    commentRepo.update(uuid, updates as Parameters<typeof commentRepo.update>[1]));
  ipcMain.handle("production:comment:delete", (_e, uuid: string) =>
    commentRepo.delete(uuid));
  ipcMain.handle("production:comment:countByEntity", (_e, entityUuid: string) =>
    commentRepo.countByEntity(entityUuid));
  ipcMain.handle("production:comment:countUnresolved", (_e, entityUuid: string) =>
    commentRepo.countUnresolved(entityUuid));

  // --- Departments (Studio Platform) ---
  ipcMain.handle("production:department:list", () => departmentRepo.list());
  ipcMain.handle("production:department:create", (_e, input: CreateDepartmentInput) => {
    if (!input.name?.trim()) throw new Error("Department name is required");
    return departmentRepo.create(input);
  });
  ipcMain.handle("production:department:get", (_e, uuid: string) =>
    departmentRepo.findByUuid(uuid));
  ipcMain.handle("production:department:update", (_e, uuid: string, updates: Record<string, unknown>) =>
    departmentRepo.update(uuid, updates as Parameters<typeof departmentRepo.update>[1]));
  ipcMain.handle("production:department:delete", (_e, uuid: string) =>
    departmentRepo.delete(uuid));
  ipcMain.handle("production:department:members", (_e, departmentUuid: string) =>
    departmentRepo.listMembers(departmentUuid));
  ipcMain.handle("production:department:addMember", (_e, input: { departmentUuid: string; userUuid: string; role?: "lead" | "member" }) => {
    if (!input.departmentUuid?.trim()) throw new Error("Department UUID is required");
    if (!input.userUuid?.trim()) throw new Error("User UUID is required");
    return departmentRepo.addMember(input);
  });
  ipcMain.handle("production:department:removeMember", (_e, departmentUuid: string, userUuid: string) =>
    departmentRepo.removeMember(departmentUuid, userUuid));
  ipcMain.handle("production:department:userDepartments", (_e, userUuid: string) =>
    departmentRepo.listUserDepartments(userUuid));
  ipcMain.handle("production:department:stats", () => ({
    total: departmentRepo.count(),
    members: departmentRepo.list().reduce((acc, d) => acc + departmentRepo.memberCount(d.uuid), 0),
  }));

  // --- Approvals (Studio Platform) ---
  ipcMain.handle("production:approval:list", (_e, filters?: { status?: ApprovalStatus; approverUuid?: string; requesterUuid?: string }) =>
    approvalRepo.list(filters));
  ipcMain.handle("production:approval:create", (_e, input: CreateApprovalInput) => {
    if (!input.entityUuid?.trim()) throw new Error("Entity UUID is required");
    if (!input.requesterUuid?.trim()) throw new Error("Requester UUID is required");
    if (!input.approverUuid?.trim()) throw new Error("Approver UUID is required");
    return approvalRepo.create(input);
  });
  ipcMain.handle("production:approval:get", (_e, uuid: string) =>
    approvalRepo.findByUuid(uuid));
  ipcMain.handle("production:approval:updateStatus", (_e, uuid: string, status: ApprovalStatus, notes?: string) => {
    if (!["pending", "approved", "rejected"].includes(status)) throw new Error(`Invalid approval status: ${status}`);
    return approvalRepo.updateStatus(uuid, status, notes);
  });
  ipcMain.handle("production:approval:delete", (_e, uuid: string) =>
    approvalRepo.delete(uuid));
  ipcMain.handle("production:approval:byEntity", (_e, entityUuid: string) =>
    approvalRepo.listByEntity(entityUuid));
  ipcMain.handle("production:approval:stats", () => approvalRepo.stats());

  // --- Reviews (Studio Platform) ---
  ipcMain.handle("production:review:list", (_e, filters?: { status?: ReviewStatus; reviewerUuid?: string }) =>
    reviewRepo.list(filters));
  ipcMain.handle("production:review:create", (_e, input: CreateReviewInput) => {
    if (!input.entityUuid?.trim()) throw new Error("Entity UUID is required");
    if (!input.reviewerUuid?.trim()) throw new Error("Reviewer UUID is required");
    return reviewRepo.create(input);
  });
  ipcMain.handle("production:review:get", (_e, uuid: string) =>
    reviewRepo.findByUuid(uuid));
  ipcMain.handle("production:review:update", (_e, uuid: string, updates: Record<string, unknown>) =>
    reviewRepo.update(uuid, updates as Parameters<typeof reviewRepo.update>[1]));
  ipcMain.handle("production:review:delete", (_e, uuid: string) =>
    reviewRepo.delete(uuid));
  ipcMain.handle("production:review:byEntity", (_e, entityUuid: string) =>
    reviewRepo.listByEntity(entityUuid));
  ipcMain.handle("production:review:stats", () => reviewRepo.stats());

  // --- AI Agents (Phase 13) ---
  ipcMain.handle("production:agent:list", () => agentRepo.list());
  ipcMain.handle("production:agent:create", (_e, input: CreateAgentInput) => {
    if (!input.name?.trim()) throw new Error("Agent name is required");
    if (!input.role?.trim()) throw new Error("Agent role is required");
    return agentRepo.create(input);
  });
  ipcMain.handle("production:agent:get", (_e, uuid: string) => agentRepo.findByUuid(uuid));
  ipcMain.handle("production:agent:getByRole", (_e, role: string) => agentRepo.findByRole(role));
  ipcMain.handle("production:agent:update", (_e, uuid: string, input: Partial<CreateAgentInput>) =>
    agentRepo.update(uuid, input));
  ipcMain.handle("production:agent:updateStatus", (_e, uuid: string, status: "idle" | "busy" | "paused" | "offline") =>
    agentRepo.updateStatus(uuid, status));
  ipcMain.handle("production:agent:delete", (_e, uuid: string) => agentRepo.delete(uuid));
  ipcMain.handle("production:agent:stats", () => agentRepo.stats());

  // --- Agent Tasks (Phase 13) ---
  ipcMain.handle("production:agentTask:list", (_e, filters?: { status?: string; agentId?: string }) => {
    if (filters?.agentId) return agentTaskRepo.listByAgent(filters.agentId);
    if (filters?.status) return agentTaskRepo.listByStatus(filters.status as "pending" | "in_progress" | "completed" | "failed" | "cancelled");
    return agentTaskRepo.list();
  });
  ipcMain.handle("production:agentTask:create", (_e, input: CreateTaskInput) => {
    if (!input.agentId?.trim()) throw new Error("Agent ID is required");
    if (!input.title?.trim()) throw new Error("Task title is required");
    return agentTaskRepo.create(input);
  });
  ipcMain.handle("production:agentTask:get", (_e, uuid: string) => agentTaskRepo.findByUuid(uuid));
  ipcMain.handle("production:agentTask:update", (_e, uuid: string, input: Partial<CreateTaskInput>) =>
    agentTaskRepo.update(uuid, input));
  ipcMain.handle("production:agentTask:start", (_e, uuid: string) => agentTaskRepo.start(uuid));
  ipcMain.handle("production:agentTask:complete", (_e, uuid: string, output: Record<string, unknown>) =>
    agentTaskRepo.complete(uuid, output));
  ipcMain.handle("production:agentTask:fail", (_e, uuid: string, reason: string) =>
    agentTaskRepo.fail(uuid, reason));
  ipcMain.handle("production:agentTask:cancel", (_e, uuid: string) => agentTaskRepo.cancel(uuid));
  ipcMain.handle("production:agentTask:delete", (_e, uuid: string) => agentTaskRepo.delete(uuid));
  ipcMain.handle("production:agentTask:stats", () => agentTaskRepo.stats());

  // --- Agent Messages (Phase 13) ---
  ipcMain.handle("production:agentMessage:list", (_e, filters?: { agentId?: string; taskId?: string; limit?: number }) => {
    if (filters?.taskId) return agentMsgRepo.listByTask(filters.taskId);
    if (filters?.agentId) return agentMsgRepo.listByAgent(filters.agentId, filters.limit);
    return agentMsgRepo.list(filters?.limit);
  });
  ipcMain.handle("production:agentMessage:create", (_e, input: CreateMessageInput) => {
    if (!input.agentId?.trim()) throw new Error("Agent ID is required");
    if (!input.content?.trim()) throw new Error("Message content is required");
    return agentMsgRepo.create(input);
  });
  ipcMain.handle("production:agentMessage:get", (_e, uuid: string) => agentMsgRepo.findByUuid(uuid));
  ipcMain.handle("production:agentMessage:deleteByAgent", (_e, agentId: string) =>
    agentMsgRepo.deleteByAgent(agentId));
  ipcMain.handle("production:agentMessage:deleteByTask", (_e, taskId: string) =>
    agentMsgRepo.deleteByTask(taskId));
  ipcMain.handle("production:agentMessage:stats", (_e, agentId: string) => ({
    count: agentMsgRepo.countByAgent(agentId),
    tokens: agentMsgRepo.tokensByAgent(agentId),
  }));

  // --- Node Workflows (Phase 14) ---
  ipcMain.handle("production:nodeWorkflow:list", () => nodeWorkflowRepo.list());
  ipcMain.handle("production:nodeWorkflow:create", (_e, input: CreateNodeWorkflowInput) => {
    if (!input.name?.trim()) throw new Error("Workflow name is required");
    return nodeWorkflowRepo.create(input);
  });
  ipcMain.handle("production:nodeWorkflow:get", (_e, uuid: string) => nodeWorkflowRepo.findByUuid(uuid));
  ipcMain.handle("production:nodeWorkflow:update", (_e, uuid: string, input: Partial<CreateNodeWorkflowInput> & { status?: string }) =>
    nodeWorkflowRepo.update(uuid, input));
  ipcMain.handle("production:nodeWorkflow:updateGraph", (_e, uuid: string, nodes: string, edges: string, viewport?: string) =>
    nodeWorkflowRepo.updateGraph(uuid, nodes, edges, viewport));
  ipcMain.handle("production:nodeWorkflow:delete", (_e, uuid: string) => nodeWorkflowRepo.delete(uuid));
  ipcMain.handle("production:nodeWorkflow:listByStatus", (_e, status: "draft" | "active" | "archived") =>
    nodeWorkflowRepo.listByStatus(status));
  ipcMain.handle("production:nodeWorkflow:stats", () => nodeWorkflowRepo.stats());
}