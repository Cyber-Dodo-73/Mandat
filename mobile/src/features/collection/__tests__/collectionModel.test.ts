import type { Card } from '@/types/card';

import {
  buildEntries,
  collectionProgress,
  countActiveFilters,
  EMPTY_FILTERS,
  filterEntries,
  normalizeSearch,
  sortEntries,
  toggleValue,
  type OwnedItem,
} from '../collectionModel';
import { FALLBACK_RULES, craftCostPreview, recyclePreview, type EconomyRules } from '../economy';

function card(partial: Partial<Card> & Pick<Card, 'id' | 'number'>): Card {
  return {
    wikidataId: `Q${partial.number}`,
    name: { fr: `Carte ${partial.number}`, en: `Card ${partial.number}` },
    role: { fr: '', en: '' },
    country: 'FR',
    continent: 'europe',
    era: 'modern',
    birthYear: 1800,
    deathYear: 1850,
    isLiving: false,
    fameScore: 50,
    rarity: 'common',
    bio: { fr: '', en: '' },
    stats: { influence: 5, diplomacy: 5, charisma: 5, strategy: 5 },
    ability: { name: { fr: '', en: '' }, description: { fr: '', en: '' } },
    sensitive: false,
    ...partial,
  };
}

const cards: Card[] = [
  card({ id: 's1-001', number: 1, rarity: 'mythic', name: { fr: 'Élisabeth II', en: 'Elizabeth II' }, era: 'contemporary' }),
  card({ id: 's1-002', number: 2, rarity: 'common', continent: 'africa', name: { fr: 'Nelson Mandela', en: 'Nelson Mandela' } }),
  card({ id: 's1-003', number: 3, rarity: 'rare', continent: 'asia', era: 'antiquity', name: { fr: 'Ashoka', en: 'Ashoka' } }),
  card({ id: 's1-004', number: 4, rarity: 'epic', continent: 'africa', name: { fr: 'Thomas Sankara', en: 'Thomas Sankara' } }),
];

const item = (cardId: string, finish: OwnedItem['finish'], quantity: number, first: string): OwnedItem => ({
  cardId,
  finish,
  quantity,
  firstObtainedAt: first,
  lastObtainedAt: first,
});

const items: OwnedItem[] = [
  item('s1-002', 'standard', 3, '2026-10-01T10:00:00.123456789Z'),
  item('s1-002', 'holo', 1, '2026-10-05T10:00:00Z'),
  item('s1-003', 'gold', 1, '2026-10-10T10:00:00.5Z'),
];

describe('buildEntries', () => {
  const entries = buildEntries(cards, items);

  it('keeps every catalog card and merges finishes of owned ones', () => {
    expect(entries).toHaveLength(4);
    const mandela = entries.find((entry) => entry.card.id === 's1-002')!;
    expect(mandela.owned).toBe(true);
    expect(mandela.copies).toBe(4);
    expect(mandela.bestFinish).toBe('holo');
    expect(mandela.finishes).toEqual(['holo', 'standard']);
    expect(mandela.firstObtainedAt).toBe(Date.parse('2026-10-01T10:00:00.123Z'));
  });

  it('marks missing cards', () => {
    const missing = entries.find((entry) => entry.card.id === 's1-001')!;
    expect(missing).toMatchObject({ owned: false, copies: 0, firstObtainedAt: null, finishes: [] });
  });
});

describe('filterEntries', () => {
  const entries = buildEntries(cards, items);
  const ids = (list: { card: Card }[]) => list.map((entry) => entry.card.id);

  it('filters by ownership, rarity, continent, era and finish', () => {
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, ownership: 'owned' }, ''))).toEqual(['s1-002', 's1-003']);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, ownership: 'missing' }, ''))).toEqual(['s1-001', 's1-004']);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, rarities: ['rare', 'epic'] }, ''))).toEqual(['s1-003', 's1-004']);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, continents: ['africa'] }, ''))).toEqual(['s1-002', 's1-004']);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, eras: ['antiquity'] }, ''))).toEqual(['s1-003']);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, finishes: ['gold'] }, ''))).toEqual(['s1-003']);
  });

  it('searches FR and EN names, ignoring case and accents', () => {
    expect(ids(filterEntries(entries, EMPTY_FILTERS, 'elisabeth'))).toEqual(['s1-001']);
    expect(ids(filterEntries(entries, EMPTY_FILTERS, 'ELIZABETH'))).toEqual(['s1-001']);
    expect(ids(filterEntries(entries, EMPTY_FILTERS, '  mandela '))).toEqual(['s1-002']);
    expect(normalizeSearch('Égypte Ñ')).toBe('egypte n');
  });
});

describe('sortEntries', () => {
  const entries = buildEntries(cards, items);
  const ids = (list: { card: Card }[]) => list.map((entry) => entry.card.id);

  it('sorts by number, by rarity (mythic first) and by obtention (newest first, missing last)', () => {
    expect(ids(sortEntries([...entries].reverse(), 'number'))).toEqual(['s1-001', 's1-002', 's1-003', 's1-004']);
    expect(ids(sortEntries(entries, 'rarity'))).toEqual(['s1-001', 's1-004', 's1-003', 's1-002']);
    expect(ids(sortEntries(entries, 'obtained'))).toEqual(['s1-003', 's1-002', 's1-001', 's1-004']);
  });
});

describe('collectionProgress', () => {
  it('computes global, per continent and per era completion', () => {
    const progress = collectionProgress(buildEntries(cards, items));
    expect(progress.global).toEqual({ owned: 2, total: 4, ratio: 0.5 });
    expect(progress.byContinent.africa).toEqual({ owned: 1, total: 2, ratio: 0.5 });
    expect(progress.byContinent.oceania).toEqual({ owned: 0, total: 0, ratio: 0 });
    expect(progress.byEra.antiquity).toEqual({ owned: 1, total: 1, ratio: 1 });
  });
});

describe('filter helpers and economy preview', () => {
  it('counts active filters and toggles values', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, rarities: ['rare'], ownership: 'missing' })).toBe(2);
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('previews recycling and crafting from the server rules', () => {
    // 10 duplicates of a rarity = 1 craft of that rarity; finish multipliers on recycling only.
    expect(recyclePreview(FALLBACK_RULES, 'rare', 'holo', 2)).toBe(200);
    expect(recyclePreview(FALLBACK_RULES, 'mythic', 'gold', 1)).toBe(4000);
    expect(craftCostPreview(FALLBACK_RULES, 'epic')).toBe(1200);
    expect(recyclePreview(FALLBACK_RULES, 'common', 'standard', 10)).toBe(craftCostPreview(FALLBACK_RULES, 'common'));
    const server: EconomyRules = {
      ...FALLBACK_RULES,
      rarities: FALLBACK_RULES.rarities.map((r) => (r.rarity === 'epic' ? { ...r, craftCost: 999 } : r)),
    };
    expect(craftCostPreview(server, 'epic')).toBe(999);
  });
});
