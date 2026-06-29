/**
 * BrowserWindow factory.
 *
 * Creates the studio's main window with sensible production defaults.
 * Kept free of business logic — just window configuration.
 */
import { BrowserWindow } from "electron";

export interface CreateWindowOptions {
  /** URL or file path to the renderer's index document. */
  indexHtmlPath: string;
}

const STUDIO_WINDOW_WIDTH = 1440;
const STUDIO_WINDOW_HEIGHT = 900;
const STUDIO_MIN_WIDTH = 1024;
const STUDIO_MIN_HEIGHT = 640;

export function createWindow(options: CreateWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: STUDIO_WINDOW_WIDTH,
    height: STUDIO_WINDOW_HEIGHT,
    minWidth: STUDIO_MIN_WIDTH,
    minHeight: STUDIO_MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#161616",
    title: "Artworks Studio OS",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  loadRenderer(window, options.indexHtmlPath);
  return window;
}

function loadRenderer(window: BrowserWindow, path: string): void {
  if (path.startsWith("http")) {
    void window.loadURL(path);
  } else {
    void window.loadFile(path);
  }
}

/**
 * Resolve the preload script path. Uses electron-vite's dev convention when
 * present, falling back to the production build output.
 */
function getPreloadPath(): string {
  // electron-vite places the bundled preload at out/preload/index.mjs
  return new URL("../preload/index.mjs", import.meta.url).pathname;
}
