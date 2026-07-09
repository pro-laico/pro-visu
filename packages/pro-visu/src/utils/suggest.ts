/** Levenshtein edit distance — small inputs only (CLI names), so the simple DP is fine. */
function editDistance(a: string, b: string): number {
  const cols = b.length + 1;
  const dist: number[] = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dist[0] ?? 0;
    dist[0] = i;
    for (let j = 1; j < cols; j++) {
      const tmp = dist[j] ?? 0;
      dist[j] = Math.min((dist[j] ?? 0) + 1, (dist[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dist[cols - 1] ?? 0;
}

/**
 * The candidate closest to `input` (case-insensitive), or undefined when nothing is close enough
 * to plausibly be a typo (distance capped relative to the input length).
 */
export function closestMatch(input: string, candidates: Iterable<string>): string | undefined {
  const needle = input.toLowerCase();
  let best: string | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = editDistance(needle, candidate.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  const threshold = Math.max(2, Math.floor(input.length / 3));
  return bestDist <= threshold ? best : undefined;
}

/** Format a `did you mean` hint, or an empty string when there's no plausible match. */
export function didYouMean(input: string, candidates: Iterable<string>): string {
  const match = closestMatch(input, candidates);
  return match ? ` (did you mean "${match}"?)` : "";
}
