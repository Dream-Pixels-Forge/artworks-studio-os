/**
 * Plugin Manager panel.
 *
 * Lists installed plugins with enable/disable toggles and uninstall buttons.
 * Includes install-from-file button and a detail view for commands/permissions.
 * Follows the same panel pattern as workflow-builder-panel — functional
 * component with internal state, side-effect-free rendering.
 */
import { useState, useEffect, useCallback } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface PluginCommand {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
}

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  permissions: string[];
  commands?: PluginCommand[];
}

interface PluginRecord {
  uuid: string;
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  enabled: boolean;
  manifest: PluginManifest;
}

const CATEGORY_COLORS: Record<string, string> = {
  production: "#8B5CF6",
  ai: "#F59E0B",
  integration: "#10B981",
  workflow: "#3B82F6",
  ui: "#EC4899",
  utility: "#6B7280",
};

export function PluginManagerPanel() {
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginRecord | null>(null);

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      const list = await window.artworks.plugin.list();
      setPlugins(list as PluginRecord[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const togglePlugin = useCallback(
    async (uuid: string, currentEnabled: boolean) => {
      try {
        if (currentEnabled) {
          await window.artworks.plugin.disable(uuid);
        } else {
          await window.artworks.plugin.enable(uuid);
        }
        await loadPlugins();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to toggle plugin",
        );
      }
    },
    [loadPlugins],
  );

  const uninstallPlugin = useCallback(
    async (uuid: string, name: string) => {
      if (!window.confirm(`Uninstall plugin "${name}"?`)) return;
      try {
        await window.artworks.plugin.uninstall(uuid);
        await loadPlugins();
        if (selectedPlugin?.uuid === uuid) setSelectedPlugin(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to uninstall plugin",
        );
      }
    },
    [loadPlugins, selectedPlugin],
  );

  const installFromFile = useCallback(async () => {
    try {
      const result = await window.artworks.dialog.openFile({
        filters: [{ name: "Plugins", extensions: ["zip", "tar", "tgz"] }],
      });
      if (result.canceled || !result.filePaths?.length) return;
      const filePath = result.filePaths[0];
      await window.artworks.plugin.installFromFile(filePath);
      await loadPlugins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to install plugin",
      );
    }
  }, [loadPlugins]);

  if (loading) {
    return (
      <div className="plugin-manager">
        <p style={{ color: "var(--text-secondary)" }}>Loading plugins...</p>
      </div>
    );
  }

  // Detail view for selected plugin.
  if (selectedPlugin) {
    const manifest = selectedPlugin.manifest;
    return (
      <div className="plugin-manager">
        <div className="plugin-manager__header">
          <button
            onClick={() => setSelectedPlugin(null)}
            className="plugin-detail__back"
          >
            Back to list
          </button>
          <h2 className="plugin-manager__title">{manifest.name}</h2>
          <span className="plugin-card__version">v{manifest.version}</span>
        </div>

        <div className="plugin-detail">
          <p className="plugin-detail__desc">{manifest.description}</p>
          <p className="plugin-detail__meta">by {manifest.author}</p>

          {manifest.permissions?.length > 0 && (
            <div className="plugin-detail__section">
              <h3>Permissions</h3>
              <ul className="plugin-detail__permissions">
                {manifest.permissions.map((perm) => (
                  <li key={perm} className="plugin-detail__permission">{perm}</li>
                ))}
              </ul>
            </div>
          )}

          {manifest.commands?.length ? (
            <div className="plugin-detail__section">
              <h3>Commands</h3>
              <ul className="plugin-detail__commands">
                {manifest.commands.map((cmd) => (
                  <li key={cmd.id} className="plugin-detail__command">
                    <span className="plugin-detail__command-title">{cmd.title}</span>
                    {cmd.description && (
                      <span className="plugin-detail__command-desc">{cmd.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="plugin-detail__section">
              <p style={{ color: "var(--text-secondary)" }}>No commands registered.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-manager">
      <div className="plugin-manager__header">
        <h2 className="plugin-manager__title">Plugins</h2>
        <div className="plugin-manager__actions">
          <button onClick={() => void installFromFile()} className="plugin-install-btn">
            Install from file...
          </button>
          <span className="plugin-manager__count">
            {plugins.length} installed
          </span>
        </div>
      </div>

      {error && (
        <div className="plugin-manager__error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="plugin-manager__dismiss">
            Dismiss
          </button>
        </div>
      )}

      {plugins.length === 0 ? (
        <div className="plugin-manager__empty">
          <p>No plugins installed yet.</p>
          <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
            Plugins extend Artworks Studio with new capabilities.
          </p>
          <button onClick={() => void installFromFile()} className="plugin-install-btn">
            Install from file...
          </button>
        </div>
      ) : (
        <div className="plugin-manager__list">
          {plugins.map((plugin) => (
            <div
              key={plugin.uuid}
              className={`plugin-card ${plugin.enabled ? "plugin-card--enabled" : ""}`}
            >
              <div
                className="plugin-card__header"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPlugin(plugin)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelectedPlugin(plugin);
                }}
              >
                <div className="plugin-card__info">
                  <h3 className="plugin-card__name">{plugin.name}</h3>
                  <span className="plugin-card__version">
                    v{plugin.version}
                  </span>
                  <span
                    className="plugin-card__category"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[plugin.category] ?? "#6B7280",
                    }}
                  >
                    {plugin.category}
                  </span>
                </div>
                <div className="plugin-card__actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePlugin(plugin.uuid, plugin.enabled);
                    }}
                    className={`plugin-toggle ${plugin.enabled ? "plugin-toggle--on" : ""}`}
                  >
                    {plugin.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void uninstallPlugin(plugin.uuid, plugin.name);
                    }}
                    className="plugin-uninstall"
                  >
                    Uninstall
                  </button>
                </div>
              </div>

              {plugin.description && (
                <p className="plugin-card__description">
                  {plugin.description}
                </p>
              )}

              <div className="plugin-card__meta">
                <span>by {plugin.author}</span>
                {plugin.manifest.permissions?.length > 0 && (
                  <span>
                    Permissions: {plugin.manifest.permissions.join(", ")}
                  </span>
                )}
                {(() => {
                  const cmds = plugin.manifest.commands;
                  return cmds?.length ? (
                    <span>Commands: {cmds.length}</span>
                  ) : null;
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

panelRegistry.register({
  id: "plugin-manager",
  title: "Plugins",
  icon: "\u{1f9e9}", // 🧩
  component: PluginManagerPanel,
  defaultSlot: "right",
  defaultVisible: false,
});
