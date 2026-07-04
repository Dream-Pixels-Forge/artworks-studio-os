/**
 * Studio shell — the top-level presentation frame.
 *
 * Renders the title bar, the dockable workspace layout, the command
 * palette, and the settings modal. The workspace layout replaces the
 * static explorer + main split with a configurable panel arrangement.
 */
import { useEffect, useState } from "react";
import { CommandPalette, registerBuiltinCommands, registerPluginCommands, useCommandPalette } from "../command-palette/index.js";
import { SettingsPanel } from "../panels/settings/index.js";
import { TitleBar } from "./title-bar/index.js";
import { WorkspaceLayout } from "../workspace/index.js";

/** Renderer event the "open settings" command dispatches (see commands.ts). */
const OPEN_SETTINGS_EVENT = "artworks:open-settings";

/** Map menu action IDs to command palette command IDs. */
const ACTION_TO_COMMAND: Record<string, string> = {
  "command-palette": "__palette__",
  "toggle-theme": "app.toggle-theme",
  "open-settings": "app.open-settings",
  "new-production": "production:create",
  "open-production": "production:open",
  "search": "search:open",
  "new-entity": "entity:create",
  "toggle-sidebar": "workspace:toggle-sidebar",
  "toggle-terminal": "workspace:toggle-terminal",
  "save": "editor:save",
};

export function StudioShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const palette = useCommandPalette();

  useEffect(() => {
    registerBuiltinCommands();
    void registerPluginCommands();
    const onOpenSettings = (): void => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);

    // Listen for menu/shortcut actions from the main process and dispatch them.
    const unsubMenu = window.artworks.menu.onAction((action) => {
      if (action === "open-settings") {
        setSettingsOpen(true);
      } else if (action === "command-palette") {
        palette.toggle();
      } else {
        // Map action to command ID and run it if registered.
        const commandId = ACTION_TO_COMMAND[action];
        if (commandId && commandId !== "__palette__") {
          void palette.run(commandId);
        }
      }
    });

    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
      unsubMenu();
    };
  }, [palette]);

  return (
    <div className="studio-shell studio-shell--workspace">
      <TitleBar />
      <WorkspaceLayout />
      <CommandPalette open={palette.open} onClose={palette.close} onRun={palette.run} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}