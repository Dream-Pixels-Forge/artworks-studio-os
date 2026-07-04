/**
 * Preferences panel.
 *
 * Consolidates all user settings: theme selection, API key management,
 * keyboard shortcuts, and default production. Cross-session persistence
 * backed by the settings, theme, api-keys, and shortcuts services.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { panelRegistry } from "../../workspace/registry.js";

type ArtworksApi = Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

interface ApiKeysState {
  keys: Record<string, string>;
}

interface ShortcutsState {
  shortcuts: Record<string, string>;
  defaults: Record<string, string>;
}

interface ThemeState {
  mode: string;
  resolvedTheme: string;
}

interface SettingsState {
  preferences: Record<string, string>;
}

type Tab = "general" | "api-keys" | "shortcuts" | "about";

const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI", keyPlaceholder: "sk-..." },
  { id: "anthropic", name: "Anthropic", keyPlaceholder: "sk-ant-..." },
  { id: "google", name: "Google AI", keyPlaceholder: "AIza..." },
  { id: "mistral", name: "Mistral", keyPlaceholder: "..." },
  { id: "fireworks", name: "Fireworks AI", keyPlaceholder: "fw_..." },
  { id: "deepseek", name: "DeepSeek", keyPlaceholder: "sk-..." },
  { id: "ollama", name: "Ollama (Local)", keyPlaceholder: "http://localhost:11434" },
];

const THEME_OPTIONS = [
  { value: "studio-dark", label: "Dark" },
  { value: "studio-light", label: "Light" },
  { value: "system", label: "System" },
];

function GeneralTab({ artworks, theme, settings, onThemeChange }: {
  artworks: ArtworksApi;
  theme: ThemeState | null;
  settings: SettingsState | null;
  onThemeChange: (mode: string) => void;
}): ReactElement {
  const handleDefaultProduction = useCallback(async (value: string) => {
    await artworks.settings.set("default-production", value || undefined);
    window.dispatchEvent(new CustomEvent("artworks:settings-changed"));
  }, [artworks]);

  return (
    <div style={{ padding: "16px" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600 }}>Appearance</h3>
      <label style={labelStyle}>Theme</label>
      <select
        value={theme?.mode ?? "studio-dark"}
        onChange={(e) => onThemeChange(e.target.value)}
        style={selectStyle}
      >
        {THEME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <h3 style={{ margin: "20px 0 12px", fontSize: "14px", fontWeight: 600 }}>Defaults</h3>
      <label style={labelStyle}>Default Production</label>
      <input
        type="text"
        value={settings?.preferences["default-production"] ?? ""}
        onChange={(e) => handleDefaultProduction(e.target.value)}
        placeholder="None"
        style={inputStyle}
      />
    </div>
  );
}

function ApiKeysTab({ artworks, apiKeys, onRefresh }: {
  artworks: ArtworksApi;
  apiKeys: ApiKeysState | null;
  onRefresh: () => void;
}): ReactElement {
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  const handleSave = useCallback(async () => {
    if (!editingProvider || !keyInput.trim()) return;
    await artworks["api-keys"].set(editingProvider, keyInput.trim());
    setEditingProvider(null);
    setKeyInput("");
    onRefresh();
  }, [artworks, editingProvider, keyInput, onRefresh]);

  const handleDelete = useCallback(async (provider: string) => {
    await artworks["api-keys"].delete(provider);
    onRefresh();
  }, [artworks, onRefresh]);

  return (
    <div style={{ padding: "16px" }}>
      <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--text-secondary)" }}>
        API keys are stored locally and never sent anywhere except the provider.
      </p>
      {AI_PROVIDERS.map((provider) => {
        const masked = apiKeys?.keys[provider.id];
        const isEditing = editingProvider === provider.id;
        return (
          <div key={provider.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{provider.name}</strong>
                {masked && (
                  <span style={{ marginLeft: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                    {masked}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => { setEditingProvider(provider.id); setKeyInput(""); }}
                  style={smallBtnStyle}
                >
                  {masked ? "Update" : "Add"}
                </button>
                {masked && (
                  <button onClick={() => handleDelete(provider.id)} style={{ ...smallBtnStyle, color: "var(--error)" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {isEditing && (
              <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={provider.keyPlaceholder}
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                  autoFocus
                />
                <button onClick={handleSave} style={smallBtnStyle}>Save</button>
                <button onClick={() => { setEditingProvider(null); setKeyInput(""); }} style={smallBtnStyle}>Cancel</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShortcutsTab({ artworks, shortcuts, onRefresh }: {
  artworks: ArtworksApi;
  shortcuts: ShortcutsState | null;
  onRefresh: () => void;
}): ReactElement {
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [accelInput, setAccelInput] = useState("");

  const handleSave = useCallback(async () => {
    if (!editingAction || !accelInput.trim()) return;
    await artworks.shortcuts.set(editingAction, accelInput.trim());
    setEditingAction(null);
    setAccelInput("");
    onRefresh();
  }, [artworks, editingAction, accelInput, onRefresh]);

  const handleReset = useCallback(async (actionId: string) => {
    await artworks.shortcuts["reset-action"](actionId);
    onRefresh();
  }, [artworks, onRefresh]);

  const handleResetAll = useCallback(async () => {
    await artworks.shortcuts["reset-all"]();
    onRefresh();
  }, [artworks, onRefresh]);

  if (!shortcuts) return <div style={{ padding: "16px" }}>Loading...</div>;

  const allActions = Object.entries(shortcuts.defaults);

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
          Click a shortcut to customize it. Use Electron accelerator syntax (e.g. CmdOrCtrl+Shift+P).
        </p>
        <button onClick={handleResetAll} style={smallBtnStyle}>Reset All</button>
      </div>
      {allActions.map(([actionId, defaultAccel]) => {
        const current = shortcuts.shortcuts[actionId] ?? defaultAccel;
        const isEditing = editingAction === actionId;
        const isCustom = actionId in shortcuts.shortcuts;
        return (
          <div key={actionId} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ textTransform: "capitalize" }}>{actionId.replace(/-/g, " ")}</strong>
                {isCustom && (
                  <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--accent)" }}>(custom)</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={accelInput}
                      onChange={(e) => setAccelInput(e.target.value)}
                      style={{ ...inputStyle, width: "160px" }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                      autoFocus
                    />
                    <button onClick={handleSave} style={smallBtnStyle}>Save</button>
                    <button onClick={() => setEditingAction(null)} style={smallBtnStyle}>Cancel</button>
                  </>
                ) : (
                  <>
                    <kbd style={kbdStyle}>{current}</kbd>
                    <button
                      onClick={() => { setEditingAction(actionId); setAccelInput(current); }}
                      style={smallBtnStyle}
                    >
                      Edit
                    </button>
                    {isCustom && (
                      <button onClick={() => handleReset(actionId)} style={smallBtnStyle}>Reset</button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AboutTab(): ReactElement {
  return (
    <div style={{ padding: "16px", textAlign: "center" }}>
      <h2 style={{ margin: "0 0 8px" }}>Artworks Studio OS</h2>
      <p style={{ color: "var(--text-secondary)", margin: "0 0 4px" }}>Version 1.0.0</p>
      <p style={{ color: "var(--text-secondary)", margin: "0 0 16px", fontSize: "13px" }}>
        The operating system for AI-native filmmaking.
      </p>
      <p style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>
        Electron • React • SQLite • TypeScript
      </p>
    </div>
  );
}

function PreferencesPanel(): ReactElement {
  const artworks = window.artworks as unknown as ArtworksApi;
  const [tab, setTab] = useState<Tab>("general");
  const [theme, setTheme] = useState<ThemeState | null>(null);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeysState | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutsState | null>(null);

  const refreshAll = useCallback(async () => {
    const [t, s, k, sc] = await Promise.all([
      artworks.theme.get() as Promise<ThemeState>,
      artworks.settings.get() as Promise<SettingsState>,
      artworks["api-keys"].get() as Promise<ApiKeysState>,
      artworks.shortcuts.get() as Promise<ShortcutsState>,
    ]);
    setTheme(t);
    setSettings(s);
    setApiKeys(k);
    setShortcuts(sc);
  }, [artworks]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const handleThemeChange = useCallback(async (mode: string) => {
    await artworks.theme.set(mode);
    refreshAll();
  }, [artworks, refreshAll]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "api-keys", label: "API Keys" },
    { id: "shortcuts", label: "Shortcuts" },
    { id: "about", label: "About" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ borderBottom: "1px solid var(--border)", display: "flex", padding: "0 12px" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 12px",
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "general" && (
          <GeneralTab artworks={artworks} theme={theme} settings={settings} onThemeChange={handleThemeChange} />
        )}
        {tab === "api-keys" && (
          <ApiKeysTab artworks={artworks} apiKeys={apiKeys} onRefresh={refreshAll} />
        )}
        {tab === "shortcuts" && (
          <ShortcutsTab artworks={artworks} shortcuts={shortcuts} onRefresh={refreshAll} />
        )}
        {tab === "about" && <AboutTab />}
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = { display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" };
const inputStyle: CSSProperties = { width: "100%", padding: "6px 8px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)", fontSize: "13px", boxSizing: "border-box" };
const selectStyle: CSSProperties = { ...inputStyle, width: "auto" };
const cardStyle: CSSProperties = { padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: "6px", marginBottom: "8px", border: "1px solid var(--border)" };
const smallBtnStyle: CSSProperties = { padding: "4px 8px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)", cursor: "pointer", fontSize: "12px" };
const kbdStyle: CSSProperties = { padding: "2px 6px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "3px", fontFamily: "monospace", fontSize: "12px" };

panelRegistry.register({
  id: "preferences",
  title: "Preferences",
  icon: "⚙️",
  component: PreferencesPanel,
  defaultSlot: "center",
  defaultVisible: false,
});
