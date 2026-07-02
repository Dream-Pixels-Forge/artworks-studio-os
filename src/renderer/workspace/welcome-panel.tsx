/**
 * Welcome panel — the center area default.
 *
 * Shows the product identity, a status line, and a hint to open the
 * command palette. Replaced by the production dashboard once Phase 2
 * ships.
 */
import { useEffect, useState } from "react";
import { PRODUCT_NAME, TAGLINE } from "@shared/utils/index.js";
import type { PanelProps } from "./types.js";

interface ArtworksGlobal {
  version: string;
  product: string;
  tagline: string;
}

export function WelcomePanel(_props: PanelProps) {
  const [api, setApi] = useState<ArtworksGlobal | null>(null);

  useEffect(() => {
    const global = window as unknown as { artworks?: ArtworksGlobal };
    if (global.artworks) setApi(global.artworks);
  }, []);

  return (
    <div className="workspace__welcome">
      <header className="workspace__welcome-brand">
        <h1 className="workspace__welcome-title">{PRODUCT_NAME}</h1>
        <p className="workspace__welcome-tagline">{TAGLINE}</p>
      </header>
      <section className="workspace__welcome-status">
        {api ? (
          <p>
            Foundation ready · CLI v{api.version} · <kbd>Ctrl</kbd>+<kbd>K</kbd> for commands
          </p>
        ) : (
          <p>Loading studio…</p>
        )}
      </section>
    </div>
  );
}