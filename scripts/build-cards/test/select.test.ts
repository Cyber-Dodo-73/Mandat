import { describe, expect, it } from 'vitest';
import { assignTiers, capFor, selectCards } from '../src/select.ts';
import type { Continent, Rarity } from '../src/types.ts';
import { scored } from './helpers.ts';

const noQuotas: Record<Continent, number> = { africa: 0, asia: 0, europe: 0, north_america: 0, south_america: 0, oceania: 0 };
const tiers = (counts: number[]) =>
  (['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as Rarity[]).map((rarity, i) => ({ rarity, count: counts[i] ?? 0 }));

describe('selectCards', () => {
  it('assigns rarity strictly by fame rank', () => {
    const pool = Array.from({ length: 12 }, (_, i) => scored({ continent: 'europe', rawScore: 100 - i }));
    const { cards } = selectCards(pool, noQuotas, 10, tiers([1, 1, 2, 2, 2, 2]));
    expect(cards.map((c) => c.rarity)).toEqual([
      'mythic', 'legendary', 'epic', 'epic', 'rare', 'rare', 'uncommon', 'uncommon', 'common', 'common',
    ]);
    expect(cards.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cards[0]?.rawScore).toBe(100);
  });

  it('pulls in quota candidates who would miss the cut on merit', () => {
    const europe = Array.from({ length: 10 }, (_, i) => scored({ continent: 'europe', rawScore: 100 - i }));
    const africa = [scored({ continent: 'africa', rawScore: 10 }), scored({ continent: 'africa', rawScore: 5 })];
    const { cards, warnings } = selectCards([...europe, ...africa], { ...noQuotas, africa: 2 }, 6, tiers([1, 1, 1, 1, 1, 1]));
    expect(warnings).toEqual([]);
    expect(cards.filter((c) => c.continent === 'africa')).toHaveLength(2);
    expect(cards.filter((c) => c.continent === 'europe').map((c) => c.rawScore)).toEqual([100, 99, 98, 97]);
    // Quota picks are ranked by fame like everyone else: they end up at the bottom.
    expect(cards.slice(-2).every((c) => c.continent === 'africa' && c.viaQuota)).toBe(true);
    expect(cards.at(-1)?.rarity).toBe('common');
  });

  it('fills by merit and warns when a continent is short of candidates', () => {
    const europe = Array.from({ length: 10 }, (_, i) => scored({ continent: 'europe', rawScore: 100 - i }));
    const oceania = [scored({ continent: 'oceania', rawScore: 1 })];
    const { cards, warnings } = selectCards([...europe, ...oceania], { ...noQuotas, oceania: 3 }, 6, tiers([1, 1, 1, 1, 1, 1]));
    expect(cards).toHaveLength(6);
    expect(cards.filter((c) => c.continent === 'oceania')).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('oceania');
  });

  it('does not mark merit picks as quota picks', () => {
    const pool = Array.from({ length: 8 }, (_, i) => scored({ continent: i % 2 ? 'asia' : 'europe', rawScore: 100 - i }));
    const { cards } = selectCards(pool, { ...noQuotas, asia: 2 }, 6, tiers([1, 1, 1, 1, 1, 1]));
    expect(cards.some((c) => c.viaQuota)).toBe(false);
  });

  it('rejects inconsistent configuration', () => {
    const pool = Array.from({ length: 5 }, (_, i) => scored({ continent: 'europe', rawScore: i }));
    expect(() => selectCards(pool, noQuotas, 5, tiers([1, 1, 1, 1, 1, 1]))).toThrow(/tiers/);
    expect(() => selectCards(pool, { ...noQuotas, europe: 9 }, 6, tiers([1, 1, 1, 1, 1, 1]))).toThrow(/quotas/);
    expect(() => selectCards(pool, noQuotas, 6, tiers([1, 1, 1, 1, 1, 1]))).toThrow(/candidates/);
  });
});

describe('assignTiers (country caps)', () => {
  const ranked = (countries: string[]) =>
    countries.map((country, i) => scored({ continent: 'europe', rawScore: 100 - i, country, qid: `C${i}` }));
  const rarityOf = (result: ReturnType<typeof assignTiers>, qid: string) => result.rarityByQid.get(qid);

  it('computes caps from absolute values or tier fractions', () => {
    expect(capFor({ max: 2 }, 10)).toBe(2);
    expect(capFor({ fraction: 0.2 }, 60)).toBe(12);
    expect(capFor({ fraction: 0.2 }, 7)).toBe(1);
    expect(capFor(undefined, 7)).toBe(Number.POSITIVE_INFINITY);
  });

  it('pushes the over-cap card to the next tier, keeping rank order', () => {
    const cards = ranked(['US', 'US', 'US', 'FR', 'GB', 'DE']);
    const result = assignTiers(cards, tiers([3, 3, 0, 0, 0, 0]), { mythic: { max: 2 } });
    expect(['C0', 'C1', 'C3'].map((q) => rarityOf(result, q))).toEqual(['mythic', 'mythic', 'mythic']);
    expect(['C2', 'C4', 'C5'].map((q) => rarityOf(result, q))).toEqual(['legendary', 'legendary', 'legendary']);
    expect(result.pushes).toEqual([expect.objectContaining({ qid: 'C2', country: 'US', from: 'mythic', to: 'legendary' })]);
  });

  it('cascades a card through several tiers', () => {
    // Every tier allows one US card; the third US card falls two tiers.
    const cards = ranked(['US', 'US', 'US', 'FR', 'GB', 'DE']);
    const one = { max: 1 };
    const result = assignTiers(cards, tiers([2, 2, 2, 0, 0, 0]), { mythic: one, legendary: one, epic: one });
    expect(rarityOf(result, 'C0')).toBe('mythic');
    expect(rarityOf(result, 'C1')).toBe('legendary');
    expect(rarityOf(result, 'C2')).toBe('epic');
    expect(result.pushes.map((p) => [p.qid, p.from, p.to])).toEqual([
      ['C1', 'mythic', 'legendary'],
      ['C2', 'legendary', 'epic'], // rank 3 would be legendary without caps
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('fills a tier exactly when the cap is reached on its last slot', () => {
    const cards = ranked(['US', 'FR', 'US', 'GB']);
    const result = assignTiers(cards, tiers([3, 1, 0, 0, 0, 0]), { mythic: { max: 2 } });
    expect(['C0', 'C1', 'C2'].map((q) => rarityOf(result, q))).toEqual(['mythic', 'mythic', 'mythic']);
    expect(rarityOf(result, 'C3')).toBe('legendary');
    expect(result.pushes).toEqual([]);
  });

  it('completes a tier with over-cap cards and warns when diversity is impossible', () => {
    const cards = ranked(['US', 'US', 'US', 'US']);
    const result = assignTiers(cards, tiers([2, 2, 0, 0, 0, 0]), { mythic: { max: 1 } });
    expect(['C0', 'C1'].map((q) => rarityOf(result, q))).toEqual(['mythic', 'mythic']);
    expect(result.warnings[0]).toMatch(/mythic/);
  });

  it('lets the last tier take everyone left and reports cap overflow', () => {
    const cards = ranked(['FR', 'US', 'US', 'US']);
    const result = assignTiers(cards, tiers([0, 0, 0, 0, 1, 3]), { uncommon: { max: 1 }, common: { max: 2 } });
    expect(rarityOf(result, 'C0')).toBe('uncommon');
    expect(['C1', 'C2', 'C3'].map((q) => rarityOf(result, q))).toEqual(['common', 'common', 'common']);
    expect(result.warnings.some((w) => w.includes('common') && w.includes('US'))).toBe(true);
  });

  it('numbers cards by rarity then fame rank after pushes', () => {
    const pool = ranked(['US', 'US', 'US', 'FR', 'GB', 'DE']);
    const { cards, pushes } = selectCards(pool, noQuotas, 6, tiers([3, 3, 0, 0, 0, 0]), { mythic: { max: 2 } });
    expect(cards.map((c) => [c.number, c.rank, c.rarity])).toEqual([
      [1, 1, 'mythic'], [2, 2, 'mythic'], [3, 4, 'mythic'],
      [4, 3, 'legendary'], [5, 5, 'legendary'], [6, 6, 'legendary'],
    ]);
    expect(pushes.map((p) => [p.qid, p.rank])).toEqual([['C2', 3]]);
  });
});
