/**
 * Marketplace panel.
 *
 * Browse, search, install, and rate marketplace listings.
 * Shows featured, popular, top-rated, and category-filtered views with
 * a detail view for individual listings including sandboxing permissions.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { panelRegistry } from "../../workspace/registry.js";

type MarketplaceCategory =
  | "production"
  | "ai"
  | "integration"
  | "workflow"
  | "ui"
  | "utility"
  | "template"
  | "asset";

type MarketplaceType = "plugin" | "template" | "asset";

interface MarketplaceListing {
  uuid: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: MarketplaceCategory;
  type: MarketplaceType;
  icon: string | null;
  screenshots: string[];
  manifestId: string | null;
  downloadUrl: string | null;
  downloads: number;
  rating: number;
  ratingCount: number;
  installed: boolean;
  installedVersion: string | null;
  listed: boolean;
  createdAt: string;
  updatedAt: string;
}

type ViewTab = "browse" | "popular" | "top-rated" | "installed";

const CATEGORY_COLORS: Record<string, string> = {
  production: "#8B5CF6",
  ai: "#F59E0B",
  integration: "#10B981",
  workflow: "#3B82F6",
  ui: "#EC4899",
  utility: "#6B7280",
  template: "#14B8A6",
  asset: "#F97316",
};

const TYPE_LABELS: Record<string, string> = {
  plugin: "Plugin",
  template: "Template",
  asset: "Asset",
};

/** Common sandbox permissions for plugins. */
const SANDBOX_PERMISSIONS = [
  { key: "fs:read", label: "Read Files", description: "Access local file system for reading" },
  { key: "fs:write", label: "Write Files", description: "Create or modify local files" },
  { key: "net:http", label: "Network Access", description: "Make HTTP requests to external APIs" },
  { key: "db:read", label: "Database Read", description: "Query the production database" },
  { key: "db:write", label: "Database Write", description: "Modify production database records" },
  { key: "ipc:invoke", label: "IPC Invoke", description: "Call main process IPC handlers" },
  { key: "exec:child", label: "Child Process", description: "Spawn child processes on the system" },
  { key: "ui:panel", label: "Custom Panels", description: "Register custom UI panels" },
];

