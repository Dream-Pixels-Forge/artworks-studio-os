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
import "./styles.css";

loadTokens(); // inject CSS custom properties onto :root

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <StudioShell />
  </StrictMode>,
);
