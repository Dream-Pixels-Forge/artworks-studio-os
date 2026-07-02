/**
 * Markdown Editor panel.
 *
 * Creates and edits markdown documents (production bibles, story
 * bibles, character bible, etc.). Split-pane: textarea + live preview.
 * Uses the production IPC bridge for document CRUD.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Doc {
  uuid: string;
  id: string;
  name: string;
  docType: string;
  content: string;
  projectUuid?: string;
  updatedAt: string;
}

const DOC_TYPES = [
  "production-bible",
  "story-bible",
  "character-bible",
  "environment-bible",
  "prop-bible",
  "storyboard",
  "shot-list",
  "notes",
];

export function MarkdownEditorPanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[0]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const list = await window.artworks.production.document.list();
    setDocs(list as Doc[]);
  }

  function open(doc: Doc) {
    setSelected(doc);
    setContent(doc.content);
    setName(doc.name);
    setDocType(doc.docType);
  }

  async function save() {
    if (!selected) {
      if (!name.trim()) return;
      const created = await window.artworks.production.document.create({
        name,
        docType,
        content,
      });
      setSelected(created as Doc);
    } else {
      await window.artworks.production.document.update({
        ...selected,
        name,
        docType,
        content,
      });
    }
    await refresh();
  }

  async function createNew() {
    setSelected(null);
    setContent("");
    setName("");
    setDocType(DOC_TYPES[0]);
  }

  async function remove(uuid: string) {
    await window.artworks.production.document.delete(uuid);
    if (selected?.uuid === uuid) createNew();
    await refresh();
  }

  return (
    <div className="md-editor">
      <div className="md-editor__sidebar">
        <h2 className="md-editor__title">Documents</h2>
        <button className="md-editor__new" onClick={createNew}>
          + New Document
        </button>
        <ul className="md-editor__list">
          {docs.length === 0 && (
            <p className="md-editor__empty">No documents yet.</p>
          )}
          {docs.map((d) => (
            <li
              key={d.uuid}
              className={`md-editor__item${selected?.uuid === d.uuid ? " md-editor__item--active" : ""}`}
              onClick={() => open(d)}
            >
              <span className="md-editor__item-name">{d.name}</span>
              <span className="md-editor__item-type">{d.docType}</span>
              <button
                className="md-editor__item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(d.uuid);
                }}
                title="Delete"
              >
                {"\u00d7"}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="md-editor__main">
        <div className="md-editor__toolbar">
          <input
            className="md-editor__name"
            placeholder="Document title"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="md-editor__type"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button className="md-editor__save" onClick={save}>
            Save
          </button>
        </div>
        <div className="md-editor__split">
          <textarea
            className="md-editor__textarea"
            placeholder="Write markdown here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
          />
          <div
            className="md-editor__preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        </div>
      </div>
    </div>
  );
}

/** Minimal markdown→HTML renderer (subset: headings, bold, italic, lists, code). */
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
  // Unordered lists: consecutive "- item" lines.
  html = html.replace(/(?:^- (.+)$\n?)+/gm, (match) => {
    const items = match
      .trim()
      .split("\n")
      .map((line) => line.replace(/^- /, "").trim());
    return "<ul>" + items.map((i) => `<li>${i}</li>`).join("") + "</ul>";
  });
  return html;
}

panelRegistry.register({
  id: "markdown-editor",
  title: "Markdown Editor",
  icon: "\u{1f4dd}", // 📝
  component: MarkdownEditorPanel,
  defaultSlot: "center",
  defaultVisible: false,
});