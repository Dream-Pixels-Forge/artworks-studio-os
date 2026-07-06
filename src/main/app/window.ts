/**
 * BrowserWindow factory.
 *
 * Creates a studio window with sensible production defaults. Frameless so
 * the renderer paints a branded title bar; bounds come from persisted
 * window state when available (handled by the window manager). Kept free of
 * business logic — just window configuration.
 */
import { BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import type { WindowState } from "@shared/window/index.js";

export interface CreateWindowOptions {
  /** URL or file path to the renderer's index document. */
  indexHtmlPath: string;
  /** Persisted geometry to restore, if any. */
  state?: WindowState;
  /** Window title (shown in the title bar / taskbar). */
  title?: string;
  /** Background color while the renderer loads. */
  backgroundColor?: string;
  /**
   * Query-string params appended to the loaded renderer URL. Used to tell a
   * secondary window which view to mount (e.g. `{ panel: "asset-browser" }`).
   * Omitted for the main window.
   */
  query?: Record<string, string>;
}

const STUDIO_MIN_WIDTH = 1024;
const STUDIO_MIN_HEIGHT = 640;

const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;

export function createWindow(options: CreateWindowOptions): BrowserWindow {
  const { state, indexHtmlPath, query } = options;
  const width = state?.width ?? DEFAULT_WIDTH;
  const height = state?.height ?? DEFAULT_HEIGHT;

  const window = new BrowserWindow({
    width,
    height,
    x: state?.x,
    y: state?.y,
    minWidth: STUDIO_MIN_WIDTH,
    minHeight: STUDIO_MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    // Frameless so the renderer paints a branded title bar. On macOS use
    // "hiddenInset" so the native traffic lights sit inset within our bar;
    // elsewhere "hidden" with frame:false hands the renderer the full chrome
    // (our custom controls live on the trailing edge).
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: options.backgroundColor ?? "#161616",
    title: options.title ?? "Artworks Studio OS",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  // A maximized window restores maximized; clear the offset so the OS tiles it.
  if (state?.isMaximized) {
    window.maximize();
  }

  loadRenderer(window, indexHtmlPath, query);
  return window;
}

/**
 * Load the renderer into a window. In dev the path is the vite dev-server URL;
 * in production it's the built index.html on disk. An optional `query` is
 * forwarded in both modes so a secondary window can be told which view to show
 * (e.g. `?panel=<id>`). The two Electron APIs accept the query differently —
 * loadFile takes a `query` option, loadURL needs it appended to the URL.
 */
function loadRenderer(window: BrowserWindow, path: string, query?: Record<string, string>): void {
  if (path.startsWith("http")) {
    const url = query ? appendQuery(path, query) : path;
    void window.loadURL(url);
  } else {
    void window.loadFile(path, query ? { query } : undefined);
  }
}

/** Append a query string to a base URL (dev-server case). */
function appendQuery(baseUrl: string, query: Record<string, string>): string {
  const qs = new URLSearchParams(query).toString();
  if (!qs) return baseUrl;
  return baseUrl.includes("?") ? `${baseUrl}&${qs}` : `${baseUrl}?${qs}`;
}

/**
 * Resolve the preload script path. Uses electron-vite's dev convention when
 * present, falling back to the production build output.
 */
function getPreloadPath(): string {
  // electron-vite places the bundled preload at out/preload/index.mjs
  return fileURLToPath(new URL("../preload/index.mjs", import.meta.url));
}
