import type { Candidate } from './types.ts';

type Labelled = Record<string, string>;
type Reasoned = Record<string, { name: string; reason: string }>;

/** Scope rules: who counts as a political figure for the season (data/exclusions.json). */
export type Exclusions = {
  /** Occupations that mark someone as primarily non-political (painter, physicist, footballer…). */
  nonPoliticalOccupations: Labelled;
  /**
   * Categories (query names) that are strong political signals on their own. Activist
   * categories are deliberately weak: they are also given to artists (John Lennon, Nina Simone).
   */
  strongCategories: string[];
  /** Categories (query names) that count as a leadership role (head of state/government, monarch). */
  leadershipCategories: string[];
  /** Positions that count as sovereign-level even though Wikidata gives them no jurisdiction. */
  sovereignPositions: Labelled;
  /** Minimum sitelinks of a sovereign-level position for people outside leadership categories. */
  notablePositionMinSitelinks: number;
  /** Occupations that exclude unless the person held a notable sovereign-level position. */
  alwaysExcludedOccupations: Labelled;
  /** Positions whose holders are excluded (religious offices). */
  positions: Reasoned;
  /** Individually excluded people. */
  people: Reasoned;
};

/** Whether a place QID is a sovereign entity (country or historic state), not a city or region. */
export type SovereignCheck = (placeQid: string) => boolean;

function hasSovereignPosition(c: Candidate, rules: Exclusions, isSovereign: SovereignCheck, minSitelinks: number): boolean {
  return c.positions.some(
    (p) =>
      p.sitelinks >= minSitelinks &&
      (rules.sovereignPositions[p.qid] !== undefined || (p.jurisdictionQid !== null && isSovereign(p.jurisdictionQid))),
  );
}

/**
 * Returns why a candidate is out of scope, or null when they are a political figure.
 *
 * Wikidata occupations are noisy (Julius Caesar is tagged "poet", Theodore Roosevelt
 * "explorer"), so an occupation alone never excludes someone with a strong political signal:
 * a strong category (revolutionary), a sovereign-level
 * position while in a leadership category (any notoriety: e.g. Charles III), or a notable
 * sovereign-level position otherwise (e.g. Roman consul). Local offices (a small-town mayor,
 * a seat in a legislature) are not enough to keep a novelist or an actor.
 */
export function exclusionReason(c: Candidate, rules: Exclusions, isSovereign: SovereignCheck): string | null {
  const person = rules.people[c.qid];
  if (person) return `excluded person: ${person.reason}`;

  const position = c.positions.find((p) => rules.positions[p.qid]);
  if (position) return `excluded position ${position.label.en}: ${rules.positions[position.qid]?.reason}`;

  const notable = hasSovereignPosition(c, rules, isSovereign, rules.notablePositionMinSitelinks);
  const always = c.occupationQids.find((o) => rules.alwaysExcludedOccupations[o]);
  if (always && !notable) return `occupation ${rules.alwaysExcludedOccupations[always]}`;

  const nonPolitical = c.occupationQids.filter((o) => rules.nonPoliticalOccupations[o]);
  if (nonPolitical.length === 0) return null;
  const strongCategory = c.categories.some((cat) => rules.strongCategories.includes(cat));
  const leader =
    c.categories.some((cat) => rules.leadershipCategories.includes(cat)) && hasSovereignPosition(c, rules, isSovereign, 0);
  if (strongCategory || leader || notable) return null;
  return `non-political occupation: ${nonPolitical.map((o) => rules.nonPoliticalOccupations[o]).join(', ')}`;
}
