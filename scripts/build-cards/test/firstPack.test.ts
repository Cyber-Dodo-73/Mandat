import { describe, expect, it } from 'vitest';
import { checkFirstPack, FIRST_PACK_RULES } from '../src/firstPack.ts';
import type { Continent, Era, Rarity } from '../src/types.ts';

const card = (rarity: Rarity, continent: Continent, era: Era, sensitive = false) => ({ rarity, continent, era, sensitive });

describe('checkFirstPack', () => {
  it('finds a valid pack in a minimal catalog', () => {
    const cards = [
      card('epic', 'europe', 'antiquity'),
      card('rare', 'asia', 'medieval'),
      card('uncommon', 'africa', 'modern'),
      card('common', 'north_america', 'contemporary'),
      card('common', 'south_america', 'contemporary'),
    ];
    const result = checkFirstPack(cards);
    expect(result.feasible).toBe(true);
    expect(result.patterns).toBeGreaterThan(0);
  });

  it('never uses sensitive cards', () => {
    const cards = [
      card('mythic', 'europe', 'antiquity', true),
      card('rare', 'asia', 'medieval'),
      card('uncommon', 'africa', 'modern'),
      card('common', 'north_america', 'contemporary'),
      card('common', 'south_america', 'contemporary'),
    ];
    expect(checkFirstPack(cards).feasible).toBe(false);
  });

  it('requires distinct continents and at least three eras', () => {
    const sameEra = [
      card('epic', 'europe', 'contemporary'),
      card('rare', 'asia', 'contemporary'),
      card('uncommon', 'africa', 'contemporary'),
      card('common', 'north_america', 'contemporary'),
      card('common', 'south_america', 'modern'),
    ];
    expect(checkFirstPack(sameEra).feasible).toBe(false);
    const sameContinent = [
      card('epic', 'europe', 'antiquity'),
      card('rare', 'asia', 'medieval'),
      card('uncommon', 'africa', 'modern'),
      card('common', 'europe', 'contemporary'),
      card('common', 'south_america', 'contemporary'),
    ];
    expect(checkFirstPack(sameContinent).feasible).toBe(false);
  });

  it('has the shape the API loader expects', () => {
    expect(JSON.parse(JSON.stringify(FIRST_PACK_RULES))).toEqual({
      slots: [
        { rarities: ['epic', 'legendary', 'mythic'], count: 1 },
        { rarities: ['rare', 'uncommon'], count: 2 },
        { rarities: ['common'], count: 2 },
      ],
      distinctContinents: 5,
      minDistinctEras: 3,
      excludeSensitive: true,
    });
  });
});
