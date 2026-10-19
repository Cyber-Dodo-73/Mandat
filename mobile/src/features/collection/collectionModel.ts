import { parseInstant } from '@/lib/time';
import { RARITIES, type Rarity } from '@/theme/rarity';
import type { Card, CardFinish, Continent, Era } from '@/types/card';

/** One owned copy group as the API returns it (card + finish). */
export type OwnedItem = {
  cardId: string;
  finish: CardFinish;
  quantity: number;
  firstObtainedAt: string;
  lastObtainedAt: string;
};

/** A catalog card seen through the player's collection. */
export type CollectionEntry = {
  card: Card;
  owned: boolean;
  /** Most special finish owned, shown on the grid. */
  bestFinish: CardFinish;
  /** All finishes owned. */
  finishes: readonly CardFinish[];
  copies: number;
  /** Epoch ms of the first copy, null when not owned. */
  firstObtainedAt: number | null;
};

export type Ownership = 'all' | 'owned' | 'missing';
export type SortKey = 'number' | 'rarity' | 'obtained';

export type CollectionFilters = {
  rarities: readonly Rarity[];
  continents: readonly Continent[];
  eras: readonly Era[];
  finishes: readonly CardFinish[];
  ownership: Ownership;
};

export const EMPTY_FILTERS: CollectionFilters = {
  rarities: [],
  continents: [],
  eras: [],
  finishes: [],
  ownership: 'all',
};

export const CONTINENTS: readonly Continent[] = ['africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania'];
export const ERAS: readonly Era[] = ['antiquity', 'medieval', 'modern', 'contemporary'];

/** Finishes from the most to the least special. */
const FINISH_RANK: readonly CardFinish[] = ['gold', 'full_art', 'holo', 'standard'];

export function buildEntries(cards: readonly Card[], items: readonly OwnedItem[]): CollectionEntry[] {
  const byCard = new Map<string, OwnedItem[]>();
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const list = byCard.get(item.cardId);
    if (list) list.push(item);
    else byCard.set(item.cardId, [item]);
  }
  return cards.map((card) => {
    const owned = byCard.get(card.id) ?? [];
    if (owned.length === 0) {
      return { card, owned: false, bestFinish: 'standard', finishes: [], copies: 0, firstObtainedAt: null };
    }
    const finishes = [...new Set(owned.map((item) => item.finish))].sort(
      (a, b) => FINISH_RANK.indexOf(a) - FINISH_RANK.indexOf(b),
    );
    const firsts = owned.map((item) => parseInstant(item.firstObtainedAt)).filter((ms): ms is number => ms !== null);
    return {
      card,
      owned: true,
      bestFinish: finishes[0] ?? 'standard',
      finishes,
      copies: owned.reduce((sum, item) => sum + item.quantity, 0),
      firstObtainedAt: firsts.length > 0 ? Math.min(...firsts) : null,
    };
  });
}

/** Lowercase, accents removed: "Élisabeth" and "elisabeth" match. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesQuery(card: Card, query: string): boolean {
  if (!query) return true;
  return [card.name.fr, card.name.en].some((name) => normalizeSearch(name).includes(query));
}

export function filterEntries(
  entries: readonly CollectionEntry[],
  filters: CollectionFilters,
  search: string,
): CollectionEntry[] {
  const query = normalizeSearch(search);
  return entries.filter(({ card, owned, finishes }) => {
    if (filters.ownership === 'owned' && !owned) return false;
    if (filters.ownership === 'missing' && owned) return false;
    if (filters.rarities.length > 0 && !filters.rarities.includes(card.rarity)) return false;
    if (filters.continents.length > 0 && !filters.continents.includes(card.continent)) return false;
    if (filters.eras.length > 0 && !filters.eras.includes(card.era)) return false;
    if (filters.finishes.length > 0 && !finishes.some((finish) => filters.finishes.includes(finish))) return false;
    return matchesQuery(card, query);
  });
}

/**
 * Collector number ascending; rarity from mythic down; obtained = newest first, missing cards last.
 * Every order falls back to the collector number so it stays stable.
 */
export function sortEntries(entries: readonly CollectionEntry[], sort: SortKey): CollectionEntry[] {
  const byNumber = (a: CollectionEntry, b: CollectionEntry) => a.card.number - b.card.number;
  const sorted = [...entries];
  if (sort === 'number') return sorted.sort(byNumber);
  if (sort === 'rarity') {
    return sorted.sort(
      (a, b) => RARITIES.indexOf(b.card.rarity) - RARITIES.indexOf(a.card.rarity) || byNumber(a, b),
    );
  }
  return sorted.sort((a, b) => {
    if (a.firstObtainedAt === null && b.firstObtainedAt === null) return byNumber(a, b);
    if (a.firstObtainedAt === null) return 1;
    if (b.firstObtainedAt === null) return -1;
    return b.firstObtainedAt - a.firstObtainedAt || byNumber(a, b);
  });
}

export function countActiveFilters(filters: CollectionFilters): number {
  return (
    filters.rarities.length +
    filters.continents.length +
    filters.eras.length +
    filters.finishes.length +
    (filters.ownership === 'all' ? 0 : 1)
  );
}

export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
}

export type Progress = { owned: number; total: number; ratio: number };

function progressOf(entries: readonly CollectionEntry[]): Progress {
  const owned = entries.filter((entry) => entry.owned).length;
  return { owned, total: entries.length, ratio: entries.length > 0 ? owned / entries.length : 0 };
}

export function collectionProgress(entries: readonly CollectionEntry[]): {
  global: Progress;
  byContinent: Record<Continent, Progress>;
  byEra: Record<Era, Progress>;
} {
  const byContinent = Object.fromEntries(
    CONTINENTS.map((continent) => [continent, progressOf(entries.filter((entry) => entry.card.continent === continent))]),
  ) as Record<Continent, Progress>;
  const byEra = Object.fromEntries(
    ERAS.map((era) => [era, progressOf(entries.filter((entry) => entry.card.era === era))]),
  ) as Record<Era, Progress>;
  return { global: progressOf(entries), byContinent, byEra };
}
