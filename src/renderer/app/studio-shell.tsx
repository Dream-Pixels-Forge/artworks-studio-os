/**
 * Studio shell — the top-level presentation frame.
 *
 * Phase 0: renders the brand identity and confirms the preload bridge is
 * reachable. Phase 1 replaces this with the full docking workspace.
 */
import { useEffect, useState } from "react";
import { PRODUCT_NAME, TAGLINE } from "@shared/utils/index.js";

interface ArtworksGlobal {
  version: string;
  product: string;
  tagline: string;
}

export function StudioShell() {
  const [api, setApi] = useState<ArtworksGlobal | null>(null);

  useEffect(() => {
    const global = window as unknown as { artworks?: ArtworksGlobal };
    if (global.artworks) setApi(global.artworks);
  }, []);

  return (
    <div className="studio-shell">
      <header className="studio-shell__brand">
        <h1 className="studio-shell__title">{PRODUCT_NAME}</h1>
        <p className="studio-shell__tagline">{TAGLINE}</p>
      </header>
      <section className="studio-shell__status">
        {api ? (
          <p>
            Foundation ready · CLI v{api.version}
          </p>
        ) : (
          <p>Loading studio…</p>
        )}
      </section>
    </div>
  );
}
