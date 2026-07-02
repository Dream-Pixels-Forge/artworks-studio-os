/**
 * Workflow repository.
 *
 * Workflows span `entities` + `workflows` (project_uuid, definition, state).
 * The definition is a JSON pipeline; state tracks execution lifecycle.
 */
import type { Entity } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import { entityRowToEntity, type EntityRow } from "../entity-mapper.js";

export type WorkflowState = "idle" | "running" | "paused" | "completed" | "failed";

export interface WorkflowDefinition {
  readonly steps: WorkflowStep[];
}

export interface WorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly params?: Record<string, unknown>;
}

export interface Workflow extends Entity {
  readonly type: "workflow";
  projectUuid?: string;
  definition: WorkflowDefinition;
  state: WorkflowState;
}

export class WorkflowRepository {
  private readonly entities: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entities = new EntityRepository(db);
  }

  create(input: {
    name: string;
    projectUuid?: string;
    definition?: WorkflowDefinition;
  }): Workflow {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const wf: Workflow = {
        uuid,
        id: this.entities.nextId("WF", "workflow"),
        name: input.name,
        type: "workflow",
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        tags: [],
        metadata: {},
        projectUuid: input.projectUuid,
        definition: input.definition ?? { steps: [] },
        state: "idle",
      };
      this.entities.insertEntity(wf);
      this.db.exec(
        "INSERT INTO workflows (uuid, project_uuid, definition, state) VALUES (?, ?, ?, ?)",
        [uuid, input.projectUuid ?? null, JSON.stringify(wf.definition), "idle"],
      );
      return wf;
    });
  }

  findByUuid(uuid: string): Workflow | undefined {
    const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ? AND type = ?", [uuid, "workflow"]);
    if (!row) return undefined;
    const typeRow = this.db.get<{
      project_uuid: string | null; definition: string; state: string;
    }>("SELECT * FROM workflows WHERE uuid = ?", [uuid]);
    if (!typeRow) return undefined;
    return {
      ...entityRowToEntity(row),
      projectUuid: typeRow.project_uuid ?? undefined,
      definition: JSON.parse(typeRow.definition) as WorkflowDefinition,
      state: typeRow.state as WorkflowState,
    } as Workflow;
  }

  list(): Workflow[] {
    const rows = this.db.all<EntityRow>(
      "SELECT * FROM entities WHERE type = ? ORDER BY updated_at DESC",
      ["workflow"],
    );
    return rows.map((row) => {
      const typeRow = this.db.get<{
        project_uuid: string | null; definition: string; state: string;
      }>("SELECT * FROM workflows WHERE uuid = ?", [row.uuid]);
      if (!typeRow) return undefined;
      return {
        ...entityRowToEntity(row),
        projectUuid: typeRow.project_uuid ?? undefined,
        definition: JSON.parse(typeRow.definition) as WorkflowDefinition,
        state: typeRow.state as WorkflowState,
      } as Workflow;
    }).filter((w): w is Workflow => w !== undefined);
  }

  updateState(uuid: string, state: WorkflowState): void {
    this.db.transaction(() => {
      const entity = this.entities.findByUuid(uuid);
      if (!entity) throw new Error(`Workflow ${uuid} not found`);
      this.db.exec("UPDATE workflows SET state = ? WHERE uuid = ?", [state, uuid]);
      this.entities.updateEntity({ ...entity, updatedAt: new Date().toISOString() });
    });
  }

  updateDefinition(uuid: string, definition: WorkflowDefinition): void {
    this.db.transaction(() => {
      const entity = this.entities.findByUuid(uuid);
      if (!entity) throw new Error(`Workflow ${uuid} not found`);
      this.db.exec("UPDATE workflows SET definition = ? WHERE uuid = ?", [JSON.stringify(definition), uuid]);
      this.entities.updateEntity({ ...entity, updatedAt: new Date().toISOString() });
    });
  }

  delete(uuid: string): void {
    this.entities.deleteByUuid(uuid);
  }
}