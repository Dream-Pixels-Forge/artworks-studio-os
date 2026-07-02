/**
 * Workflow Builder panel (Phase 8).
 *
 * Create and edit workflow definitions. A workflow is a named pipeline
 * of steps. This panel lets users add, remove, and reorder steps.
 */
import { useEffect, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface WorkflowStep { id: string; name: string; type: string; params?: Record<string, unknown> }
interface Workflow { uuid: string; name: string; definition: { steps: WorkflowStep[] }; state: string }

export function WorkflowBuilderPanel() {
  const [wfs, setWfs] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => { load(); }, []);

  async function load() { setWfs((await window.artworks.production.workflow.list()) as Workflow[]); }

  function open(wf: Workflow) { setSelected(wf); setSteps(wf.definition.steps); }

  async function create() {
    const wf = await window.artworks.production.workflow.create({ name: `Workflow ${wfs.length + 1}` });
    await load(); open(wf as Workflow);
  }

  async function save() {
    if (!selected) return;
    await window.artworks.production.workflow.updateDefinition(selected.uuid, { steps });
    await load();
  }

  function addStep() {
    setSteps([...steps, { id: crypto.randomUUID(), name: `Step ${steps.length + 1}`, type: "action" }]);
  }

  function removeStep(id: string) { setSteps(steps.filter((s) => s.id !== id)); }

  async function run(uuid: string) {
    await window.artworks.production.workflow.updateState(uuid, "running");
    await load();
  }

  async function remove(uuid: string) {
    await window.artworks.production.workflow.delete(uuid);
    if (selected?.uuid === uuid) setSelected(null);
    await load();
  }

  return (
    <div className="wf-builder">
      <div className="wf-builder__sidebar">
        <h2 className="wf-builder__title">Workflows</h2>
        <button className="wf-builder__new" onClick={create}>+ New Workflow</button>
        <ul className="wf-builder__list">
          {wfs.map((w) => (
            <li key={w.uuid} className={`wf-builder__item${selected?.uuid === w.uuid ? " wf-builder__item--active" : ""}`} onClick={() => open(w)}>
              <span className="wf-builder__item-name">{w.name}</span>
              <span className="wf-builder__item-state">{w.state}</span>
              <button onClick={(e) => { e.stopPropagation(); remove(w.uuid); }}>{"\u00d7"}</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="wf-builder__main">
        {selected ? (
          <>
            <div className="wf-builder__toolbar">
              <h3>{selected.name}</h3>
              <button onClick={() => run(selected.uuid)}>Run</button>
              <button onClick={save}>Save</button>
              <button onClick={addStep}>+ Step</button>
            </div>
            <ul className="wf-builder__steps">
              {steps.map((s, i) => (
                <li key={s.id} className="wf-builder__step">
                  <span className="wf-builder__step-num">{i + 1}</span>
                  <input value={s.name} onChange={(e) => setSteps(steps.map((st) => st.id === s.id ? { ...st, name: e.target.value } : st))} />
                  <select value={s.type} onChange={(e) => setSteps(steps.map((st) => st.id === s.id ? { ...st, type: e.target.value } : st))}>
                    <option value="action">Action</option>
                    <option value="generate">Generate</option>
                    <option value="validate">Validate</option>
                    <option value="document">Document</option>
                    <option value="export">Export</option>
                  </select>
                  <button onClick={() => removeStep(s.id)}>{"\u00d7"}</button>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="wf-builder__empty">Select or create a workflow.</p>}
      </div>
    </div>
  );
}

panelRegistry.register({ id: "workflow-builder", title: "Workflows", icon: "\u2699", component: WorkflowBuilderPanel, defaultSlot: "center", defaultVisible: false });