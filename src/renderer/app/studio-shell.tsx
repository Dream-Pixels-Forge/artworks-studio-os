/**
 * Studio shell — the top-level presentation frame.
 *
 * Renders the title bar, the dockable workspace layout, the command
 * palette, and the settings modal. The workspace layout replaces the
 * static explorer + main split with a configurable panel arrangement.
 */
import { useEffect, useState } from "react";
import { CommandPalette, registerBuiltinCommands, useCommandPalette } from "../command-palette/index.js";
import { SettingsPanel } from "../panels/settings/index.js";
import { TitleBar } from "./title-bar/index.js";
import { WorkspaceLayout } from "../workspace/index.js";

/** Renderer event the "open settings" command dispatches (see commands.ts). */
const OPEN_SETTINGS_EVENT = "artworks:open-settings";

export function StudioShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const palette = useCommandPalette();

  useEffect(() => {
    registerBuiltinCommands();
    const onOpenSettings = (): void => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  return (
    <div className="studio-shell studio-shell--workspace">
      <TitleBar />
      <WorkspaceLayout />
      <CommandPalette open={palette.open} onClose={palette.close} onRun={palette.run} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}