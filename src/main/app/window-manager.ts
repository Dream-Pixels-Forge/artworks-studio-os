/**
 * Window manager (main process).
 *
 * Owns the studio's windows: the lifecycle, a registry of open windows with
 * their roles, persisted window state (debounced save), the application
 * menu, and graceful shutdown (flush pending writes before quit).
 *
 * The manager is the single place that talks to Electron's BrowserWindow/
 * Menu/screen APIs; everything else (geometry helpers, menu template, IPC)
 * is split into testable modules.
 */
import { BrowserWindow, Menu, screen } from "electron";
import { createWindow } from "./window.js";
import { WindowStateStore, clampToVisible } from "./window-state.js";
import { buildAppMenu, type MenuDeps } from "./menu.js";
import { createLogger } from "@main/core/logger.js";
import {
  MENU_ACTION_CHANNEL,
  WINDOW_EVENTS,
  type DisplayBounds,
  type MenuAction,
  type WindowListEntry,
  type WindowRole,
} from "@shared/window/index.js";

const log = createLogger("window-manager");

/** Avoid the ambient NodeJS namespace (ESLint no-undef). */
type Timer = ReturnType<typeof setTimeout>;

/** How long after the last resize/move we wait before writing state to disk. */
const SAVE_DEBOUNCE_MS = 400;

interface TrackedWindow {
  window: BrowserWindow;
  role: WindowRole;
  /**
   * For secondary windows only: the panel id this window was detached to show.
   * Broadcast to the main window on close so it can re-dock the panel.
   */
  panelId?: string;
  /** Pending save timer for this window's debounced state write. */
  saveTimer: Timer | undefined;
}

export interface WindowManagerInit {
  /** Path to the renderer index (dev server URL or built file). */
  indexHtmlPath: string;
}

export class WindowManager {
  private store = new WindowStateStore();
  private windows = new Map<number, TrackedWindow>();
  private indexHtmlPath: string | undefined;
  private isShuttingDown = false;

  /**
   * Set up the menu, load persisted geometry, and open the primary window.
   * Resolves to the main window once it has been created.
   */
  async start(options: WindowManagerInit): Promise<BrowserWindow> {
    this.indexHtmlPath = options.indexHtmlPath;
    this.applyMenu();
    const persisted = await this.loadClampedState();
    return this.createMain(persisted);
  }

  /** Open (or focus) the main studio window. */
  createMain(initialState?: import("@shared/window/index.js").WindowState): BrowserWindow {
    // There is only ever one main window — focus it if it already exists.
    const existing = this.findByRole("main");
    if (existing) {
      existing.focus();
      return existing;
    }
    return this.open({ role: "main", title: "Artworks Studio OS", state: initialState });
  }

  /**
   * Open a secondary window showing a single detached panel. The panel id is
   * passed to the renderer as a `?panel=<id>` query param (see main.tsx) and
   * remembered on the tracked window so close can broadcast a re-dock event.
   * Secondary windows inherit the main window's current size as a default.
   */
  createSecondary(opts: { title: string; panelId: string }): BrowserWindow {
    // Secondary windows inherit the main window's current size as a default.
    const main = this.findByRole("main");
    const state = main
      ? { width: main.getBounds().width, height: main.getBounds().height }
      : undefined;
    return this.open({ role: "secondary", title: opts.title, state, panelId: opts.panelId });
  }

