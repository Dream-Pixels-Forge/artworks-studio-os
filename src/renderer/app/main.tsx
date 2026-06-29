/**
 * Renderer entry.
 *
 * Mounts the studio shell. The shell renders the brand and a readiness
 * check against the preload-exposed API. Design tokens drive all styling.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudioShell } from "./studio-shell.js";
import { loadTokens } from "../ui/tokens/index.js";
import { ThemeProvider } from "../ui/theme-provider.js";
import "./styles.css";

loadTokens(); // synchronous default; ThemeProvider corrects once IPC resolves

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <StudioShell />
    </ThemeProvider>
  </StrictMode>,
);
