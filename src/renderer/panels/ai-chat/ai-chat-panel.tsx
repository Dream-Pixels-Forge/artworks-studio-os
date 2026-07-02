/**
 * AI Chat panel (Phase 4).
 *
 * Conversation UI: list of conversations on the left, message thread +
 * input on the right. Messages are stored via the conversation IPC.
 */
import { useEffect, useRef, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Message { role: "system" | "user" | "assistant"; content: string }
interface Conversation { uuid: string; id: string; name: string; messages: Message[]; provider?: string; model?: string }

export function AIChatPanel() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages]);

  async function load() { setConvs((await window.artworks.production.conversation.list()) as Conversation[]); }

  async function create() {
    if (!name.trim()) return;
    const c = await window.artworks.production.conversation.create({ name, messages: [] });
    await load(); setActive(c as Conversation); setName("");
  }

  async function send() {
    if (!active || !input.trim()) return;
    const msg: Message = { role: "user", content: input };
    await window.artworks.production.conversation.addMessage(active.uuid, msg);
    const updated = await window.artworks.production.conversation.get(active.uuid);
    setActive(updated as Conversation); setInput("");
  }

  async function remove(uuid: string) {
    await window.artworks.production.conversation.delete(uuid);
    if (active?.uuid === uuid) setActive(null);
    await load();
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat__sidebar">
        <h2 className="ai-chat__title">Conversations</h2>
        <div className="ai-chat__create">
          <input placeholder="New conversation..." value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={create}>+</button>
        </div>
        <ul className="ai-chat__list">
          {convs.map((c) => (
            <li key={c.uuid} className={`ai-chat__conv${active?.uuid === c.uuid ? " ai-chat__conv--active" : ""}`} onClick={() => setActive(c)}>
              <span>{c.name}</span>
              <button onClick={(e) => { e.stopPropagation(); remove(c.uuid); }}>{"\u00d7"}</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="ai-chat__main">
        {active ? (
          <>
            <div className="ai-chat__thread">
              {active.messages.map((m, i) => (
                <div key={i} className={`ai-chat__msg ai-chat__msg--${m.role}`}>
                  <span className="ai-chat__msg-role">{m.role}</span>
                  <p className="ai-chat__msg-content">{m.content}</p>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="ai-chat__input-bar">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Type a message..." />
              <button onClick={send}>Send</button>
            </div>
          </>
        ) : (
          <p className="ai-chat__empty">Select or create a conversation.</p>
        )}
      </div>
    </div>
  );
}

panelRegistry.register({ id: "ai-chat", title: "AI Chat", icon: "\u{1f4ac}", component: AIChatPanel, defaultSlot: "center", defaultVisible: false });