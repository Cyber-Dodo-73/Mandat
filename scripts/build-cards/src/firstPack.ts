import { CONTINENTS, ERAS, type Card, type Continent, type Era, type Rarity } from './types.ts';

/**
 * Composition of the onboarding pack (first booster offered to a new player). The API draws it
 * server-side from data/firstPackRules.json; the app never decides its content.
 */
export const FIRST_PACK_RULES = {
  slots: [
    { rarities: ['epic', 'legendary', 'mythic'], count: 1 },
    { rarities: ['rare', 'uncommon'], count: 2 },
    { rarities: ['common'], count: 2 },
  ] as Array<{ rarities: Rarity[]; count: number }>,
  distinctContinents: 5,
  minDistinctEras: 3,
  excludeSensitive: true,
};

export type FirstPackRules = typeof FIRST_PACK_RULES;

export type FirstPackFeasibility = {
  feasible: boolean;
  /** Number of (continent, era) patterns over the 5 slots that the catalog can fill. */
  patterns: number;
  /** Eligible cards per slot group and continent / era. */
  byContinent: Record<string, Record<Continent, number>>;
  byEra: Record<string, Record<Era, number>>;
  errors: string[];
};

type CardLike = Pick<Card, 'rarity' | 'continent' | 'era' | 'sensitive'>;

/**
 * Checks that the catalog can satisfy the onboarding rules. Slots get distinct continents, so
 * two slots never compete for the same card: a pattern is fillable when every
 * (slot group, continent, era) cell it uses has at least one eligible card.
 */
export function checkFirstPack(cards: readonly CardLike[], rules: FirstPackRules = FIRST_PACK_RULES): FirstPackFeasibility {
  const errors: string[] = [];
  const groups = rules.slots.map((s, i) => ({ key: `slot${i + 1}:${s.rarities.join('|')}`, ...s }));
  const eligible = cards.filter((c) => !(rules.excludeSensitive && c.sensitive));
  const count = new Map<string, number>();
  const cell = (g: number, c: Continent, e: Era) => `${g}|${c}|${e}`;
  for (const card of eligible) {
    groups.forEach((g, gi) => {
      if (g.rarities.includes(card.rarity)) {
        const key = cell(gi, card.continent, card.era);
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    });
  }

  const byContinent: FirstPackFeasibility['byContinent'] = {};
  const byEra: FirstPackFeasibility['byEra'] = {};
  groups.forEach((g, gi) => {
    byContinent[g.key] = Object.fromEntries(
      CONTINENTS.map((c) => [c, ERAS.reduce((sum, e) => sum + (count.get(cell(gi, c, e)) ?? 0), 0)]),
    ) as Record<Continent, number>;
    byEra[g.key] = Object.fromEntries(
      ERAS.map((e) => [e, CONTINENTS.reduce((sum, c) => sum + (count.get(cell(gi, c, e)) ?? 0), 0)]),
    ) as Record<Era, number>;
  });

  const slotGroups = groups.flatMap((g, gi) => Array<number>(g.count).fill(gi));
  if (rules.distinctContinents > CONTINENTS.length || rules.distinctContinents !== slotGroups.length) {
    errors.push(`distinctContinents (${rules.distinctContinents}) must equal the card count and be ≤ ${CONTINENTS.length}.`);
  }

  // Exhaustive search: continents are distinct per slot (≤ 6P5 = 720), eras free (4^5 = 1024).
  let patterns = 0;
  const usedContinents = new Set<Continent>();
  const eras: Era[] = [];
  const search = (slot: number) => {
    if (slot === slotGroups.length) {
      if (new Set(eras).size >= rules.minDistinctEras) patterns++;
      return;
    }
    const g = slotGroups[slot] as number;
    for (const continent of CONTINENTS) {
      if (usedContinents.has(continent)) continue;
      for (const era of ERAS) {
        if ((count.get(cell(g, continent, era)) ?? 0) === 0) continue;
        usedContinents.add(continent);
        eras.push(era);
        search(slot + 1);
        eras.pop();
        usedContinents.delete(continent);
      }
    }
  };
  if (errors.length === 0) search(0);
  if (patterns === 0) errors.push('No combination of eligible cards satisfies the onboarding pack rules.');
  return { feasible: patterns > 0, patterns, byContinent, byEra, errors };
}
