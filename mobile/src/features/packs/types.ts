import type { Rarity } from '@/theme/rarity';
import type { PackTheme } from '@/theme/packs';

/**
 * Client-side shapes of the pack endpoints. Phase 5 replaces these with the types
 * generated from the API spec (`GET /packs`, `GET /packs/{id}/odds`, `POST /packs/{id}/open`).
 */
export type Continent = Exclude<PackTheme, 'standard'>;

export type PackSummary = {
  id: string;
  theme: PackTheme;
  /** Continent of the themed packs; null for the standard season pack. */
  continent: Continent | null;
  /** Player level required to open it; null when always available. */
  unlockLevel: number | null;
  unlocked: boolean;
};

export type SlotOdds = {
  /** 1-based slot positions sharing these rates. */
  slots: readonly number[];
  rates: Partial<Record<Rarity, number>>;
};

export type PackOdds = {
  slots: readonly SlotOdds[];
  pity: { epicEvery: number; legendaryEvery: number };
};

export type FreePackState = {
  stock: number;
  maxStock: number;
  /** ISO date of the next free pack, server time; null when the stock is full. */
  nextFreePackAt: string | null;
};

export type PityCounters = { packsSinceEpic: number; packsSinceLegendary: number };

export type PacksResponse = {
  season: number;
  packs: readonly PackSummary[];
  freePacks: FreePackState;
  pity: PityCounters;
  odds: PackOdds;
};

export type DrawnCard = {
  cardId: string;
  rarity: Rarity;
  /** First copy in the collection: shows the "new" badge. */
  isNew: boolean;
  /** Influence credited for a duplicate, 0 for a new card. */
  duplicateInfluence: number;
};

export type PackOpenResult = {
  openingId: string;
  packId: string;
  /** Exactly five cards, in reveal order (slot 5 last). */
  cards: readonly DrawnCard[];
  influenceGained: number;
  pity: PityCounters;
  freePacks: FreePackState;
};
