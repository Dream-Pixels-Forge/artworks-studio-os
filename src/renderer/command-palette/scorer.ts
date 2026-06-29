/**
 * Fuzzy scorer for the command palette.
 *
 * Hand-rolled (no fuse.js): confirms the query is a subsequence of the title
 * and scores by contiguous matches, word-boundary starts, and acronym hits,
 * with a frecency boost so recently-run commands rank higher on ties.
 */
import type { PaletteCommand } from "@shared/palette/command.js";

/** Returns a score (higher = better), or null if query doesn't match. */
export function scoreCommand(
  command: PaletteCommand,
  query: string,
  recency: number,
): number | null {
  if (!query) return 100 + recency; // empty query: recency order

  const haystack = haystackFor(command);
  const sub = subsequenceScore(query, haystack);
  if (sub === null) return null;

  return sub + recency;
}

function haystackFor(command: PaletteCommand): string {
  const parts = [
    command.title,
    command.id,
    command.category ?? "",
    ...(command.keywords ?? []),
  ];
  return parts.join(" ").toLowerCase();
}

/** Word-boundary characters. A match right after one is a boundary hit. */
const BOUNDARY = /[\s\-_/.]/;

/**
 * Subsequence matcher with contiguous/boundary scoring. Returns null if the
 * query chars don't appear in order in the haystack.
 */
function subsequenceScore(query: string, haystack: string): number | null {
  const q = query.toLowerCase();
  let score = 0;
  let lastIdx = -1;
  let qi = 0;

  for (let hi = 0; hi < haystack.length && qi < q.length; hi++) {
    if (haystack[hi] !== q[qi]) continue;
    qi++;

    if (lastIdx === hi - 1) {
      // Contiguous with the previous matched char.
      score += 8;
    } else if (lastIdx === -1 || BOUNDARY.test(haystack[hi - 1] ?? "")) {
      // Start of the match, or right after a word boundary.
      score += 6;
    } else {
      // Scattered mid-word match.
      score += 1;
    }
    lastIdx = hi;
  }

  return qi === q.length ? score : null;
}