  /** Persist any pending window state. Call on before-quit. */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    for (const tracked of this.windows.values()) {
      if (tracked.saveTimer) {
        clearTimeout(tracked.saveTimer);
        tracked.saveTimer = undefined;
      }
    }
    await this.saveMainWindowState();
    log.info("window manager shut down");
  }

  /** All tracked windows, for the dynamic Window menu. */
  listWindows(): WindowListEntry[] {
    return [...this.windows.values()]
      .sort((a, b) => a.window.id - b.window.id)
      .map((tracked) => ({ id: tracked.window.id, title: tracked.window.getTitle() }));
  }

  /** Focus a window by id (Window menu). */
  focusWindow(id: number): void {
    this.windows.get(id)?.window.focus();
  }

  /** Forward a menu action to the focused window's renderer. */
  forwardMenuAction(action: MenuAction): void {
    const target = BrowserWindow.getFocusedWindow() ?? this.findByRole("main");
    target?.webContents.send(MENU_ACTION_CHANNEL, action);
  }

  // --- internals --------------------------------------------------------

  private open(opts: {
    role: WindowRole;
    title: string;
    state?: import("@shared/window/index.js").WindowState;
    panelId?: string;
  }): BrowserWindow {
    const window = createWindow({
      indexHtmlPath: this.indexHtmlPath!,
      state: opts.state,
      title: opts.title,
      // Only detached-panel windows carry a panel id; the main window loads
      // the bare index so it mounts <StudioShell> as before.
      query: opts.panelId ? { panel: opts.panelId } : undefined,
    });

    this.track(window, opts.role, opts.panelId);
    log.info("window opened", { id: window.id, role: opts.role, panelId: opts.panelId });
    return window;
  }

  /** Read persisted state, clamped against current displays. */
  private async loadClampedState(): Promise<import("@shared/window/index.js").WindowState | undefined> {
    const persisted = await this.store.load();
    if (!persisted) return undefined;
    return clampToVisible(persisted, this.displays());
  }

  private track(window: BrowserWindow, role: WindowRole, panelId?: string): void {
    const tracked: TrackedWindow = { window, role, panelId, saveTimer: undefined };
    this.windows.set(window.id, tracked);

    // Persist geometry after the user finishes resizing/moving (debounced).
    const scheduleSave = (): void => this.scheduleSave(tracked);
    window.on("resize", scheduleSave);
    window.on("move", scheduleSave);

    // Maximize state changes push to the title bar so its icon updates.
    window.on("maximize", () => this.broadcastMaximized(window, true));
    window.on("unmaximize", () => this.broadcastMaximized(window, false));

    window.on("closed", () => {
      if (tracked.saveTimer) clearTimeout(tracked.saveTimer);
      this.windows.delete(window.id);
      this.applyMenu(); // rebuild Window menu without the closed entry
      // A detached panel's window closed — tell the main window to re-dock it
      // so the panel reappears at its default slot (lossless from the user view).
      if (tracked.panelId) this.broadcastDetachedClosed(tracked.panelId);
      log.info("window closed", { id: window.id });
    });

    this.applyMenu(); // include the new window in the Window menu
  }

  /** Tell the main window a detached panel's window closed, so it re-docks. */
  private broadcastDetachedClosed(panelId: string): void {
    const main = this.findByRole("main");
    if (!main || main.isDestroyed()) return;
    main.webContents.send(WINDOW_EVENTS.detachedClosed, panelId);
  }

  private scheduleSave(tracked: TrackedWindow): void {
    if (this.isShuttingDown) return;
    if (tracked.saveTimer) clearTimeout(tracked.saveTimer);
    tracked.saveTimer = setTimeout(() => {
      tracked.saveTimer = undefined;
      void this.saveMainWindowState();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Persist the main window's current geometry. */
  private async saveMainWindowState(): Promise<void> {
    const main = this.findByRole("main");
    if (!main || main.isDestroyed()) return;

    const isMaximized = main.isMaximized();
    // When maximized, persist the restored (normal) bounds, not the full-screen ones.
    const bounds = isMaximized ? main.getNormalBounds() : main.getBounds();

    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
    };
    await this.store.save(state);
  }

  /** Current displays as plain bounds (decoupled from Electron's Display). */
  private displays(): DisplayBounds[] {
    return screen.getAllDisplays().map((d) => ({
      x: d.bounds.x,
      y: d.bounds.y,
      width: d.bounds.width,
      height: d.bounds.height,
    }));
  }

  private findByRole(role: WindowRole): BrowserWindow | undefined {
    for (const tracked of this.windows.values()) {
      if (tracked.role === role) return tracked.window;
    }
    return undefined;
  }

  private broadcastMaximized(window: BrowserWindow, isMaximized: boolean): void {
    if (window.isDestroyed()) return;
    window.webContents.send(WINDOW_EVENTS.maximizedChanged, isMaximized);
  }

  /** (Re)build and apply the application menu from the current window list. */
  private applyMenu(): void {
    const deps: MenuDeps = {
      onAction: (action) => this.forwardMenuAction(action),
      rebuild: () => this.applyMenu(),
      windows: () => this.listWindows(),
      focusWindow: (id) => this.focusWindow(id),
    };
    Menu.setApplicationMenu(buildAppMenu(deps));
  }
}
