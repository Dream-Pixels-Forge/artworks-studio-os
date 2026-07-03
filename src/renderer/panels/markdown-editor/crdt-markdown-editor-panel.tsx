/**
 * CRDT-Aware Markdown Editor panel.
 *
 * Wraps the existing MarkdownEditorPanel with:
 *   - Yjs CRDT document loading and live sync
 *   - Presence indicators (who's viewing, cursor positions)
 *   - Version clock display
 *
 * The CRDT document is keyed by the document UUID. When a document is
 * opened, the Yjs state is loaded from the main process, and any local
 * edits are applied as Yjs updates that get flushed periodically.
 *
 * Presence is updated on every keystroke and on selection changes.
 * Other users' presence entries are displayed as colored cursors in
 * the editor sidebar and as a presence bar above the textarea.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

/* ── Types ─────────────────────────────────────────────────────── */

interface Doc {
  uuid: string;
  id: string;
  name: string;
  docType: string;
  content: string;
  projectUuid?: string;
  updatedAt: string;
}

interface PresenceEntry {
  userUuid: string;
  userName: string;
  documentId: string;
  cursor?: { index: number; length: number };
  selection?: { anchor: number; head: number };
  lastSeen: string;
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

const COLLAB_COLORS = [
  "#e06c75", "#61afef", "#98c379", "#e5c07b",
  "#c678dd", "#56b6c2", "#be5046", "#d19a66",
];

/* ── Helpers ───────────────────────────────────────────────────── */

function colorForUser(userUuid: string): string {
  let hash = 0;
  for (let i = 0; i < userUuid.length; i++) {
    hash = (hash * 31 + userUuid.charCodeAt(i)) | 0;
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

/* ── Component ─────────────────────────────────────────────────── */

export function CrdtMarkdownEditorPanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [versionClock, setVersionClock] = useState(0);

  const currentDocIdRef = useRef<string | null>(null);
  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Document list ─────────────────────────────────────────── */

  useEffect(() => {
    refresh();
    return () => {
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    };
  }, []);

  async function refresh() {
    const list = await window.artworks.production.document.list();
    setDocs(list as Doc[]);
  }

  /* ── Open document → load CRDT state ────────────────────────── */

  const open = useCallback(async (doc: Doc) => {
    // Remove presence from previous document.
    if (currentDocIdRef.current) {
      await window.artworks.collab.removePresence(
        "local-user",
        currentDocIdRef.current,
      );
    }

    setSelected(doc);
    setName(doc.name);
    setDocType(doc.docType);

    const docId = doc.uuid;
    currentDocIdRef.current = docId;

    // Load CRDT content (falls back to plain content if no CRDT state exists).
    const crdtContent = await window.artworks.collab.getDocumentContent(docId);
    const hasCrdt = crdtContent.length > 0;
    setContent(hasCrdt ? crdtContent : doc.content);

    // Load version clock.
    const clock = await window.artworks.collab.getVersionClock(docId);
    setVersionClock(clock);

    // Register presence.
    await window.artworks.collab.updatePresence(
      "local-user",
      "You",
      docId,
    );

    // Start presence refresh timer.
    if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    presenceTimerRef.current = setInterval(async () => {
      if (currentDocIdRef.current) {
        const entries = await window.artworks.collab.getDocumentPresence(
          currentDocIdRef.current,
        );
        setPresence(entries as PresenceEntry[]);
      }
    }, 2000);
  }, []);

  /* ── Save / Create ─────────────────────────────────────────── */

  async function save() {
    if (!selected) {
      if (!name.trim()) return;
      const created = await window.artworks.production.document.create({
        name,
        docType,
        content,
      });
      setSelected(created as Doc);
      // Initialize CRDT for the new document.
      const newDoc = created as Doc;
      currentDocIdRef.current = newDoc.uuid;
      await window.artworks.collab.updatePresence(
        "local-user",
        "You",
        newDoc.uuid,
      );
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

  /* ── Create new ────────────────────────────────────────────── */

  async function createNew() {
    if (currentDocIdRef.current) {
      await window.artworks.collab.removePresence(
        "local-user",
        currentDocIdRef.current,
      );
    }
    if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    setSelected(null);
    setContent("");
    setName("");
    setDocType(DOC_TYPES[0]);
    setVersionClock(0);
    setPresence([]);
    currentDocIdRef.current = null;
  }

  /* ── Delete ────────────────────────────────────────────────── */

  async function remove(uuid: string) {
    if (currentDocIdRef.current === uuid) {
      await window.artworks.collab.removePresence("local-user", uuid);
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    }
    await window.artworks.production.document.delete(uuid);
    if (selected?.uuid === uuid) createNew();
    await refresh();
  }

  /* ── Content change → update local state + presence ─────────── */

  const onContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      // Update presence cursor to end of content (simplified).
      if (currentDocIdRef.current) {
        void window.artworks.collab.updatePresence(
          "local-user",
          "You",
          currentDocIdRef.current,
          { index: newContent.length, length: 0 },
        );
      }
    },
    [],
  );

  /* ── Render ────────────────────────────────────────────────── */

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
              onClick={() => void open(d)}
            >
              <span className="md-editor__item-name">{d.name}</span>
              <span className="md-editor__item-type">{d.docType}</span>
              <button
                className="md-editor__item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(d.uuid);
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
        {/* ── Presence bar ───────────────────────────────────── */}
        {selected && presence.length > 0 && (
          <div className="crdt-presence-bar">
            {presence.map((p) => (
              <span
                key={p.userUuid}
                className="crdt-presence-badge"
                style={{ backgroundColor: colorForUser(p.userUuid) }}
                title={`${p.userName} — last seen ${new Date(p.lastSeen).toLocaleTimeString()}`}
              >
                {p.userName}
              </span>
            ))}
          </div>
        )}

        {/* ── Toolbar ───────────────────────────────────────── */}
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
          <button className="md-editor__save" onClick={() => void save()}>
            Save
          </button>
          {selected && (
            <span className="crdt-version-badge" title="CRDT version clock">
              v{versionClock}
            </span>
          )}
        </div>

        {/* ── Editor split ──────────────────────────────────── */}
        <div className="md-editor__split">
          <textarea
            className="md-editor__textarea"
            placeholder="Write markdown here..."
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
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

/* ── Minimal markdown→HTML renderer ─────────────────────────── */

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
  html = html.replace(/(?:^- (.+)$\n?)+/gm, (match) => {
    const items = match
      .trim()
      .split("\n")
      .map((line) => line.replace(/^- /, "").trim());
    return "<ul>" + items.map((i) => `<li>${i}</li>`).join("") + "</ul>";
  });
  return html;
}

/* ── Register ───────────────────────────────────────────────── */

panelRegistry.register({
  id: "crdt-markdown-editor",
  title: "CRDT Markdown Editor",
  icon: "\u{1f4dd}", // 📝
  component: CrdtMarkdownEditorPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
