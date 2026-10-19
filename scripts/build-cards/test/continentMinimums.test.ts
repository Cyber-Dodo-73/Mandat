import { describe, expect, it } from 'vitest';
import { enforceContinentMinimums, selectCards } from '../src/select.ts';
import type { Continent, Rarity } from '../src/types.ts';
import { scored } from './helpers.ts';

const noQuotas: Record<Continent, number> = { africa: 0, asia: 0, europe: 0, north_america: 0, south_america: 0, oceania: 0 };
const tiers = (counts: number[]) =>
  (['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as Rarity[]).map((rarity, i) => ({ rarity, count: counts[i] ?? 0 }));

describe('continent minimums', () => {
  it('promotes the best card of the continent and cascades the others down', () => {
    const europe = Array.from({ length: 8 }, (_, i) => scored({ continent: 'europe', rawScore: 100 - i }));
    const sa = [scored({ continent: 'south_america', rawScore: 50 }), scored({ continent: 'south_america', rawScore: 40 })];
    const { cards, promotions } = selectCards([...europe, ...sa], noQuotas, 10, tiers([1, 1, 2, 2, 2, 2]), {}, {
      continentMinimums: [{ continent: 'south_america', atLeast: 'legendary', count: 1 }],
    });
    const best = cards.find((c) => c.qid === sa[0]?.qid);
    expect(best?.rarity).toBe('legendary');
    // Tier sizes never change.
    const count = (r: Rarity) => cards.filter((c) => c.rarity === r).length;
    expect([count('mythic'), count('legendary'), count('epic'), count('rare'), count('uncommon'), count('common')]).toEqual([1, 1, 2, 2, 2, 2]);
    // The former legendary (rank 2) was pushed to epic, and each tier down gave up its lowest card.
    expect(cards.find((c) => c.qid === europe[1]?.qid)?.rarity).toBe('epic');
    expect(promotions.find((p) => p.qid === sa[0]?.qid)).toMatchObject({ reason: 'promoted', from: 'common', to: 'legendary' });
    expect(promotions.filter((p) => p.reason === 'demoted').length).toBeGreaterThan(0);
  });

  it('applies rarer minimums first and never demotes a card a minimum needs', () => {
    const europe = Array.from({ length: 6 }, (_, i) => scored({ continent: 'europe', rawScore: 100 - i }));
    const africa = Array.from({ length: 4 }, (_, i) => scored({ continent: 'africa', rawScore: 30 - i }));
    const { cards } = selectCards([...europe, ...africa], noQuotas, 10, tiers([1, 1, 2, 2, 2, 2]), {}, {
      continentMinimums: [
        { continent: 'africa', atLeast: 'epic', count: 2 },
        { continent: 'africa', atLeast: 'legendary', count: 1 },
      ],
    });
    const africanTiers = cards.filter((c) => c.continent === 'africa').map((c) => c.rarity);
    expect(africanTiers.filter((r) => r === 'legendary' || r === 'mythic')).toHaveLength(1);
    expect(africanTiers.filter((r) => ['mythic', 'legendary', 'epic'].includes(r))).toHaveLength(2);
  });

  it('is a no-op when the minimum already holds, and warns when it cannot be met', () => {
    const pool = [scored({ continent: 'oceania', rawScore: 99 }), ...Array.from({ length: 5 }, (_, i) => scored({ continent: 'europe', rawScore: 50 - i }))];
    const rarity = new Map(pool.map((c, i) => [c.qid, (i === 0 ? 'mythic' : 'common') as Rarity]));
    const t = tiers([1, 0, 0, 0, 0, 5]);
    expect(enforceContinentMinimums(pool, rarity, t, [{ continent: 'oceania', atLeast: 'mythic', count: 1 }]).promotions).toEqual([]);
    const { warnings } = enforceContinentMinimums(pool, rarity, t, [{ continent: 'asia', atLeast: 'mythic', count: 1 }]);
    expect(warnings[0]).toContain('asia');
  });

  it('selects must-include figures in place of the lowest merit picks, not of quota picks', () => {
    const europe = Array.from({ length: 10 }, (_, i) => scored({ continent: 'europe', rawScore: 100 - i }));
    const africa = [scored({ continent: 'africa', rawScore: 5 })];
    const forced = scored({ continent: 'europe', rawScore: 1 });
    const { cards } = selectCards([...europe, ...africa, forced], { ...noQuotas, africa: 1 }, 6, tiers([1, 1, 1, 1, 1, 1]), {}, {
      mustInclude: new Set([forced.qid]),
    });
    expect(cards.some((c) => c.qid === forced.qid && c.mustInclude && !c.viaQuota)).toBe(true);
    expect(cards.some((c) => c.continent === 'africa')).toBe(true);
    expect(cards.filter((c) => c.continent === 'europe')).toHaveLength(5);
  });
});
