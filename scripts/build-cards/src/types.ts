export const CONTINENTS = [
  'africa',
  'asia',
  'europe',
  'north_america',
  'south_america',
  'oceania',
] as const;
export type Continent = (typeof CONTINENTS)[number];

export const ERAS = ['antiquity', 'medieval', 'modern', 'contemporary'] as const;
export type Era = (typeof ERAS)[number];

/** Ordered from rarest to most common. */
export const RARITIES = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as const;
export type Rarity = (typeof RARITIES)[number];

export type Localized = { fr: string; en: string };

export type Stats = {
  influence: number;
  diplomacy: number;
  charisma: number;
  strategy: number;
};

export type StatKey = 'influence' | 'diplomacy' | 'charisma' | 'strategy';
export type EffectCondition =
  | { kind: 'always' | 'behind' | 'opponentRarityHigher' }
  | { kind: 'opponentContinent'; value: 'same' | 'different' }
  | { kind: 'opponentEra'; value: 'antiquity' | 'medieval' | 'modern' | 'contemporary' }
  | { kind: 'roundDomain'; value: StatKey }
  | { kind: 'round'; value: 1 | 2 | 3 };
/** Machine-readable duel effect (see data/content/GUIDELINES.md). */
export type AbilityEffect =
  | { type: 'bonus' | 'malus'; stat: StatKey | 'any'; amount: 1 | 2 | 3; condition: EffectCondition }
  | { type: 'tieBreaker'; condition: EffectCondition };
export type Ability = { name: Localized; description: Localized; effect: AbilityEffect };

/** A held position, ranked by the position's own notoriety (sitelinks). */
export type Position = {
  qid: string;
  label: Localized;
  sitelinks: number;
  /** Country QID the position applies to (P1001, or P17 of the position). */
  jurisdictionQid: string | null;
};

/** Raw person data gathered from Wikidata, before scoring. */
export type Candidate = {
  qid: string;
  name: Localized;
  sitelinks: number;
  enwikiTitle: string | null;
  birthYear: number | null;
  deathYear: number | null;
  /** Citizenship QIDs (P27), most relevant first. */
  citizenshipQids: string[];
  /** Country QID of the place of birth (P19 → P17). */
  birthCountryQid: string | null;
  positions: Position[];
  /** Occupation QIDs (P106), used to filter out people who are not primarily political. */
  occupationQids: string[];
  /** Categories (query names) that surfaced this person. */
  categories: string[];
};

export type ResolvedCandidate = Candidate & {
  country: string; // ISO 3166-1 alpha-2
  continent: Continent;
  era: Era;
  birthYear: number;
};

export type ScoredCandidate = ResolvedCandidate & {
  pageviews: number;
  rawScore: number;
  fameScore: number;
};

export type RankedCandidate = ScoredCandidate & {
  /** 1-based rank among the 500 selected cards (by fame). */
  rank: number;
  /** Collector number: rarity tier (rarest first), then fame rank. */
  number: number;
  rarity: Rarity;
  /** True when the card was pulled in by a continent quota rather than by merit. */
  viaQuota: boolean;
  /** True when the card comes from data/must-include.json (documented false negative). */
  mustInclude: boolean;
};

export const TIMELINE_KINDS = ['birth', 'death', 'office', 'award', 'event', 'education'] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];
/** One dated fact from Wikidata (P569/P19, P570/P20, P39, P166, P1344, P69). */
export type TimelineEntry = {
  /** Historical year (no year 0: 1 BCE = -1). */
  year: number;
  endYear?: number;
  kind: TimelineKind;
  label: Localized;
  /** Wikidata item the fact is about (the office, award, event, school or place). */
  wikidataId: string;
};

/** Optional long-form content (written later, validated when present). */
export type Highlights = { fr: string[]; en: string[] };

/** Hand-written per-card content, stored in data/content/<wikidataId>.json. */
export type CardContent = {
  wikidataId: string;
  /** Optional overrides when the Wikidata label/position label is poor. */
  name?: Localized;
  role?: Localized;
  bio: Localized;
  stats: Stats;
  ability: Ability;
  /** Long-form story, 6–10 sentences, 600–1600 characters per language. */
  story?: Localized;
  /** 3–5 short facts ("what they achieved"), same count in both languages. */
  highlights?: Highlights;
  /** 1–2 sentences on their legacy. */
  legacy?: Localized;
};

export type Card = {
  id: string;
  wikidataId: string;
  number: number;
  name: Localized;
  role: Localized;
  country: string;
  continent: Continent;
  era: Era;
  birthYear: number;
  deathYear: number | null;
  isLiving: boolean;
  fameScore: number;
  rarity: Rarity;
  bio: Localized;
  stats: Stats;
  ability: Ability;
  story?: Localized;
  highlights?: Highlights;
  legacy?: Localized;
  /** Dated facts from Wikidata, chronological, at most TIMELINE_MAX entries. */
  timeline: TimelineEntry[];
  sensitive: boolean;
  artwork?: string;
};
