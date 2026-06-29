/**
 * Project Explorer panel.
 *
 * Lists productions in the studio home, lets the user open one (sets it
 * active), and renders its directory tree. Detects an uninitialized studio
 * and shows an affordance rather than an empty list.
 */
import { useEffect, useState } from "react";
import type {
  ProductionSummary,
  TreeNode,
} from "@shared/production-explorer/types.js";
import { TreeNodeView } from "./tree-node.js";

export function ProjectExplorerPanel() {
  const [productions, setProductions] = useState<ProductionSummary[]>([]);
  const [active, setActive] = useState<ProductionSummary | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>();

  // Load productions on mount.
  useEffect(() => {
    void refresh();
  }, []);

  // Load the active production's tree when it changes.
  useEffect(() => {
    if (!active) {
      setTree(null);
      return;
    }
    void window.artworks.explorer.tree(active.name).then((node) => setTree(node as TreeNode));
  }, [active]);

  async function refresh() {
    setLoading(true);
    const [list, act] = await Promise.all([
      window.artworks.explorer.listProductions(),
      window.artworks.explorer.getActive(),
    ]);
    setProductions(list as ProductionSummary[]);
    setActive(act as ProductionSummary | null);
    setLoading(false);
  }

  async function openProduction(name: string) {
    await window.artworks.explorer.open(name);
    await refresh();
  }

  if (loading) return <aside className="project-explorer">Loading…</aside>;

  return (
    <aside className="project-explorer" aria-label="Project Explorer">
      <header className="project-explorer__header">
        <h2 className="project-explorer__title">Productions</h2>
      </header>

      {productions.length === 0 ? (
        <p className="project-explorer__hint">
          No productions found. Run <code>aw studio init</code> then{" "}
          <code>aw project new &lt;name&gt;</code>.
        </p>
      ) : (
        <ul className="project-explorer__productions">
          {productions.map((p) => (
            <li
              key={p.name}
              className={`project-explorer__production${
                active?.name === p.name ? " project-explorer__production--active" : ""
              }`}
              onClick={() => openProduction(p.name)}
              role="button"
              tabIndex={0}
            >
              <span>{p.name}</span>
              {p.isActive && <span className="project-explorer__badge">active</span>}
            </li>
          ))}
        </ul>
      )}

      {tree && (
        <div className="project-explorer__tree-container">
          <h3 className="project-explorer__subtitle">{active?.name}</h3>
          <ul className="project-explorer__tree" role="tree">
            <TreeNodeView
              node={tree}
              depth={0}
              onSelect={(node) => setSelected(node.path)}
              selectedPath={selected}
            />
          </ul>
        </div>
      )}
    </aside>
  );
}
