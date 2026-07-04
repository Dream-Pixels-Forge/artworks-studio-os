/**
 * WorkspaceBar — the named-workspace switcher strip (#5).
 *
 * Sits above the docking surface. Shows one chip per saved workspace
 * (built-in presets + custom), highlights the active one, and offers a
 * "save current arrangement as a new workspace" action. Clicking a chip
 * swaps the active workspace; the parent re-renders the layout from it.
 */
import { useEffect, useState } from "react";
import type { Workspace } from "./types.js";

export interface WorkspaceBarProps {
  workspaces: Workspace[];
  activeId: string | null;
  /** Switch to a workspace by id. */
  onSelect: (id: string) => void;
  /** Save the current layout tree as a new named workspace. */
  onSaveAs: (name: string) => void;
}

export function WorkspaceBar({ workspaces, activeId, onSelect, onSaveAs }: WorkspaceBarProps) {
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");

  // Open the inline save-as input when the command palette asks.
  useEffect(() => {
    const handler = (): void => setSaving(true);
    window.addEventListener("artworks:workspace-save-as", handler);
    return () => window.removeEventListener("artworks:workspace-save-as", handler);
  }, []);

  const submitSave = () => {
    const name = draftName.trim();
    if (name) {
      onSaveAs(name);
      setDraftName("");
      setSaving(false);
    }
  };

  return (
    <div className="workspace-bar" role="tablist" aria-label="Workspaces">
      {workspaces.map((w) => (
        <button
          key={w.id}
          role="tab"
          aria-selected={w.id === activeId}
          className={`workspace-bar__chip ${w.id === activeId ? "workspace-bar__chip--active" : ""}`}
          onClick={() => onSelect(w.id)}
          title={w.builtin ? `Built-in: ${w.name}` : w.name}
        >
          {w.name}
        </button>
      ))}

      {saving ? (
        <div className="workspace-bar__save">
          <input
            className="workspace-bar__input"
            autoFocus
            value={draftName}
            placeholder="Workspace name…"
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitSave();
              if (e.key === "Escape") {
                setSaving(false);
                setDraftName("");
              }
            }}
            onBlur={() => {
              if (!draftName.trim()) setSaving(false);
            }}
          />
          <button className="workspace-bar__save-btn" onClick={submitSave} disabled={!draftName.trim()}>
            Save
          </button>
        </div>
      ) : (
        <button className="workspace-bar__add" onClick={() => setSaving(true)} title="Save current layout as a workspace">
          + Save as…
        </button>
      )}
    </div>
  );
}
