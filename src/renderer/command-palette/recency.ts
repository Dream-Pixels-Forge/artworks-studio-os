/**
 * Recency tracking for the command palette.
 *
 * Records when each command was last run, persisted to localStorage so it
 * survives restarts. Capped to avoid unbounded growth.
 */
const STORAGE_KEY = "artworks.palette.recency";
const MAX_ENTRIES = 50;

/** Load the recency map { commandId: timestamp }. */
export function loadRecency(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Record that a command was just run. */
export function recordUse(id: string): void {
  try {
    const recency = loadRecency();
    recency[id] = Date.now();
    // Trim oldest beyond the cap.
    const entries = Object.entries(recency).sort((a, b) => b[1] - a[1]);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* best effort — sandbox/storage can throw */
  }
}

/** Compute a recency weight (0..~50) for frecency boosting. */
export function recencyWeight(id: string): number {
  const recency = loadRecency();
  const ts = recency[id];
  if (!ts) return 0;
  const ageDays = (Date.now() - ts) / 86_400_000;
  return Math.max(0, 50 - ageDays * 5);
}
