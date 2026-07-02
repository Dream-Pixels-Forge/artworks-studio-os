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
}