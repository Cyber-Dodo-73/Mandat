import type { Rarity } from '@/theme/rarity';

export type { Rarity };

export type Localized = { fr: string; en: string };

export type Continent = 'africa' | 'asia' | 'europe' | 'north_america' | 'south_america' | 'oceania';

export type Era = 'antiquity' | 'medieval' | 'modern' | 'contemporary';

export type StatKey = 'influence' | 'diplomacy' | 'charisma' | 'strategy';

export type CardStats = Record<StatKey, number>;

export type TimelineKind = 'birth' | 'death' | 'office' | 'award' | 'event' | 'education';

/** One dated fact of the card's Wikidata timeline (years are historical: 1 BCE = −1). */
export type TimelineEntry = {
  year: number;
  endYear?: number;
  kind: TimelineKind;
  label: Localized;
  wikidataId?: string;
};

export type Card = {
  id: string;
  wikidataId: string;
  number: number;
  name: Localized;
  role: Localized;
  /** ISO 3166-1 alpha-2 code (historic states are mapped to a modern equivalent). */
  country: string;
  continent: Continent;
  era: Era;
  birthYear: number;
  deathYear: number | null;
  isLiving: boolean;
  fameScore: number;
  rarity: Rarity;
  bio: Localized;
  /** Long-form history: 6–10 sentences. */
  story?: Localized;
  /** 3–5 short facts, same count and order in both languages. */
  highlights?: { fr: string[]; en: string[] };
  /** What remains of them today, 1–2 sentences. */
  legacy?: Localized;
  /** Dated offices, awards and events from Wikidata, chronological. */
  timeline?: TimelineEntry[];
  stats: CardStats;
  ability: { name: Localized; description: Localized };
  /** Perpetrators of mass crimes: sober visuals and reveal, never featured. */
  sensitive: boolean;
  /** Optional illustration that replaces the procedural artwork later on. */
  artwork?: string;
};

export const STAT_KEYS: readonly StatKey[] = ['influence', 'diplomacy', 'charisma', 'strategy'];

/**
 * Print version of an owned card, drawn server-side with the card. The collection counts
 * each card + finish pair separately. `full_art` only exists for rare and above.
 */
export type CardFinish = 'standard' | 'holo' | 'full_art' | 'gold';

export const CARD_FINISHES: readonly CardFinish[] = ['standard', 'holo', 'full_art', 'gold'];
