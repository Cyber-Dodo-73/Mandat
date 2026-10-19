import type { components } from '@/lib/api';
import type { PackTheme } from '@/theme/packs';
import type { Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

/**
 * UI shapes of the pack screens, adapted from the API responses in adapters.ts.
 * The server decides everything here: draws, timers, stock and pity.
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
  /** Probability of each rarity, as a fraction (0.65 = 65 %). */
  rates: Partial<Record<Rarity, number>>;
};

export type FinishOdds = {
  finish: CardFinish;
  /** Probability per drawn card, as a fraction. */
  rate: number;
  /** Lowest rarity that can get this finish; null for every rarity. */
  minRarity: Rarity | null;
  /** Only rolled on the guaranteed slot (slot 5). */
  guaranteedSlotOnly: boolean;
};

export type PackOdds = {
  slots: readonly SlotOdds[];
  finishes: readonly FinishOdds[];
  pity: { epicEvery: number; legendaryEvery: number };
  /** Themed pack missing some rarities: those are drawn from the whole season. */
  continentFallback: boolean;
};

export type FreePackState = {
  stock: number;
  maxStock: number;
  /** ISO date of the next free pack, server time; null when the stock is full. */
  nextFreePackAt: string | null;
};

export type PityCounters = { packsSinceEpic: number; packsSinceLegendary: number };

export type PacksView = {
  packs: readonly PackSummary[];
  freePacks: FreePackState;
  /** Boosters won as rewards, opened once the free stock is empty. */
  bonusPacks: number;
  pity: PityCounters;
};

export type DrawnCard = {
  cardId: string;
  rarity: Rarity;
  finish: CardFinish;
  /** First copy in the collection: shows the "new" badge. */
  isNew: boolean;
  /** Influence credited for a duplicate, 0 for a new card. */
  influenceGained: number;
};

export type PackOpenResult = {
  openingId: string;
  packId: string;
  /** Exactly five cards, in reveal order (slot 5 last). */
  cards: readonly DrawnCard[];
  influenceGained: number;
  pity: PityCounters;
  freePacks: FreePackState;
  bonusPacks: number;
};

export type ApiPacksResponse = components['schemas']['PacksResponse'];
export type ApiOddsResponse = components['schemas']['OddsResponse'];
export type ApiOpenPackResponse = components['schemas']['OpenPackResponse'];
