/**
 * AI Chat panel (Phase 4 + Phase 19).
 *
 * Conversation UI with live AI completions. Select a model, send messages,
 * and receive responses from the configured provider.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface Message { role: "system" | "user" | "assistant"; content: string }
interface Conversation { uuid: string; id: string; name: string; messages: Message[]; provider?: string; model?: string }
interface ModelInfo { id: string; provider: string; displayName: string; maxTokens: number; supportsStreaming: boolean; supportsImages: boolean; costPer1kInput: number; costPer1kOutput: number }

export function AIChatPanel() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(true);
  const [streamText, setStreamText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const unsubStreamRef = useRef<(() => void) | null>(null);
  /** Cancels the in-flight AI stream on the main process (stops the fetch). */
  const cancelStreamRef = useRef<(() => Promise<boolean>) | null>(null);
  const defaultModelSet = useRef(false);

  const load = useCallback(async () => {
    setConvs((await window.artworks.production.conversation.list()) as Conversation[]);
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const m = await window.artworks.ai.listModels();
      setModels(m);
      if (m.length > 0 && !defaultModelSet.current) {
        setSelectedModel(m[0].id);
        defaultModelSet.current = true;
      }
    } catch {
      // Models not available yet
    }
  }, []);

  useEffect(() => { load(); loadModels(); }, [load, loadModels]);
  // Cleanup streaming subscription on unmount — also cancel the main-side
  // fetch so it doesn't keep consuming tokens after the panel is gone.
  useEffect(() => () => {
    cancelStreamRef.current?.();
    unsubStreamRef.current?.();
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages, streamText]);

  async function create() {
    if (!name.trim()) return;
    const model = models.find((m) => m.id === selectedModel);
    const c = await window.artworks.production.conversation.create({
      name,
      messages: [],
      model: selectedModel,
      provider: model?.provider,
    });
    await load();
    setActive(c as Conversation);
    setName("");
  }

  async function send() {
    if (!active || !input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    await window.artworks.production.conversation.addMessage(active.uuid, userMsg);

    // Refresh conversation to get updated messages
    const updated = await window.artworks.production.conversation.get(active.uuid);
    setActive(updated as Conversation);
    setInput("");
    setLoading(true);
    setError(null);
    setLastUsage(null);
    setStreamText("");

    let streamingActive = false;

    try {
      // Build message history for the AI
      const messages = (updated as Conversation).messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (streaming) {
        // Cancel any still-running stream before starting a new one — otherwise
        // switching conversations mid-stream leaves the old fetch running on the
        // main process (token burn + the orphaned chunks arrive with a stale id
        // and are silently dropped).
        cancelStreamRef.current?.();
        unsubStreamRef.current?.();
        cancelStreamRef.current = null;
        unsubStreamRef.current = null;
        streamingActive = true;
        // Streaming mode: receive chunks in real-time
        // Note: setLoading(false) is handled by the "done" chunk handler below,
        // not in the finally block, because subscribe() returns immediately
        // while the stream is still active.
        const sub = window.artworks.ai.stream(messages, {
          model: active.model || selectedModel,
          temperature: 0.7,
          maxTokens: 2048,
        });
        // Store unsubscribe so it can be cleaned up on unmount / conversation switch
        cancelStreamRef.current = () => sub.cancel();
        unsubStreamRef.current = sub.subscribe((chunk) => {
          if (chunk.type === "text" && chunk.text) {
            setStreamText((prev) => prev + chunk.text);
          } else if (chunk.type === "done") {
            // Streaming complete — persist the full response and end loading
            setLoading(false);
            setStreamText((finalText) => {
              if (finalText) {
                const assistantMsg: Message = { role: "assistant", content: finalText };
                window.artworks.production.conversation.addMessage(active.uuid, assistantMsg).then(() =>
                  window.artworks.production.conversation.get(active.uuid).then((conv) => setActive(conv as Conversation)),
                );
              }
              return finalText;
            });
            if (chunk.usage) setLastUsage(chunk.usage);
            // Clean up streaming subscription
            unsubStreamRef.current?.();
            unsubStreamRef.current = null;
            cancelStreamRef.current = null;
          } else if (chunk.type === "error") {
            setError(chunk.error ?? "Stream failed");
            setLoading(false);
            unsubStreamRef.current?.();
            unsubStreamRef.current = null;
            cancelStreamRef.current = null;
          }
        });
        // Subscription will be cleaned up on unmount or conversation switch via unsubStreamRef
      } else {
        // Non-streaming mode: wait for complete response
        const result = await window.artworks.ai.complete(messages, {
          model: active.model || selectedModel,
          temperature: 0.7,
          maxTokens: 2048,
        });

        const assistantMsg: Message = { role: "assistant", content: result.content };
        await window.artworks.production.conversation.addMessage(active.uuid, assistantMsg);

        const final = await window.artworks.production.conversation.get(active.uuid);
        setActive(final as Conversation);
        setLastUsage(result.usage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI response");
    } finally {
      // In streaming mode, loading is managed by the done/error chunk handlers
      if (!streamingActive) {
        setLoading(false);
      }
    }
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
            <li key={c.uuid} className={`ai-chat__conv${active?.uuid === c.uuid ? " ai-chat__conv--active" : ""}`} onClick={() => { unsubStreamRef.current?.(); unsubStreamRef.current = null; setActive(c); setError(null); setLastUsage(null); }}>
              <span>{c.name}</span>
              <button onClick={(e) => { e.stopPropagation(); remove(c.uuid); }}>{"\u00d7"}</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="ai-chat__main">
        {active ? (
          <>
            <div className="ai-chat__toolbar">
              <label className="ai-chat__toolbar-label">Model:</label>
              <select
                className="ai-chat__model-select"
                value={active.model || selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  // Also update conversation's model if it has one
                  if (active.model) {
                    setActive({ ...active, model: e.target.value });
                  }
                }}
              >
                {models.length === 0 && <option value="">No models available</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.provider}) — {m.costPer1kInput > 0 ? `$${m.costPer1kInput.toFixed(4)}/1k in` : "free"}
                  </option>
                ))}
              </select>
              <button
                className={`ai-chat__stream-toggle${streaming ? " ai-chat__stream-toggle--active" : ""}`}
                onClick={() => setStreaming(!streaming)}
                title={streaming ? "Streaming enabled" : "Streaming disabled"}
              >
                {streaming ? "Stream: On" : "Stream: Off"}
              </button>
              {lastUsage && (
                <span className="ai-chat__usage">
                  {lastUsage.totalTokens} tokens ({lastUsage.promptTokens} in / {lastUsage.completionTokens} out)
                </span>
              )}
            </div>
            <div className="ai-chat__thread">
              {active.messages.map((m, i) => (
                <div key={i} className={`ai-chat__msg ai-chat__msg--${m.role}`}>
                  <span className="ai-chat__msg-role">{m.role}</span>
                  <p className="ai-chat__msg-content">{m.content}</p>
                </div>
              ))}
              {loading && (
                <div className="ai-chat__msg ai-chat__msg--assistant ai-chat__msg--loading">
                  <span className="ai-chat__msg-role">assistant</span>
                  <p className="ai-chat__msg-content">
                    {streaming && streamText ? streamText : "Thinking..."}
                  </p>
                </div>
              )}
              {error && (
                <div className="ai-chat__error">{error}</div>
              )}
              <div ref={endRef} />
            </div>
            <div className="ai-chat__input-bar">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={loading ? "Waiting for response..." : "Type a message..."}
                disabled={loading}
              />
              <button onClick={send} disabled={loading || !input.trim()}>
                {loading ? "..." : "Send"}
              </button>
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
