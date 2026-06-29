/**
 * Theme IPC handlers.
 *
 * Wires the renderer→main channels (theme:get, theme:set) and pushes OS
 * theme updates to all windows (theme:native-updated) when in system mode.
 */
import { ipcMain, BrowserWindow } from "electron";
import { ThemeService, type ResolvedTheme, type ThemeMode, type ThemeState } from "./theme-service.js";

const CHANNEL_GET = "theme:get";
const CHANNEL_SET = "theme:set";
const CHANNEL_NATIVE = "theme:native-updated";

/** Register the theme IPC handlers against the given service. */
export function registerThemeIpc(service: ThemeService): void {
  ipcMain.handle(CHANNEL_GET, (): ThemeState => service.state());
  ipcMain.handle(CHANNEL_SET, (_event, mode: ThemeMode): Promise<ThemeState> =>
    service.setMode(mode),
  );

  // Broadcast resolved-theme changes to every window's renderer.
  service.onChange((resolved: ResolvedTheme) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(CHANNEL_NATIVE, resolved);
    }
  });
}

export { CHANNEL_GET, CHANNEL_SET, CHANNEL_NATIVE };
