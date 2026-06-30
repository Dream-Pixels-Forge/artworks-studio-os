/**
 * Studio shell — the top-level presentation frame.
 *
 * Phase 0: renders the brand identity and confirms the preload bridge is
 * reachable. Phase 1 replaces this with the full docking workspace.
 */
import { useEffect, useState } from "react";
import { PRODUCT_NAME, TAGLINE } from "@shared/utils/index.js";
import { CommandPalette, registerBuiltinCommands, useCommandPalette } from "../command-palette/index.js";
import { ProjectExplorerPanel } from "../panels/project-explorer/project-explorer-panel.js";
import { SettingsPanel } from "../panels/settings/index.js";
import { TitleBar } from "./title-bar/index.js";

interface ArtworksGlobal {
  version: string;
  product: string;
  tagline: string;
}

/** Renderer event the "open settings" command dispatches (see commands.ts). */
const OPEN_SETTINGS_EVENT = "artworks:open-settings";

export function StudioShell() {
  const [api, setApi] = useState<ArtworksGlobal | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const palette = useCommandPalette();

  useEffect(() => {
    registerBuiltinCommands();
    const global = window as unknown as { artworks?: ArtworksGlobal };
    if (global.artworks) setApi(global.artworks);

    // Open settings when the command palette command requests it.
    const onOpenSettings = (): void => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  return (
    <div className="studio-shell studio-shell--workspace">
      <TitleBar />
      <div className="studio-shell__body">
        <ProjectExplorerPanel />
        <main className="studio-shell__main">
          <header className="studio-shell__brand">
            <h1 className="studio-shell__title">{PRODUCT_NAME}</h1>
            <p className="studio-shell__tagline">{TAGLINE}</p>
          </header>
          <section className="studio-shell__status">
            {api ? (
              <p>
                Foundation ready · CLI v{api.version} · <kbd>Ctrl</kbd>+<kbd>K</kbd> for commands
              </p>
            ) : (
              <p>Loading studio…</p>
            )}
          </section>
        </main>
      </div>
      <CommandPalette open={palette.open} onClose={palette.close} onRun={palette.run} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
