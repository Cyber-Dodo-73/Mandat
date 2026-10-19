import { RARITIES } from '@/theme/rarity';

import { allCards, cardsByRarity, firstSensitiveCard, getCard, sampleCards, seasonSize } from '../catalog';

describe('card catalog', () => {
  it('loads the season sorted by collector number with unique ids', () => {
    expect(seasonSize).toBe(allCards.length);
    expect(seasonSize).toBeGreaterThan(0);
    const numbers = allCards.map((card) => card.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(allCards.map((card) => card.id)).size).toBe(allCards.length);
  });

  it('looks cards up by id', () => {
    const first = allCards[0]!;
    expect(getCard(first.id)).toBe(first);
    expect(getCard('s1-does-not-exist')).toBeUndefined();
  });

  it('gives every card bilingual text and stats between 1 and 10', () => {
    for (const card of allCards) {
      expect(card.name.fr.length).toBeGreaterThan(0);
      expect(card.name.en.length).toBeGreaterThan(0);
      for (const value of Object.values(card.stats)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it('filters by rarity and samples one non-sensitive card per rarity', () => {
    for (const rarity of RARITIES) {
      expect(cardsByRarity(rarity).every((card) => card.rarity === rarity)).toBe(true);
    }
    const samples = sampleCards();
    expect(samples.map((sample) => sample.rarity)).toEqual([...RARITIES]);
    expect(samples.every((sample) => !sample.card.sensitive)).toBe(true);
    const sensitive = firstSensitiveCard();
    if (sensitive) expect(sensitive.sensitive).toBe(true);
  });
});
