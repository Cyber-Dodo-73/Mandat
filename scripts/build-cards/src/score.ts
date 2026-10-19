import { FAME_WEIGHTS } from './config.ts';
import type { ResolvedCandidate, ScoredCandidate } from './types.ts';

/** log10 guarded so that 0 (no article, no views) maps to 0 instead of -Infinity. */
const safeLog10 = (value: number) => Math.log10(Math.max(1, value));

export function rawFame(pageviews: number, sitelinks: number): number {
  return FAME_WEIGHTS.pageviews * safeLog10(pageviews) + FAME_WEIGHTS.sitelinks * safeLog10(sitelinks);
}

/** Total order on fame: score, then sitelinks, then pageviews, then QID for determinism. */
export function compareFame(a: ScoredCandidate, b: ScoredCandidate): number {
  return (
    b.rawScore - a.rawScore ||
    b.sitelinks - a.sitelinks ||
    b.pageviews - a.pageviews ||
    a.qid.localeCompare(b.qid, 'en')
  );
}

/**
 * Computes fameScore = 0.7·log10(pageviews) + 0.3·log10(sitelinks), min-max normalized to
 * 0–100 over the whole candidate pool. Normalization is a monotonic transform, so it never
 * changes the ranking; it only makes scores readable. Returns candidates sorted by fame.
 */
export function scoreCandidates(
  candidates: readonly ResolvedCandidate[],
  pageviews: ReadonlyMap<string, number>,
): ScoredCandidate[] {
  const withRaw = candidates.map((c) => {
    const views = pageviews.get(c.qid) ?? 0;
    return { ...c, pageviews: views, rawScore: rawFame(views, c.sitelinks), fameScore: 0 };
  });
  if (withRaw.length === 0) return [];
  const min = Math.min(...withRaw.map((c) => c.rawScore));
  const max = Math.max(...withRaw.map((c) => c.rawScore));
  const span = max - min;
  for (const c of withRaw) {
    c.fameScore = span === 0 ? 100 : Math.round(((c.rawScore - min) / span) * 10000) / 100;
  }
  return withRaw.sort(compareFame);
}
