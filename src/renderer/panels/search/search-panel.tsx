/**
 * Search panel.
 *
 * Full-text search across all entities via FTS5. Results show
 * entity name, type, id, and status. Uses the production IPC bridge.
 */
import { useState, type FormEvent } from "react";
import { panelRegistry } from "../../workspace/registry.js";

interface SearchResult {
  uuid: string;
  id: string;
  name: string;
  type: string;
  status: string;
}

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function doSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const found = await window.artworks.production.search(query);
    setResults(found as SearchResult[]);
    setSearched(true);
  }

  return (
    <div className="search-panel">
      <h2 className="search-panel__title">Search</h2>
      <form className="search-panel__form" onSubmit={doSearch}>
        <input
          className="search-panel__input"
          placeholder="Search entities..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button className="search-panel__btn" type="submit">
          Search
        </button>
      </form>
      <ul className="search-panel__results">
        {results.length === 0 && searched && (
          <p className="search-panel__empty">No results.</p>
        )}
        {results.length === 0 && !searched && (
          <p className="search-panel__hint">Type a query and press Search.</p>
        )}
        {results.map((r) => (
          <li key={r.uuid} className="search-panel__result">
            <span className="search-panel__result-name">{r.name}</span>
            <span className="search-panel__result-type">{r.type}</span>
            <span className="search-panel__result-id">{r.id}</span>
            <span className="search-panel__result-status">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

panelRegistry.register({
  id: "search",
  title: "Search",
  icon: "\u{1f50d}", // 🔍
  component: SearchPanel,
  defaultSlot: "center",
  defaultVisible: false,
});