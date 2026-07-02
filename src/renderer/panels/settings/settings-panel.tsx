/**
 * Settings panel.
 *
 * A modal overlay for user preferences. Sections:
 * - Appearance: theme picker (reuses the ThemeProvider, so a change applies
 *   instantly and persists — no separate wiring).
 * - Studio: the studio home location (read-only; owned by the `aw` CLI and
 *   the AW_HOME env var) and the default production (a dropdown populated
 *   from the explorer; sets the active-production pointer on change).
 *
 * Every value traces back to a design token; no hardcoded colors/sizes.
 */
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTheme } from "../../ui/theme-provider.js";
import type { ProductionSummary } from "@shared/production-explorer/types.js";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

type ThemeMode = "studio-dark" | "studio-light" | "system";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "studio-dark", label: "Studio Dark" },
  { value: "studio-light", label: "Studio Light" },
  { value: "system", label: "Follow System" },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { mode, setMode } = useTheme();
  const [home, setHome] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [productions, setProductions] = useState<ProductionSummary[]>([]);
  const [defaultProduction, setDefaultProduction] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Load studio status + preferences + productions on open.
  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      const [status, prefs, list] = await Promise.all([
        window.artworks.studio.status(),
        window.artworks.settings.get(),
        window.artworks.explorer.listProductions(),
      ]);
      if (!active) return;
      setHome(status.home);
      setInitialized(status.initialized);
      setProductions((list as ProductionSummary[]) ?? []);
      setDefaultProduction(prefs.preferences["default-production"]);
    })();
    return () => {
      active = false;
    };
  }, [open]);

  // Esc closes the overlay (keyboard parity with the command palette).
  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  async function changeDefaultProduction(name: string) {
    setSaving(true);
    try {
      // The "default production" is the active-production pointer, shared with
      // the `aw` CLI — setting it both opens the production and remembers it.
      if (name) await window.artworks.explorer.open(name);
      const prefs = await window.artworks.settings.set("default-production", name || undefined);
      setDefaultProduction(prefs.preferences["default-production"]);
    } finally {
      setSaving(false);
    }
  }

  async function resetPreferences() {
    setSaving(true);
    try {
      const prefs = await window.artworks.settings.reset();
      setDefaultProduction(prefs.preferences["default-production"]);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="settings__overlay"
      onClick={onClose}
      onKeyDown={onKeyDown}
      role="presentation"
    >
      <div
        className="settings__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings__header">
          <h2 className="settings__title">Settings</h2>
          <button type="button" className="settings__close" aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="settings__body">
          <section className="settings__section">
            <h3 className="settings__section-title">Appearance</h3>
            <div className="settings__row">
              <label className="settings__label" htmlFor="settings-theme">
                Theme
              </label>
              <select
                id="settings-theme"
                className="settings__select"
                value={mode}
                onChange={(e) => void setMode(e.target.value as ThemeMode)}
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="settings__section">
            <h3 className="settings__section-title">Studio</h3>
            <div className="settings__row">
              <span className="settings__label">Studio home</span>
              <code className="settings__value">{home ?? "—"}</code>
            </div>
            {initialized === false && (
              <p className="settings__hint">
                Studio not initialized. Run <code>aw studio init</code> in your studio home.
              </p>
            )}
            <div className="settings__row">
              <label className="settings__label" htmlFor="settings-default-production">
                Default production
              </label>
              <select
                id="settings-default-production"
                className="settings__select"
                value={defaultProduction ?? ""}
                disabled={saving || productions.length === 0}
                onChange={(e) => void changeDefaultProduction(e.target.value)}
              >
                <option value="">None</option>
                {productions.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {productions.length === 0 && (
              <p className="settings__hint">
                No productions found. Run <code>aw project new &lt;name&gt;</code>.
              </p>
            )}
          </section>
        </div>

        <footer className="settings__footer">
          <button
            type="button"
            className="settings__btn settings__btn--ghost"
            onClick={() => void resetPreferences()}
            disabled={saving}
          >
            Reset to defaults
          </button>
          <button type="button" className="settings__btn settings__btn--primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
