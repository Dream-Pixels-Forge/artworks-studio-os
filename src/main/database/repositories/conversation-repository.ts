/**
 * Conversation repository.
 *
 * Conversations span `entities` + `conversations` (project_uuid, provider,
 * model, messages). Messages are stored as a JSON array.
 */
import type { Entity } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import { entityRowToEntity, type EntityRow } from "../entity-mapper.js";

export interface ConversationMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface Conversation extends Entity {
  readonly type: "conversation";
  projectUuid?: string;
  provider?: string;
  model?: string;
  messages: ConversationMessage[];
}

export class ConversationRepository {
  private readonly entities: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entities = new EntityRepository(db);
  }

  create(input: {
    name: string;
    projectUuid?: string;
    provider?: string;
    model?: string;
    messages?: ConversationMessage[];
  }): Conversation {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const conv: Conversation = {
        uuid,
        id: this.entities.nextId("CONV", "conversation"),
        name: input.name,
        type: "conversation",
        status: "active",
        version: 1,
        createdAt: now,
        updatedAt: now,
        tags: [],
        metadata: {},
        projectUuid: input.projectUuid,
        provider: input.provider,
        model: input.model,
        messages: input.messages ?? [],
      };
      this.entities.insertEntity(conv);
      this.db.exec(
        "INSERT INTO conversations (uuid, project_uuid, provider, model, messages) VALUES (?, ?, ?, ?, ?)",
        [uuid, input.projectUuid ?? null, input.provider ?? null, input.model ?? null, JSON.stringify(input.messages ?? [])],
      );
      return conv;
    });
  }

  findByUuid(uuid: string): Conversation | undefined {
    const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ? AND type = ?", [uuid, "conversation"]);
    if (!row) return undefined;
    const typeRow = this.db.get<{
      project_uuid: string | null; provider: string | null; model: string | null; messages: string;
    }>("SELECT * FROM conversations WHERE uuid = ?", [uuid]);
    if (!typeRow) return undefined;
    return {
      ...entityRowToEntity(row),
      projectUuid: typeRow.project_uuid ?? undefined,
      provider: typeRow.provider ?? undefined,
      model: typeRow.model ?? undefined,
      messages: JSON.parse(typeRow.messages) as ConversationMessage[],
    } as Conversation;
  }

  listByProject(projectUuid: string): Conversation[] {
    const rows = this.db.all<{ uuid: string }>(
      "SELECT uuid FROM conversations WHERE project_uuid = ?",
      [projectUuid],
    );
    return rows.map((r) => this.findByUuid(r.uuid)).filter((c): c is Conversation => c !== undefined);
  }

  list(): Conversation[] {
    const rows = this.db.all<EntityRow>(
      "SELECT * FROM entities WHERE type = ? ORDER BY updated_at DESC",
      ["conversation"],
    );
    return rows.map((row) => {
      const typeRow = this.db.get<{
        project_uuid: string | null; provider: string | null; model: string | null; messages: string;
      }>("SELECT * FROM conversations WHERE uuid = ?", [row.uuid]);
      if (!typeRow) return undefined;
      return {
        ...entityRowToEntity(row),
        projectUuid: typeRow.project_uuid ?? undefined,
        provider: typeRow.provider ?? undefined,
        model: typeRow.model ?? undefined,
        messages: JSON.parse(typeRow.messages) as ConversationMessage[],
      } as Conversation;
    }).filter((c): c is Conversation => c !== undefined);
  }

  addMessage(uuid: string, message: ConversationMessage): void {
    this.db.transaction(() => {
      const conv = this.findByUuid(uuid);
      if (!conv) return;
      const updated = [...conv.messages, message];
      this.entities.updateEntity({ ...conv, updatedAt: new Date().toISOString() });
      this.db.exec("UPDATE conversations SET messages = ? WHERE uuid = ?", [JSON.stringify(updated), uuid]);
    });
  }

  delete(uuid: string): void {
    this.entities.deleteByUuid(uuid);
  }
}