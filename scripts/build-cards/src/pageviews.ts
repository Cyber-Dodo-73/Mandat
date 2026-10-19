import { PAGEVIEW_CONCURRENCY, PAGEVIEW_START } from './config.ts';
import { getJson, mapConcurrent } from './http.ts';
import type { Candidate } from './types.ts';

type PageviewsResponse = { items?: Array<{ views: number }> };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * From `start` (default: the API's first month) to the last full calendar month before
 * `asOf` (UTC), as API timestamps.
 */
export function pageviewWindow(
  asOf: Date,
  start: { year: number; month: number } = PAGEVIEW_START,
): { start: string; end: string } {
  const startDate = new Date(Date.UTC(start.year, start.month - 1, 1));
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 0)); // last day of previous month
  const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}00`;
  return { start: fmt(startDate), end: fmt(end) };
}

/** Sums human (agent=user) monthly views on English Wikipedia for each candidate. */
export async function fetchPageviews(
  candidates: readonly Candidate[],
  asOf: Date,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, number>> {
  const { start, end } = pageviewWindow(asOf);
  const withArticle = candidates.filter((c) => c.enwikiTitle);
  const totals = await mapConcurrent(
    withArticle,
    PAGEVIEW_CONCURRENCY,
    async (c) => {
      const title = encodeURIComponent((c.enwikiTitle as string).replace(/ /g, '_'));
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${title}/monthly/${start}/${end}`;
      const res = await getJson<PageviewsResponse>('pageviews', url, { notFoundValue: { items: [] } });
      return (res.items ?? []).reduce((sum, item) => sum + item.views, 0);
    },
    onProgress,
  );
  return new Map(withArticle.map((c, i) => [c.qid, totals[i] ?? 0]));
}
