import { describe, expect, it } from 'vitest';
import { rawFame, scoreCandidates } from '../src/score.ts';
import type { ResolvedCandidate } from '../src/types.ts';
import { scored } from './helpers.ts';

const resolved = (qid: string, sitelinks: number): ResolvedCandidate => {
  const { pageviews: _p, rawScore: _r, fameScore: _f, ...rest } = scored({ continent: 'europe', rawScore: 0 });
  return { ...rest, qid, sitelinks };
};

describe('rawFame', () => {
  it('weights log10 pageviews 0.4 and log10 sitelinks 0.6', () => {
    expect(rawFame(1_000_000, 100)).toBeCloseTo(0.4 * 6 + 0.6 * 2);
  });

  it('treats zero pageviews or sitelinks as log10(1) = 0', () => {
    expect(rawFame(0, 0)).toBe(0);
    expect(Number.isFinite(rawFame(0, 10))).toBe(true);
  });
});

describe('scoreCandidates', () => {
  it('normalizes to 0–100 and sorts by fame', () => {
    const pool = [resolved('Q1', 10), resolved('Q2', 100), resolved('Q3', 50)];
    const views = new Map([['Q1', 100], ['Q2', 1_000_000], ['Q3', 10_000]]);
    const result = scoreCandidates(pool, views);
    expect(result.map((c) => c.qid)).toEqual(['Q2', 'Q3', 'Q1']);
    expect(result[0]?.fameScore).toBe(100);
    expect(result[2]?.fameScore).toBe(0);
    expect(result[1]?.fameScore).toBeGreaterThan(0);
    expect(result[1]?.fameScore).toBeLessThan(100);
  });

  it('handles a pool where everyone has the same score', () => {
    const result = scoreCandidates([resolved('Q1', 10), resolved('Q2', 10)], new Map());
    expect(result.every((c) => c.fameScore === 100)).toBe(true);
  });

  it('breaks ties deterministically', () => {
    const a = scoreCandidates([resolved('Q2', 10), resolved('Q1', 10)], new Map());
    expect(a.map((c) => c.qid)).toEqual(['Q1', 'Q2']);
  });
});
