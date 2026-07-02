/**
 * Prompt repository.
 *
 * Prompts span `entities` + `prompts` (project_uuid, provider, model,
 * template). Acts as both a prompt library and a generation record.
 */
import type { Entity } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import { entityRowToEntity, type EntityRow } from "../entity-mapper.js";

export interface PromptEntity extends Entity {
  readonly type: "prompt";
  projectUuid?: string;
  provider?: string;
  model?: string;
  template: string;
}

export interface CreatePromptInput {
  name: string;
  projectUuid?: string;
  provider?: string;
  model?: string;
  template: string;
}

export class PromptRepository {
  private readonly entities: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entities = new EntityRepository(db);
  }

  create(input: CreatePromptInput): PromptEntity {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const prompt: PromptEntity = {
        uuid,
        id: this.entities.nextId("PRM", "prompt"),
        name: input.name,
        type: "prompt",
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        tags: [],
        metadata: {},
        projectUuid: input.projectUuid,
        provider: input.provider,
        model: input.model,
        template: input.template,
      };
      this.entities.insertEntity(prompt);
      this.db.exec(
        "INSERT INTO prompts (uuid, project_uuid, provider, model, template) VALUES (?, ?, ?, ?, ?)",
        [uuid, input.projectUuid ?? null, input.provider ?? null, input.model ?? null, input.template],
      );
      return prompt;
    });
  }

  findByUuid(uuid: string): PromptEntity | undefined {
    const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ? AND type = ?", [uuid, "prompt"]);
    if (!row) return undefined;
    const typeRow = this.db.get<{
      project_uuid: string | null; provider: string | null; model: string | null; template: string;
    }>("SELECT * FROM prompts WHERE uuid = ?", [uuid]);
    if (!typeRow) return undefined;
    return {
      ...entityRowToEntity(row),
      projectUuid: typeRow.project_uuid ?? undefined,
      provider: typeRow.provider ?? undefined,
      model: typeRow.model ?? undefined,
      template: typeRow.template,
    } as PromptEntity;
  }

  list(): PromptEntity[] {
    const rows = this.db.all<EntityRow>(
      "SELECT * FROM entities WHERE type = ? ORDER BY updated_at DESC",
      ["prompt"],
    );
    return rows.map((row) => {
      const typeRow = this.db.get<{
        project_uuid: string | null; provider: string | null; model: string | null; template: string;
      }>("SELECT * FROM prompts WHERE uuid = ?", [row.uuid]);
      if (!typeRow) return undefined;
      return {
        ...entityRowToEntity(row),
        projectUuid: typeRow.project_uuid ?? undefined,
        provider: typeRow.provider ?? undefined,
        model: typeRow.model ?? undefined,
        template: typeRow.template,
      } as PromptEntity;
    }).filter((p): p is PromptEntity => p !== undefined);
  }

  update(prompt: PromptEntity): void {
    this.db.transaction(() => {
      this.entities.updateEntity({ ...prompt, updatedAt: new Date().toISOString() });
      this.db.exec(
        "UPDATE prompts SET project_uuid = ?, provider = ?, model = ?, template = ? WHERE uuid = ?",
        [prompt.projectUuid ?? null, prompt.provider ?? null, prompt.model ?? null, prompt.template, prompt.uuid],
      );
    });
  }

  /** Render a prompt template by replacing {{variable}} placeholders with values. */
  render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
  }

  delete(uuid: string): void {
    this.entities.deleteByUuid(uuid);
  }
}