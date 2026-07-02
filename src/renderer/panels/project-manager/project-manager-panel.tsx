/**
 * Project Manager panel.
 *
 * Lists productions from the database, lets the user create and delete
 * them. Uses the production IPC bridge to talk to the main process.
 */
import { useEffect, useState, type FormEvent } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Project {
  uuid: string;
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  description: string;
}

export function ProjectManagerPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const list = await window.artworks.production.project.list();
    setProjects(list as Project[]);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await window.artworks.production.project.create({ name, description: desc || undefined });
    setName("");
    setDesc("");
    await refresh();
  }

  async function remove(uuid: string) {
    await window.artworks.production.project.delete(uuid);
    await refresh();
  }

  return (
    <div className="project-manager">
      <h2 className="project-manager__title">Projects</h2>
      <form className="project-manager__form" onSubmit={create}>
        <input
          className="project-manager__input"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="project-manager__input"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <button className="project-manager__btn" type="submit">
          Create
        </button>
      </form>
      <ul className="project-manager__list">
        {projects.length === 0 && (
          <p className="project-manager__empty">No projects yet.</p>
        )}
        {projects.map((p) => (
          <li key={p.uuid} className="project-manager__item">
            <div className="project-manager__item-info">
              <span className="project-manager__item-name">{p.name}</span>
              <span className="project-manager__item-id">{p.id}</span>
              <span className="project-manager__item-status">{p.status}</span>
            </div>
            {p.description && (
              <span className="project-manager__item-desc">{p.description}</span>
            )}
            <button
              className="project-manager__delete"
              onClick={() => remove(p.uuid)}
              title="Delete"
            >
              {"\u00d7"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

panelRegistry.register({
  id: "project-manager",
  title: "Projects",
  icon: "\u{1f3ac}", // 🎬
  component: ProjectManagerPanel,
  defaultSlot: "left",
  defaultVisible: false,
});