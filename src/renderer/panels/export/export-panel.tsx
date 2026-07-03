import { useCallback, useState, type CSSProperties, type ReactElement } from "react";

interface ExportOptions {
  format: "json" | "markdown";
  includeGraph: boolean;
  includeTimeline: boolean;
  includeComments: boolean;
  entityTypes: string[];
}

interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  entityCount: number;
}

const ENTITY_TYPES = ["production", "character", "scene", "shot", "asset", "document", "conversation", "prompt", "workflow"];

const cardStyle: CSSProperties = {
  padding: "12px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  marginBottom: "8px",
};

const btnStyle: CSSProperties = {
  padding: "8px 16px",
  background: "var(--accent)",
  border: "none",
  borderRadius: "4px",
  color: "#fff",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 600,
};

const selectStyle: CSSProperties = {
  padding: "6px 8px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--text)",
  fontSize: "13px",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  marginBottom: "4px",
};

const previewStyle: CSSProperties = {
  padding: "12px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  fontFamily: "monospace",
  fontSize: "12px",
  maxHeight: "400px",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

export default function ExportPanel(): ReactElement {
  const [options, setOptions] = useState<ExportOptions>({
    format: "markdown",
    includeGraph: true,
    includeTimeline: true,
    includeComments: false,
    entityTypes: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const toggleType = useCallback((type: string) => {
    setOptions((prev) => ({
      ...prev,
      entityTypes: prev.entityTypes.includes(type)
        ? prev.entityTypes.filter((t) => t !== type)
        : [...prev.entityTypes, type],
    }));
  }, []);

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await window.artworks.export.production(options);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }, [options]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.content);
    } catch {
      // fallback
    }
  }, [result]);

  return (
    <div style={{ padding: "16px", height: "100%", overflow: "auto" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: "16px" }}>Production Export</h2>

      <div style={cardStyle}>
        <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
          Format
        </label>
        <select
          style={selectStyle}
          value={options.format}
          onChange={(e) => setOptions((prev) => ({ ...prev, format: e.target.value as "json" | "markdown" }))}
        >
          <option value="markdown">Markdown (.md)</option>
          <option value="json">JSON (.json)</option>
        </select>
      </div>

      <div style={cardStyle}>
        <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
          Include
        </label>
        {([
          ["includeGraph", "Knowledge Graph relationships"],
          ["includeTimeline", "Timeline items"],
          ["includeComments", "Comments"],
        ] as const).map(([key, label]) => (
          <label key={key} style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) => setOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>

      <div style={cardStyle}>
        <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
          Entity Types {options.entityTypes.length > 0 ? `(${options.entityTypes.length} selected)` : "(all)"}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {ENTITY_TYPES.map((type) => (
            <label key={type} style={{
              ...checkboxRowStyle,
              padding: "2px 8px",
              background: options.entityTypes.includes(type) ? "var(--accent)" : "var(--bg-tertiary)",
              borderRadius: "12px",
              fontSize: "12px",
              cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={options.entityTypes.includes(type)}
                onChange={() => toggleType(type)}
                style={{ display: "none" }}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <button
        style={{ ...btnStyle, opacity: loading ? 0.6 : 1, width: "100%", marginBottom: "12px" }}
        onClick={handleExport}
        disabled={loading}
      >
        {loading ? "Exporting..." : "Export Production"}
      </button>

      {error && (
        <div style={{ padding: "8px 12px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "4px", color: "#dc2626", fontSize: "13px", marginBottom: "8px" }}>
          {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {result.filename} ({result.entityCount} entities, {result.content.length.toLocaleString()} chars)
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button style={{ ...btnStyle, padding: "4px 8px", fontSize: "12px", background: "var(--bg-tertiary)", color: "var(--text)", border: "1px solid var(--border)" }} onClick={handleCopy}>
                Copy
              </button>
              <button style={{ ...btnStyle, padding: "4px 8px", fontSize: "12px" }} onClick={handleDownload}>
                Download
              </button>
            </div>
          </div>
          <div style={previewStyle}>{result.content.slice(0, 5000)}{result.content.length > 5000 ? "\n\n... (truncated)" : ""}</div>
        </div>
      )}
    </div>
  );
}
