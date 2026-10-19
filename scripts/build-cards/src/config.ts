import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Continent, Rarity } from './types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PATHS = {
  root: path.resolve(here, '../../..'),
  data: path.resolve(here, '../../../data'),
  content: path.resolve(here, '../../../data/content'),
  cache: path.resolve(here, '../.cache'),
  candidatesRaw: path.resolve(here, '../.cache/candidates.raw.json'),
  candidatesOut: path.resolve(here, '../../../data/candidates.season1.json'),
  cardsOut: path.resolve(here, '../../../data/cards.season1.json'),
  portraitsDir: path.resolve(here, '../../../data/portraits'),
  portraitsManifest: path.resolve(here, '../../../data/portraits.manifest.json'),
  portraitsWeb: path.resolve(here, '../../../mobile/assets/portraits'),
  historicStates: path.resolve(here, '../../../data/historic-states.json'),
  sensitive: path.resolve(here, '../../../data/sensitive.json'),
  exclusions: path.resolve(here, '../../../data/exclusions.json'),
  countryOverrides: path.resolve(here, '../../../data/country-overrides.json'),
  mustInclude: path.resolve(here, '../../../data/must-include.json'),
  firstPackRules: path.resolve(here, '../../../data/firstPackRules.json'),
  firstPackReport: path.resolve(here, '../.cache/firstPack.report.json'),
};

export const USER_AGENT = 'MANDAT-build-cards/0.1 (contact: dodolereporter@gmail.com)';

/** App-sized portraits: fit inside this box, WebP quality below (see portraits-web). */
export const PORTRAIT_WEB = { maxWidth: 600, maxHeight: 800, quality: 78 } as const;

export const SEASON = 1;
export const CARD_COUNT = 500;

/** Number of cards per rarity, rarest first. Must sum to CARD_COUNT. */
export const RARITY_TIERS: ReadonlyArray<{ rarity: Rarity; count: number }> = [
  { rarity: 'mythic', count: 10 },
  { rarity: 'legendary', count: 30 },
  { rarity: 'epic', count: 60 },
  { rarity: 'rare', count: 100 },
  { rarity: 'uncommon', count: 120 },
  { rarity: 'common', count: 180 },
];

/**
 * Minimum number of cards per continent. Quotas only drive which people enter the
 * season; rarity is assigned afterwards purely by fame rank.
 */
export const CONTINENT_QUOTAS: Record<Continent, number> = {
  africa: 75,
  asia: 75,
  europe: 75,
  north_america: 75,
  south_america: 75,
  oceania: 15,
};

/**
 * fameScore = 0.4·log10(pageviews) + 0.6·log10(sitelinks). Sitelinks (number of Wikipedia
 * language editions) weigh more because they reflect lasting worldwide notoriety, while
 * pageviews over-reward recent news (validated change from the brief's 0.7 / 0.3).
 */
export const FAME_WEIGHTS = { pageviews: 0.4, sitelinks: 0.6 } as const;

/**
 * Pageview window: from the first month available in the Wikimedia per-article API
 * (July 2015) to the last full month before the reference date, English Wikipedia, human
 * traffic only (agent=user). The longest window smooths out news spikes.
 */
export const PAGEVIEW_START = { year: 2015, month: 7 } as const;

export const PAGEVIEW_CONCURRENCY = 4;

/**
 * Per-tier diversity caps, applied after ranking, top tier down: at most N cards from the
 * same country (ISO) in a tier. A card over the cap is pushed to the next tier, keeping its
 * rank order. Fractions are of the tier size, rounded down.
 */
/**
 * Per-continent top-tier minimums, enforced after the country caps: without them South
 * America and Oceania had no legendary or mythic and Africa a single epic, because the fame
 * metric favours Europe and North America. The best-ranked figure of the continent is promoted
 * and the tiers in between give up their lowest-ranked card (see enforceContinentMinimums).
 */
export const CONTINENT_TOP_TIER_MINIMUMS: ReadonlyArray<{ continent: Continent; atLeast: Rarity; count: number }> = [
  { continent: 'africa', atLeast: 'legendary', count: 2 },
  { continent: 'asia', atLeast: 'legendary', count: 2 },
  { continent: 'south_america', atLeast: 'legendary', count: 2 },
  { continent: 'africa', atLeast: 'epic', count: 6 },
  { continent: 'asia', atLeast: 'epic', count: 6 },
  { continent: 'south_america', atLeast: 'epic', count: 6 },
  { continent: 'oceania', atLeast: 'epic', count: 1 },
];

/** Maximum entries kept in a card's Wikidata timeline (birth and death always included). */
export const TIMELINE_MAX = 12;

export const COUNTRY_CAPS: Record<Rarity, { max: number } | { fraction: number }> = {
  mythic: { max: 2 },
  legendary: { max: 6 },
  epic: { fraction: 0.2 },
  rare: { fraction: 0.2 },
  uncommon: { fraction: 0.2 },
  common: { fraction: 0.2 },
};
