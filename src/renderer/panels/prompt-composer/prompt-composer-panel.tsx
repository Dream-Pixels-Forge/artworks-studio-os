/**
 * Prompt Composer panel (Phase 6).
 *
 * Create, edit, and render prompt templates with {{variable}} substitution.
 * Provider/model targeting. Lists all saved prompts.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Prompt { uuid: string; name: string; provider?: string; model?: string; template: string }

export function PromptComposerPanel() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selected, setSelected] = useState<Prompt | null>(null);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [template, setTemplate] = useState("");
  const [vars, setVars] = useState("");
  const [rendered, setRendered] = useState("");

  useEffect(() => { load(); }, []);

  async function load() { setPrompts((await window.artworks.production.prompt.list()) as Prompt[]); }

  function open(p: Prompt) {
    setSelected(p); setName(p.name); setProvider(p.provider ?? "openai"); setModel(p.model ?? "gpt-4o"); setTemplate(p.template);
  }

  async function save() {
    if (!name.trim() || !template.trim()) return;
    if (selected) {
      await window.artworks.production.prompt.update({ ...selected, name, provider, model, template });
    } else {
      await window.artworks.production.prompt.create({ name, provider, model, template });
    }
    await load();
  }

  async function render() {
    const varsMap: Record<string, string> = {};
    vars.split("\n").forEach((line) => {
      const [k, v] = line.split("=");
      if (k && v !== undefined) varsMap[k.trim()] = v.trim();
    });
    const r = await window.artworks.production.prompt.render(template, varsMap);
    setRendered(r as string);
  }

  async function remove(uuid: string) {
    await window.artworks.production.prompt.delete(uuid);
    if (selected?.uuid === uuid) setSelected(null);
    await load();
  }

  return (
    <div className="prompt-composer">
      <div className="prompt-composer__sidebar">
        <h2 className="prompt-composer__title">Prompts</h2>
        <button className="prompt-composer__new" onClick={() => { setSelected(null); setName(""); setTemplate(""); }}>+ New</button>
        <ul className="prompt-composer__list">
          {prompts.map((p) => (
            <li key={p.uuid} className={`prompt-composer__item${selected?.uuid === p.uuid ? " prompt-composer__item--active" : ""}`}
              onClick={() => open(p)}>
              <span className="prompt-composer__item-name">{p.name}</span>
              <span className="prompt-composer__item-model">{p.provider}/{p.model ?? "?"}</span>
              <button onClick={(e) => { e.stopPropagation(); remove(p.uuid); }}>{"\u00d7"}</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="prompt-composer__main">
        <div className="prompt-composer__toolbar">
          <input placeholder="Prompt name" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="ollama">Ollama</option>
          </select>
          <input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
          <button onClick={save}>Save</button>
        </div>
        <div className="prompt-composer__editor">
          <textarea className="prompt-composer__template" placeholder="Write template with {{variables}}..."
            value={template} onChange={(e) => setTemplate(e.target.value)} spellCheck={false} />
          <div className="prompt-composer__render-section">
            <h4 className="prompt-composer__render-title">Variables (one per line, key=value)</h4>
            <textarea className="prompt-composer__vars" placeholder="character=Ama
scene=kitchen" value={vars}
              onChange={(e) => setVars(e.target.value)} spellCheck={false} />
            <button className="prompt-composer__render-btn" onClick={render}>Render</button>
            {rendered && (
              <div className="prompt-composer__output">
                <h4>Rendered Output</h4>
                <pre>{rendered}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

panelRegistry.register({ id: "prompt-composer", title: "Prompt Composer", icon: "\u{2728}", component: PromptComposerPanel, defaultSlot: "center", defaultVisible: false });