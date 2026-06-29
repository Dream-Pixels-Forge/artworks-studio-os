/** Type declaration for the preload-exposed window.artworks bridge. */
import type { ArtworksApi } from "../preload/index.js";

declare global {
  interface Window {
    artworks: ArtworksApi;
  }
}