/** Debounce hook for search input. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function MarketplacePanel() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [featured, setFeatured] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory | "all">("all");
  const [activeType, setActiveType] = useState<MarketplaceType | "all">("all");
  const [view, setView] = useState<ViewTab>("browse");
  const [userRating, setUserRating] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadListings = useCallback(async () => {
    try {
      setLoading(true);
      // Each marketplace call returns Promise<unknown> (the preload bridge
      // is intentionally loosely typed); collect into one variable and
      // cast to the listing shape once, at the single assignment site.
      let result: unknown;

      if (debouncedSearch.trim()) {
        // Use dedicated search endpoint when searching
        result = await window.artworks.marketplace.search(debouncedSearch.trim(), 50);
      } else if (view === "popular") {
        result = await window.artworks.marketplace.popular(30);
      } else if (view === "top-rated") {
        result = await window.artworks.marketplace.topRated(30);
      } else if (view === "installed") {
        result = await window.artworks.marketplace.list({ installed: true });
      } else {
        // Browse view: apply category + type filters
        const filter: Record<string, unknown> = {};
        if (activeCategory !== "all") filter.category = activeCategory;
        if (activeType !== "all") filter.type = activeType;
        result = await window.artworks.marketplace.list(filter);
      }

      setListings(result as MarketplaceListing[]);

      // Load featured separately for the browse tab
      if (view === "browse" && !debouncedSearch.trim()) {
        const feat = await window.artworks.marketplace.featured(6);
        setFeatured(feat as MarketplaceListing[]);
      } else {
        setFeatured([]);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeCategory, activeType, view]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  // Focus search input on Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const installListing = useCallback(
    async (uuid: string, version: string) => {
      try {
        await window.artworks.marketplace.install(uuid, version);
        await loadListings();
        if (selectedListing?.uuid === uuid) {
          const updated = await window.artworks.marketplace.getByUuid(uuid);
          setSelectedListing(updated as MarketplaceListing);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to install");
      }
    },
    [loadListings, selectedListing],
  );

  const uninstallListing = useCallback(
    async (uuid: string, name: string) => {
      if (!window.confirm(`Uninstall "${name}"?`)) return;
      try {
        await window.artworks.marketplace.uninstall(uuid);
        await loadListings();
        if (selectedListing?.uuid === uuid) {
          const updated = await window.artworks.marketplace.getByUuid(uuid);
          setSelectedListing(updated as MarketplaceListing);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to uninstall");
      }
    },
    [loadListings, selectedListing],
  );

  const rateListing = useCallback(
    async (uuid: string, rating: number) => {
      try {
        await window.artworks.marketplace.rate(uuid, { rating });
        setUserRating(rating);
        await loadListings();
        if (selectedListing?.uuid === uuid) {
          const updated = await window.artworks.marketplace.getByUuid(uuid);
          setSelectedListing(updated as MarketplaceListing);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rate");
      }
    },
    [loadListings, selectedListing],
  );

  const renderStars = (rating: number, interactive = false, onRate?: (r: number) => void) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);

    if (interactive && onRate) {
      return (
        <span className="marketplace-stars marketplace-stars--interactive">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={`marketplace-star-btn ${star <= Math.round(rating) ? "marketplace-star-btn--filled" : ""}`}
              onClick={() => onRate(star)}
              title={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              {star <= Math.round(rating) ? "★" : "☆"}
            </button>
          ))}
          <span className="marketplace-stars__num">{rating.toFixed(1)}</span>
        </span>
      );
    }

    return (
      <span className="marketplace-stars">
        {"★".repeat(full)}
        {half && "½"}
        {"☆".repeat(empty)}
        <span className="marketplace-stars__num">{rating.toFixed(1)}</span>
      </span>
    );
  };

  const formatDownloads = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const renderListingCard = (listing: MarketplaceListing) => (
    <div
      key={listing.uuid}
      className={`marketplace-card ${listing.installed ? "marketplace-card--installed" : ""}`}
    >
      <div
        className="marketplace-card__header"
        role="button"
        tabIndex={0}
        onClick={() => setSelectedListing(listing)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setSelectedListing(listing);
        }}
      >
        <div className="marketplace-card__icon">
          {listing.icon ? (
            <span className="marketplace-card__icon-emoji">{listing.icon}</span>
          ) : (
            <span className="marketplace-card__icon-placeholder">
              {listing.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="marketplace-card__info">
          <div className="marketplace-card__title-row">
            <h3 className="marketplace-card__name">{listing.name}</h3>
            <span className="marketplace-card__version">v{listing.version}</span>
          </div>
          <div className="marketplace-card__badges">
            <span
              className="marketplace-card__category"
              style={{ backgroundColor: CATEGORY_COLORS[listing.category] ?? "#6B7280" }}
            >
              {listing.category}
            </span>
            <span className="marketplace-card__type">{TYPE_LABELS[listing.type] ?? listing.type}</span>
            {listing.installed && (
              <span className="marketplace-card__installed-badge">Installed</span>
            )}
          </div>
        </div>
        <div className="marketplace-card__stats">
          {renderStars(listing.rating)}
          <span className="marketplace-card__downloads">
            ↓ {formatDownloads(listing.downloads)}
          </span>
        </div>
      </div>
      {listing.description && (
        <p className="marketplace-card__description">{listing.description}</p>
      )}
      <div className="marketplace-card__meta">
        <span className="marketplace-card__author">by {listing.author}</span>
      </div>
    </div>
  );

  if (loading && listings.length === 0) {
    return (
      <div className="marketplace">
        <p style={{ color: "var(--text-secondary)" }}>Loading marketplace...</p>
      </div>
    );
  }

  // Detail view for selected listing.
  if (selectedListing) {
    return (
      <div className="marketplace">
        <div className="marketplace__header">
          <button
            onClick={() => {
              setSelectedListing(null);
              setUserRating(null);
            }}
            className="marketplace-detail__back"
          >
            ← Back to list
          </button>
          <div className="marketplace-detail__title-row">
            <h2 className="marketplace__title">{selectedListing.name}</h2>
            <span className="marketplace-card__version">v{selectedListing.version}</span>
          </div>
        </div>

        <div className="marketplace-detail">
          {/* Action bar */}
          <div className="marketplace-detail__actions">
            {selectedListing.installed ? (
              <>
                <span className="marketplace-detail__installed-badge">
                  ✓ Installed v{selectedListing.installedVersion}
                </span>
                <button
                  onClick={() => void uninstallListing(selectedListing.uuid, selectedListing.name)}
                  className="marketplace-btn marketplace-btn--danger"
                >
                  Uninstall
                </button>
              </>
            ) : (
              <button
                onClick={() => void installListing(selectedListing.uuid, selectedListing.version)}
                className="marketplace-btn marketplace-btn--primary"
              >
                Install
              </button>
            )}
          </div>

          {/* Description */}
          <div className="marketplace-detail__section">
            <p className="marketplace-detail__desc">{selectedListing.description}</p>
          </div>

          {/* Rating section */}
          <div className="marketplace-detail__section">
            <h3>Rating</h3>
            <div className="marketplace-detail__rating">
              {renderStars(selectedListing.rating)}
              <span className="marketplace-detail__rating-count">
                ({selectedListing.ratingCount} rating{selectedListing.ratingCount !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="marketplace-detail__rate-action">
              <span className="marketplace-detail__rate-label">Your rating:</span>
              {renderStars(userRating ?? 0, true, (r) => void rateListing(selectedListing.uuid, r))}
            </div>
          </div>

          {/* Meta grid */}
          <div className="marketplace-detail__meta-grid">
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Author</span>
              <span className="marketplace-detail__meta-value">{selectedListing.author}</span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Category</span>
              <span
                className="marketplace-detail__meta-value"
                style={{ color: CATEGORY_COLORS[selectedListing.category] ?? "#6B7280" }}
              >
                {selectedListing.category}
              </span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Type</span>
              <span className="marketplace-detail__meta-value">
                {TYPE_LABELS[selectedListing.type] ?? selectedListing.type}
              </span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Downloads</span>
              <span className="marketplace-detail__meta-value">
                {formatDownloads(selectedListing.downloads)}
              </span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Version</span>
              <span className="marketplace-detail__meta-value">{selectedListing.version}</span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Updated</span>
              <span className="marketplace-detail__meta-value">
                {new Date(selectedListing.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Sandbox permissions */}
          {selectedListing.type === "plugin" && (
            <div className="marketplace-detail__section">
              <h3>Sandbox Permissions</h3>
              <p className="marketplace-detail__section-desc">
                This plugin requests the following permissions. Permissions are enforced by the
                plugin sandbox at runtime.
              </p>
              <div className="marketplace-detail__permissions">
                {SANDBOX_PERMISSIONS.map((perm) => {
                  // Plugins get a default set of safe permissions;
                  // dangerous ones require explicit manifest declaration.
                  const granted = ["ui:panel", "db:read"].includes(perm.key);
                  const dangerous = ["exec:child", "fs:write", "db:write"].includes(perm.key);
                  return (
                    <div
                      key={perm.key}
                      className={`marketplace-permission ${granted ? "marketplace-permission--granted" : ""} ${dangerous ? "marketplace-permission--dangerous" : ""}`}
                    >
                      <div className="marketplace-permission__header">
                        <span className="marketplace-permission__icon">
                          {granted ? "✓" : dangerous ? "⚠" : "○"}
                        </span>
                        <span className="marketplace-permission__label">{perm.label}</span>
                        {dangerous && <span className="marketplace-permission__badge">Restricted</span>}
                      </div>
                      <p className="marketplace-permission__desc">{perm.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Install info */}
          {selectedListing.downloadUrl && (
            <div className="marketplace-detail__section">
              <h3>Installation</h3>
              <div className="marketplace-detail__install-info">
                <span className="marketplace-detail__meta-label">Source</span>
                <a
                  href={selectedListing.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="marketplace-detail__link"
                >
                  {selectedListing.downloadUrl}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Browse view.
  return (
    <div className="marketplace">
      <div className="marketplace__header">
        <h2 className="marketplace__title">Marketplace</h2>
        <div className="marketplace__tabs">
          {(
            [
              ["browse", "Browse"],
              ["popular", "Popular"],
              ["top-rated", "Top Rated"],
              ["installed", "Installed"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={`marketplace__tab ${view === key ? "marketplace__tab--active" : ""}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="marketplace__error">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="marketplace__dismiss">
            Dismiss
          </button>
        </div>
      )}

      {/* Search and filters */}
      <div className="marketplace__filters">
        <div className="marketplace__search-wrapper">
          <span className="marketplace__search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search listings... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="marketplace__search"
          />
          {searchQuery && (
            <button
              className="marketplace__search-clear"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {view === "browse" && (
          <>
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as MarketplaceCategory | "all")}
              className="marketplace__filter-select"
            >
              <option value="all">All Categories</option>
              <option value="production">Production</option>
              <option value="ai">AI</option>
              <option value="integration">Integration</option>
              <option value="workflow">Workflow</option>
              <option value="ui">UI</option>
              <option value="utility">Utility</option>
              <option value="template">Template</option>
              <option value="asset">Asset</option>
            </select>
            <select
              value={activeType}
              onChange={(e) => setActiveType(e.target.value as MarketplaceType | "all")}
              className="marketplace__filter-select"
            >
              <option value="all">All Types</option>
              <option value="plugin">Plugins</option>
              <option value="template">Templates</option>
              <option value="asset">Assets</option>
            </select>
          </>
        )}
      </div>

      {/* Featured section (browse view only, no search active) */}
      {view === "browse" && featured.length > 0 && !debouncedSearch.trim() && activeCategory === "all" && (
        <div className="marketplace__section">
          <h3 className="marketplace__section-title">Featured</h3>
          <div className="marketplace__grid">{featured.map(renderListingCard)}</div>
        </div>
      )}

      {/* Main listing */}
      <div className="marketplace__section">
        <h3 className="marketplace__section-title">
          {debouncedSearch.trim()
            ? `Search results for "${debouncedSearch.trim()}"`
            : view === "browse"
              ? "All Listings"
              : view === "popular"
                ? "Popular"
                : view === "top-rated"
                  ? "Top Rated"
                  : "Installed"}
          <span className="marketplace__section-count">{listings.length}</span>
        </h3>
        {listings.length === 0 ? (
          <div className="marketplace__empty">
            <p>No listings found.</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              {view === "installed"
                ? "Install listings from the Browse tab."
                : debouncedSearch.trim()
                  ? "Try a different search term."
                  : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="marketplace__grid">{listings.map(renderListingCard)}</div>
        )}
      </div>
    </div>
  );
}

panelRegistry.register({
  id: "marketplace",
  title: "Marketplace",
  icon: "\u{1f6d2}", // 🛒
  component: MarketplacePanel,
  defaultSlot: "right",
  defaultVisible: false,
});
