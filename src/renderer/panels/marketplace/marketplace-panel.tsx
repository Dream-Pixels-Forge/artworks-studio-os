/**
 * Marketplace panel.
 *
 * Browse, search, install, and rate marketplace listings.
 * Shows featured, recent, and category-filtered views with a detail view
 * for individual listings. Follows the same panel pattern as plugin-manager.
 */
import { useState, useEffect, useCallback } from "react";
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
  longDescription: string;
  author: string;
  version: string;
  category: MarketplaceCategory;
  type: MarketplaceType;
  downloads: number;
  rating: number;
  ratingCount: number;
  featured: boolean;
  tags: string;
  iconUrl: string;
  screenshots: string;
  repositoryUrl: string;
  license: string;
  minStudioVersion: string;
  installedVersion: string | null;
  installedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export function MarketplacePanel() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [featured, setFeatured] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory | "all">("all");
  const [activeType, setActiveType] = useState<MarketplaceType | "all">("all");
  const [view, setView] = useState<"browse" | "installed" | "featured">("browse");

  const loadListings = useCallback(async () => {
    try {
      setLoading(true);
      const filter: Record<string, unknown> = {};
      if (activeCategory !== "all") filter.category = activeCategory;
      if (activeType !== "all") filter.type = activeType;
      if (searchQuery.trim()) filter.search = searchQuery.trim();

      const [list, feat] = await Promise.all([
        window.artworks.marketplace.list(filter),
        window.artworks.marketplace.featured(6),
      ]);
      setListings(list as MarketplaceListing[]);
      setFeatured(feat as MarketplaceListing[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketplace");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeType, searchQuery]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

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
    async (uuid: string) => {
      const input = window.prompt("Rate 1-5:");
      if (!input) return;
      const rating = Number.parseInt(input, 10);
      if (Number.isNaN(rating) || rating < 1 || rating > 5) {
        setError("Rating must be 1-5");
        return;
      }
      try {
        await window.artworks.marketplace.rate(uuid, { rating });
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

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <span className="marketplace-stars">
        {"★".repeat(full)}
        {half && "½"}
        {"☆".repeat(empty)}
        <span className="marketplace-stars__num">{rating.toFixed(1)}</span>
      </span>
    );
  };

  const renderListingCard = (listing: MarketplaceListing) => (
    <div
      key={listing.uuid}
      className={`marketplace-card ${listing.installedVersion ? "marketplace-card--installed" : ""}`}
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
        <div className="marketplace-card__info">
          <h3 className="marketplace-card__name">{listing.name}</h3>
          <span className="marketplace-card__version">v{listing.version}</span>
          <span
            className="marketplace-card__category"
            style={{ backgroundColor: CATEGORY_COLORS[listing.category] ?? "#6B7280" }}
          >
            {listing.category}
          </span>
          <span className="marketplace-card__type">{TYPE_LABELS[listing.type] ?? listing.type}</span>
        </div>
        <div className="marketplace-card__stats">
          {renderStars(listing.rating)}
          <span className="marketplace-card__downloads">{listing.downloads.toLocaleString()} downloads</span>
        </div>
      </div>
      {listing.description && (
        <p className="marketplace-card__description">{listing.description}</p>
      )}
      <div className="marketplace-card__meta">
        <span>by {listing.author}</span>
        {listing.license && <span>License: {listing.license}</span>}
        {listing.installedVersion && (
          <span className="marketplace-card__installed">Installed v{listing.installedVersion}</span>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="marketplace">
        <p style={{ color: "var(--text-secondary)" }}>Loading marketplace...</p>
      </div>
    );
  }

  // Detail view for selected listing.
  if (selectedListing) {
    const tags = selectedListing.tags ? selectedListing.tags.split(",").map((t) => t.trim()) : [];
    return (
      <div className="marketplace">
        <div className="marketplace__header">
          <button
            onClick={() => setSelectedListing(null)}
            className="marketplace-detail__back"
          >
            Back to list
          </button>
          <h2 className="marketplace__title">{selectedListing.name}</h2>
          <span className="marketplace-card__version">v{selectedListing.version}</span>
        </div>

        <div className="marketplace-detail">
          <div className="marketplace-detail__actions">
            {selectedListing.installedVersion ? (
              <>
                <span className="marketplace-detail__installed-badge">
                  Installed v{selectedListing.installedVersion}
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
            <button
              onClick={() => void rateListing(selectedListing.uuid)}
              className="marketplace-btn"
            >
              Rate
            </button>
          </div>

          <p className="marketplace-detail__desc">{selectedListing.description}</p>

          {selectedListing.longDescription && (
            <div className="marketplace-detail__section">
              <h3>About</h3>
              <p className="marketplace-detail__long-desc">{selectedListing.longDescription}</p>
            </div>
          )}

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
              <span className="marketplace-detail__meta-label">License</span>
              <span className="marketplace-detail__meta-value">{selectedListing.license || "N/A"}</span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Downloads</span>
              <span className="marketplace-detail__meta-value">{selectedListing.downloads.toLocaleString()}</span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Rating</span>
              <span className="marketplace-detail__meta-value">
                {renderStars(selectedListing.rating)} ({selectedListing.ratingCount} ratings)
              </span>
            </div>
            <div className="marketplace-detail__meta-item">
              <span className="marketplace-detail__meta-label">Min Studio Version</span>
              <span className="marketplace-detail__meta-value">{selectedListing.minStudioVersion || "N/A"}</span>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="marketplace-detail__section">
              <h3>Tags</h3>
              <div className="marketplace-detail__tags">
                {tags.map((tag) => (
                  <span key={tag} className="marketplace-detail__tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {selectedListing.repositoryUrl && (
            <div className="marketplace-detail__section">
              <h3>Repository</h3>
              <a
                href={selectedListing.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="marketplace-detail__link"
              >
                {selectedListing.repositoryUrl}
              </a>
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
          <button
            className={`marketplace__tab ${view === "browse" ? "marketplace__tab--active" : ""}`}
            onClick={() => setView("browse")}
          >
            Browse
          </button>
          <button
            className={`marketplace__tab ${view === "featured" ? "marketplace__tab--active" : ""}`}
            onClick={() => setView("featured")}
          >
            Featured
          </button>
          <button
            className={`marketplace__tab ${view === "installed" ? "marketplace__tab--active" : ""}`}
            onClick={() => setView("installed")}
          >
            Installed
          </button>
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
        <input
          type="text"
          placeholder="Search listings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="marketplace__search"
        />
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
      </div>

      {/* Featured section (browse view only) */}
      {view === "browse" && featured.length > 0 && !searchQuery && activeCategory === "all" && (
        <div className="marketplace__section">
          <h3 className="marketplace__section-title">Featured</h3>
          <div className="marketplace__grid">{featured.map(renderListingCard)}</div>
        </div>
      )}

      {/* Main listing */}
      <div className="marketplace__section">
        <h3 className="marketplace__section-title">
          {view === "browse" ? "All Listings" : view === "featured" ? "Featured" : "Installed"}
        </h3>
        {listings.length === 0 ? (
          <div className="marketplace__empty">
            <p>No listings found.</p>
            <p style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
              {view === "installed"
                ? "Install listings from the Browse tab."
                : "Try adjusting your search or filters."}
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
