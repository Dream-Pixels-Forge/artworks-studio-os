/**
 * Renderer entry.
 *
 * Mounts the studio shell. The shell renders the brand and a readiness
 * check against the preload-exposed API. Design tokens drive all styling.
 *
 * A `?panel=<id>` query param (set by the WindowManager when a panel is
 * detached into its own window) mounts a <SinglePanelWindow> instead of the
 * full shell — the secondary window shows only that one panel.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudioShell } from "./studio-shell.js";
import { SinglePanelWindow } from "../workspace/single-panel-window.js";
import { loadTokens } from "../ui/tokens/index.js";
import { ThemeProvider } from "../ui/theme-provider.js";
import "./styles.css";
import "../workspace/workspace.css";
import "../panels/panels.css";
import "../panels/phase3-panels.css";
import "../panels/phase4-8-panels.css";
import "@xyflow/react/dist/style.css";

loadTokens(); // synchronous default; ThemeProvider corrects once IPC resolves

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

// Detached-panel routing: a secondary window loads index.html with ?panel=<id>.
const panelId = new URLSearchParams(window.location.search).get("panel");

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>{panelId ? <SinglePanelWindow panelId={panelId} /> : <StudioShell />}</ThemeProvider>
  </StrictMode>,
);
