/**
 * Export service — exports production data as Markdown or JSON.
 * Reads from the database and produces self-contained export bundles.
 */
import type { StudioDatabase } from "@main/database/db.js";

export interface ExportOptions {
  format: "json" | "markdown";
  includeGraph?: boolean;
  includeTimeline?: boolean;
  includeComments?: boolean;
  entityTypes?: string[];
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  entityCount: number;
}

export class ExportService {
  constructor(private readonly db: StudioDatabase) {}

  exportProduction(options: ExportOptions): ExportResult {
    const entities = this.db.all<Record<string, unknown>>(
      options.entityTypes?.length
        ? `SELECT * FROM entities WHERE type IN (${options.entityTypes.map(() => "?").join(",")}) ORDER BY type, name`
        : "SELECT * FROM entities ORDER BY type, name",
      options.entityTypes ?? [],
    );

    const relationships = options.includeGraph
      ? this.db.all<Record<string, unknown>>("SELECT * FROM relationships ORDER BY created_at DESC")
      : [];

    const timeline = options.includeTimeline
      ? this.db.all<Record<string, unknown>>("SELECT * FROM timeline_items ORDER BY created_at DESC")
      : [];

    const comments = options.includeComments
      ? this.db.all<Record<string, unknown>>("SELECT * FROM comments ORDER BY created_at DESC")
      : [];

    if (options.format === "json") {
      return this.exportJson(entities, relationships, timeline, comments);
    }
    return this.exportMarkdown(entities, relationships, timeline, comments);
  }

  private exportJson(
    entities: Record<string, unknown>[],
    relationships: Record<string, unknown>[],
    timeline: Record<string, unknown>[],
    comments: Record<string, unknown>[],
  ): ExportResult {
    const bundle = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      stats: {
        entities: entities.length,
        relationships: relationships.length,
        timelineItems: timeline.length,
        comments: comments.length,
      },
      entities,
      relationships,
      timeline,
      comments,
    };

    const content = JSON.stringify(bundle, null, 2);
    const filename = `production-export-${this.timestamp()}.json`;
    return { content, filename, mimeType: "application/json", entityCount: entities.length };
  }

  private exportMarkdown(
    entities: Record<string, unknown>[],
    relationships: Record<string, unknown>[],
    timeline: Record<string, unknown>[],
    comments: Record<string, unknown>[],
  ): ExportResult {
    const lines: string[] = [];
    lines.push("# Production Export");
    lines.push(`> Exported ${new Date().toLocaleString()}`);
    lines.push("");

    const byType = new Map<string, Record<string, unknown>[]>();
    for (const e of entities) {
      const type = String(e.type ?? "unknown");
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(e);
    }

    lines.push("## Summary");
    lines.push("");
    lines.push(`| Category | Count |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Entities | ${entities.length} |`);
    lines.push(`| Relationships | ${relationships.length} |`);
    lines.push(`| Timeline Items | ${timeline.length} |`);
    lines.push(`| Comments | ${comments.length} |`);
    lines.push("");

    for (const [type, items] of byType) {
      lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}s (${items.length})`);
      lines.push("");
      for (const item of items) {
        lines.push(`### ${String(item.name ?? "Unnamed")}`);
        lines.push("");
        lines.push(`- **UUID:** ${String(item.uuid ?? "")}`);
        lines.push(`- **Status:** ${String(item.status ?? "unknown")}`);
        const tagsRaw = item.tags;
        const tags: string[] | undefined =
          typeof tagsRaw === "string" ? JSON.parse(tagsRaw) as string[] :
          Array.isArray(tagsRaw) ? tagsRaw as string[] :
          undefined;
        if (tags?.length) lines.push(`- **Tags:** ${tags.join(", ")}`);
        const metaRaw = item.metadata;
        const meta: Record<string, unknown> | undefined =
          typeof metaRaw === "string" ? JSON.parse(metaRaw) as Record<string, unknown> :
          (metaRaw && typeof metaRaw === "object") ? metaRaw as Record<string, unknown> :
          undefined;
        if (meta) {
          for (const [k, v] of Object.entries(meta)) {
            if (v !== undefined && v !== null && v !== "") {
              lines.push(`- **${k}:** ${String(v)}`);
            }
          }
        }
        lines.push("");
      }
    }

    if (relationships.length > 0) {
      lines.push(`## Relationships (${relationships.length})`);
      lines.push("");
      lines.push("| Source | Type | Target |");
      lines.push("|--------|------|--------|");
      for (const r of relationships) {
        lines.push(`| ${String(r.source_uuid ?? "")} | ${String(r.type ?? "")} | ${String(r.target_uuid ?? "")} |`);
      }
      lines.push("");
    }

    if (timeline.length > 0) {
      lines.push(`## Timeline (${timeline.length})`);
      lines.push("");
      for (const t of timeline) {
        lines.push(`- **${String(t.name ?? "Unnamed")}** (${String(t.timeline_type ?? "task")}) — ${String(t.status ?? "unknown")}`);
      }
      lines.push("");
    }

    if (comments.length > 0) {
      lines.push(`## Comments (${comments.length})`);
      lines.push("");
      for (const c of comments) {
        lines.push(`> ${String(c.body ?? "")}`);
        lines.push(`> — ${String(c.user_uuid ?? "anonymous")} on ${String(c.created_at ?? "")}`);
        lines.push("");
      }
    }

    const content = lines.join("\n");
    const filename = `production-export-${this.timestamp()}.md`;
    return { content, filename, mimeType: "text/markdown", entityCount: entities.length };
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }
}
