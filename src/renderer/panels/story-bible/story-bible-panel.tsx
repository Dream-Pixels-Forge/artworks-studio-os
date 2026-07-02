/**
 * Story Bible panel (Phase 5).
 *
 * A specialized markdown editor for production bibles. Creates documents
 * with story-specific doc types. Reuses the markdown document IPC.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Doc { uuid: string; name: string; docType: string; content: string }

const BIBLE_TYPES = ["story-bible", "character-bible", "environment-bible", "prop-bible", "production-bible"];

export function StoryBiblePanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [content, setContent] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const all = await window.artworks.production.document.list();
    const bibles = (all as Doc[]).filter((d) => BIBLE_TYPES.includes(d.docType));
    setDocs(bibles);
  }

  async function create(type: string) {
    const d = await window.artworks.production.document.create({ name: `New ${type}`, docType: type, content: "" });
    await load(); setSelected(d as Doc); setContent("");
  }

  async function save() {
    if (!selected) return;
    await window.artworks.production.document.update({ ...selected, content });
    await load();
  }

  return (
    <div className="story-bible">
      <div className="story-bible__sidebar">
        <h2 className="story-bible__title">Bibles</h2>
        <div className="story-bible__create-row">
          {BIBLE_TYPES.map((t) => (
            <button key={t} className="story-bible__create-btn" onClick={() => create(t)}>+ {t.replace("-bible", "")}</button>
          ))}
        </div>
        <ul className="story-bible__list">
          {docs.map((d) => (
            <li key={d.uuid} className={`story-bible__item${selected?.uuid === d.uuid ? " story-bible__item--active" : ""}`}
              onClick={() => { setSelected(d); setContent(d.content); }}>
              <span className="story-bible__item-name">{d.name}</span>
              <span className="story-bible__item-type">{d.docType}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="story-bible__editor">
        {selected ? (
          <>
            <h3 className="story-bible__editor-title">{selected.name}</h3>
            <textarea className="story-bible__textarea" value={content}
              onChange={(e) => setContent(e.target.value)} spellCheck={false} />
            <button className="story-bible__save" onClick={save}>Save</button>
          </>
        ) : <p className="story-bible__empty">Select or create a bible.</p>}
      </div>
    </div>
  );
}

panelRegistry.register({ id: "story-bible", title: "Story Bible", icon: "\u{1f4d6}", component: StoryBiblePanel, defaultSlot: "center", defaultVisible: false });