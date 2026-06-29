/**
 * Project repository.
 *
 * Projects span two tables: `entities` (generic fields) + `projects`
 * (description). Every write is transactional so the two stay consistent.
 * `Project.type` is the literal "production" — see docs/database.md.
 */
import type { Project } from "@shared/models/index.js";
import type { StudioDatabase } from "../db.js";
import { EntityRepository } from "./entity-repository.js";
import type { EntityRow } from "../entity-mapper.js";
import { entityRowToEntity } from "../entity-mapper.js";

interface ProjectRow {
  description: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export class ProjectRepository {
  private readonly entities: EntityRepository;

  constructor(private readonly db: StudioDatabase) {
    this.entities = new EntityRepository(db);
  }

  create(input: CreateProjectInput): Project {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const uuid = crypto.randomUUID();
      const project: Project = {
        uuid,
        id: this.entities.nextId("PROD", "production"),
        name: input.name,
        type: "production",
        status: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
        tags: [],
        metadata: {},
        description: input.description ?? "",
      };
      this.entities.insertEntity(project);
      this.db.exec("INSERT INTO projects (uuid, description) VALUES (?, ?)", [
        uuid,
        project.description,
      ]);
      return project;
    });
  }

  findByUuid(uuid: string): Project | undefined {
    return this.db.transaction(() => {
      const row = this.db.get<EntityRow>("SELECT * FROM entities WHERE uuid = ? AND type = ?", [
        uuid,
        "production",
      ]);
      if (!row) return undefined;
      const typeRow = this.db.get<ProjectRow>(
        "SELECT description FROM projects WHERE uuid = ?",
        [uuid],
      );
      return { ...entityRowToEntity(row), description: typeRow?.description ?? "" } as Project;
    });
  }

  list(): Project[] {
    const rows = this.db.all<EntityRow>(
      "SELECT * FROM entities WHERE type = ? ORDER BY updated_at DESC",
      ["production"],
    );
    return rows.map((row) => {
      const typeRow = this.db.get<ProjectRow>(
        "SELECT description FROM projects WHERE uuid = ?",
        [row.uuid],
      );
      return {
        ...entityRowToEntity(row),
        description: typeRow?.description ?? "",
      } as Project;
    });
  }

  update(project: Project): void {
    this.db.transaction(() => {
      this.entities.updateEntity({ ...project, updatedAt: new Date().toISOString() });
      this.db.exec("UPDATE projects SET description = ? WHERE uuid = ?", [
        project.description,
        project.uuid,
      ]);
    });
  }

  delete(uuid: string): void {
    this.entities.deleteByUuid(uuid);
  }
}
