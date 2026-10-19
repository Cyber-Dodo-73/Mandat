import { describe, expect, it } from 'vitest';
import { countSentences, spearman, validateCatalogBalance, validateContent, validateEffect } from '../src/content.ts';
import type { Rarity, Stats } from '../src/types.ts';

const valid = {
  wikidataId: 'Q8023',
  bio: {
    fr: "Avocat et militant, il dirige la lutte contre l'apartheid en Afrique du Sud. Emprisonné pendant 27 ans, il devient en 1994 le premier président élu au suffrage universel.",
    en: 'A lawyer and activist, he led the struggle against apartheid in South Africa. Imprisoned for 27 years, he became the first president elected by universal suffrage in 1994.',
  },
  stats: { influence: 9, diplomacy: 10, charisma: 9, strategy: 7 },
  ability: {
    name: { fr: 'Réconciliation', en: 'Reconciliation' },
    description: { fr: '+2 en Diplomatie face à une carte du même continent.', en: '+2 Diplomacy against a card from the same continent.' },
    effect: { type: 'bonus', stat: 'diplomacy', amount: 2, condition: { kind: 'opponentContinent', value: 'same' } },
  },
};

describe('countSentences', () => {
  it('counts simple sentences', () => {
    expect(countSentences('One. Two! Three?')).toBe(3);
  });

  it('ignores abbreviations and initials', () => {
    expect(countSentences('Né en 356 av. J.-C. en Macédoine, il conquiert un empire. Il meurt à Babylone.')).toBe(2);
    expect(countSentences('F. D. Roosevelt led the U.S. through the war. He died in 1945.')).toBe(2);
  });
});

describe('validateContent', () => {
  it('accepts valid content', () => {
    expect(validateContent(valid, 'Q8023', false)).toEqual([]);
  });

  it('rejects a mismatched id, bad stats and short bios', () => {
    const errors = validateContent(
      { ...valid, wikidataId: 'Q1', stats: { influence: 0, diplomacy: 11, charisma: 5.5, strategy: 5 }, bio: { fr: 'Court.', en: 'Short.' } },
      'Q8023',
      false,
    );
    expect(errors.some((e) => e.startsWith('wikidataId'))).toBe(true);
    expect(errors.filter((e) => e.startsWith('stats.'))).toHaveLength(3);
    expect(errors.some((e) => e.startsWith('bio.fr') && e.includes('sentences'))).toBe(true);
  });

  it('caps stats for sensitive cards', () => {
    const errors = validateContent(valid, 'Q8023', true);
    expect(errors.some((e) => e.includes('stats.diplomacy') && e.includes('sensitive'))).toBe(true);
    expect(errors.some((e) => e.includes('stats.influence'))).toBe(true);
  });

  it('rejects unknown and missing fields', () => {
    const { ability: _a, ...withoutAbility } = valid;
    expect(validateContent({ ...withoutAbility, extra: 1 }, 'Q8023', false)).toEqual(
      expect.arrayContaining(['ability: expected { name, description }', 'unknown keys: extra']),
    );
  });
});

describe('validateCatalogBalance', () => {
  const rarities: Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  const stat = (n: number): Stats => ({ influence: n, diplomacy: n, charisma: n, strategy: n });

  it('flags stats that follow rarity', () => {
    const cards = Array.from({ length: 60 }, (_, i) => ({
      wikidataId: `Q${i}`,
      rarity: rarities[Math.floor(i / 10)] as Rarity,
      stats: stat(10 - Math.floor(i / 10)),
      sensitive: false,
    }));
    expect(validateCatalogBalance(cards)[0]).toMatch(/correlate/);
  });

  it('accepts stats independent of rarity', () => {
    const cards = Array.from({ length: 60 }, (_, i) => ({
      wikidataId: `Q${i}`,
      rarity: rarities[Math.floor(i / 10)] as Rarity,
      stats: stat((i % 7) + 2),
      sensitive: false,
    }));
    expect(validateCatalogBalance(cards)).toEqual([]);
  });

  it('keeps sensitive cards below the best regular card', () => {
    const cards = [
      { wikidataId: 'Q1', rarity: 'mythic' as Rarity, stats: stat(8), sensitive: true },
      { wikidataId: 'Q2', rarity: 'common' as Rarity, stats: stat(8), sensitive: false },
    ];
    expect(validateCatalogBalance(cards)[0]).toMatch(/Q1: sensitive/);
  });
});

describe('spearman', () => {
  it('is 1 for identical orderings and -1 for reversed', () => {
    expect(spearman([1, 2, 3], [10, 20, 30])).toBeCloseTo(1);
    expect(spearman([1, 2, 3], [30, 20, 10])).toBeCloseTo(-1);
  });
});

describe('validateEffect', () => {
  it('accepts a conditional bonus and a tie breaker', () => {
    expect(validateEffect({ type: 'bonus', stat: 'any', amount: 3, condition: { kind: 'round', value: 3 } })).toEqual([]);
    expect(validateEffect({ type: 'tieBreaker', condition: { kind: 'behind' } })).toEqual([]);
  });

  it('rejects unknown conditions, bad amounts and strong unconditional effects', () => {
    expect(validateEffect({ type: 'bonus', stat: 'charisma', amount: 2, condition: { kind: 'always' } })).toHaveLength(1);
    expect(validateEffect({ type: 'malus', stat: 'strategy', amount: 4, condition: { kind: 'behind' } })).toHaveLength(1);
    expect(validateEffect({ type: 'bonus', stat: 'diplomacy', amount: 1, condition: { kind: 'weather' } })).toHaveLength(1);
    expect(validateEffect({ type: 'bonus', stat: 'diplomacy', amount: 1, condition: { kind: 'opponentEra', value: 'future' } })).toHaveLength(1);
  });
});
